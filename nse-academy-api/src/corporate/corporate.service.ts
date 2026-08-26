import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { BrevoService } from '../brevo/brevo.service';
import { PaystackService } from '../paystack/paystack.service';

type CorporatePlan = 'starter' | 'team' | 'sacco';

const PLAN_CONFIG: Record<CorporatePlan, { seats: number; amountKobo: number; amountKes: number }> = {
  starter: { seats: 5, amountKobo: 150000, amountKes: 1500 },
  team: { seats: 15, amountKobo: 350000, amountKes: 3500 },
  sacco: { seats: 50, amountKobo: 1000000, amountKes: 10000 },
};

@Injectable()
export class CorporateService {
  private readonly logger = new Logger(CorporateService.name);
  private readonly paystackSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private brevo: BrevoService,
    private paystack: PaystackService,
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  private webUrl(): string {
    return (
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  async createOrganization(adminUserId: string, dto: { name: string; type: string; email: string }) {
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        type: dto.type,
        email: dto.email,
        adminUserId,
        members: {
          create: {
            userId: adminUserId,
            role: 'admin',
            inviteAccepted: true,
          },
        },
      },
      include: { members: true },
    });
    return org;
  }

  async initializeLicense(orgId: string, plan: string) {
    if (!PLAN_CONFIG[plan as CorporatePlan]) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }
    const config = PLAN_CONFIG[plan as CorporatePlan];
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const callbackUrl = `${this.webUrl()}/payment/corporate-callback`;

    const json = await this.paystack.initializeTransaction({
      email: org.email,
      amountKobo: config.amountKobo,
      callbackUrl,
      metadata: { orgId, plan },
    });
    if (!json.status || !json.data) {
      this.logger.error(`Paystack init failed: ${json.message}`);
      throw new InternalServerErrorException(json.message || 'Paystack initialization failed');
    }

    return { authorizationUrl: json.data.authorization_url };
  }

  async verifyAndActivateLicense(orgId: string, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const json = await this.paystack.verifyTransaction(reference);

    if (!json.status || json.data?.status !== 'success') {
      throw new BadRequestException(json.message || 'Payment not confirmed by Paystack');
    }

    const plan: CorporatePlan = json.data?.metadata?.plan || 'starter';
    const config = PLAN_CONFIG[plan];

    await this.prisma.corporateLicense.upsert({
      where: { orgId },
      create: {
        orgId,
        tier: 'premium',
        seats: config.seats,
        seatsUsed: 1,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod: 'paystack',
        paystackReference: reference,
        amountKes: config.amountKes,
      },
      update: {
        tier: 'premium',
        seats: config.seats,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod: 'paystack',
        paystackReference: reference,
        amountKes: config.amountKes,
      },
    });

    return { success: true };
  }

  async inviteMember(orgId: string, email: string) {
    const license = await this.prisma.corporateLicense.findUnique({ where: { orgId } });
    if (!license || license.status !== 'active') {
      throw new BadRequestException('No active license for this organization');
    }
    if (license.seatsUsed >= license.seats) {
      throw new BadRequestException('No seats available. Upgrade your plan.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('No account with that email. Ask them to register first.');
    }

    const existing = await this.prisma.orgMember.findUnique({ where: { userId: user.id } });
    if (existing) throw new BadRequestException('User is already a member of an organization');

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const inviteToken = randomUUID();
    await this.prisma.orgMember.create({
      data: {
        orgId,
        userId: user.id,
        role: 'member',
        inviteToken,
        inviteAccepted: false,
      },
    });

    const inviteLink = this.buildInviteLink(inviteToken);
    void this.sendInviteEmail(user.email, user.name, org.name, inviteLink);

    return { inviteLink };
  }

  async resendInvite(orgId: string, memberId: string) {
    const member = await this.prisma.orgMember.findUnique({
      where: { id: memberId },
      include: { user: true, org: true },
    });
    if (!member || member.orgId !== orgId) throw new NotFoundException('Member not found');
    if (member.inviteAccepted) throw new BadRequestException('This member has already joined');
    if (!member.inviteToken) throw new BadRequestException('This member has no pending invite');

    const inviteLink = this.buildInviteLink(member.inviteToken);
    void this.sendInviteEmail(member.user.email, member.user.name, member.org.name, inviteLink);

    return { inviteLink };
  }

  private buildInviteLink(inviteToken: string): string {
    return `${this.webUrl()}/dashboard/corporate/invite?token=${inviteToken}`;
  }

  private async sendInviteEmail(email: string, name: string, orgName: string, inviteLink: string): Promise<void> {
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: `You've been invited to join ${orgName} on NSE Academy`,
        htmlContent: this.renderInviteEmailHtml(name, orgName, inviteLink),
        textContent: this.renderInviteEmailText(name, orgName, inviteLink),
        tags: ['corporate-invite'],
      });
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${email}: ${(err as Error).message}`);
    }
  }

  private renderInviteEmailHtml(name: string, orgName: string, inviteLink: string): string {
    const firstName = name.split(' ')[0];
    return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
  <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #047857; font-weight: 700; margin: 0 0 12px;">NSE Academy</p>
  <h1 style="font-size: 22px; margin: 0 0 12px;">You're invited, ${firstName}</h1>
  <p style="font-size: 16px; line-height: 1.6;">
    <strong>${orgName}</strong> has invited you to join their organization on NSE Academy,
    unlocking premium access to personalised stock picks, deep-dive research, and portfolio tracking.
  </p>
  <p style="margin: 28px 0;">
    <a href="${inviteLink}"
       style="display: inline-block; background: #047857; color: #fff; text-decoration: none;
              font-weight: 600; padding: 14px 28px; border-radius: 12px;">
      Accept Invite
    </a>
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #52525b;">
    If the button doesn't work, copy and paste this link into your browser:<br/>
    <a href="${inviteLink}" style="color: #047857;">${inviteLink}</a>
  </p>
  <p style="font-size: 14px; color: #52525b; margin-top: 32px;">
    - The NSE Academy team
  </p>
</body></html>`;
  }

  private renderInviteEmailText(name: string, orgName: string, inviteLink: string): string {
    const firstName = name.split(' ')[0];
    return `You're invited, ${firstName}

${orgName} has invited you to join their organization on NSE Academy, unlocking premium access to personalised stock picks, deep-dive research, and portfolio tracking.

Accept your invite: ${inviteLink}

- The NSE Academy team
`;
  }

  async acceptInvite(token: string, userId: string) {
    const member = await this.prisma.orgMember.findUnique({ where: { inviteToken: token } });
    if (!member) throw new NotFoundException('Invalid or expired invite token');

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$executeRaw`
        UPDATE "CorporateLicense"
        SET "seatsUsed" = "seatsUsed" + 1
        WHERE "orgId" = ${member.orgId} AND "seatsUsed" < "seats"
      `;
      if (claimed === 0) {
        throw new BadRequestException('No seats available. Upgrade your plan.');
      }

      await tx.orgMember.update({
        where: { id: member.id },
        data: { userId, inviteAccepted: true, inviteToken: null },
      });
    });

    return { success: true };
  }

  async getOrgDashboard(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        license: true,
        members: { include: { user: { select: { email: true, name: true } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateMemberRole(orgId: string, memberId: string, role: 'admin' | 'member') {
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== orgId) throw new NotFoundException('Member not found');

    if (member.role === 'admin' && role === 'member') {
      const adminCount = await this.prisma.orgMember.count({ where: { orgId, role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the only admin - promote another member first');
      }
    }

    return this.prisma.orgMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(orgId: string, memberId: string) {
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== orgId) throw new NotFoundException('Member not found');
    if (member.role === 'admin') throw new BadRequestException('Cannot remove the organization admin');

    await this.prisma.orgMember.delete({ where: { id: memberId } });

    if (member.inviteAccepted) {
      await this.prisma.corporateLicense.update({
        where: { orgId },
        data: { seatsUsed: { decrement: 1 } },
      });
    }

    return { success: true };
  }

  async getUserOrg(userId: string) {
    return this.prisma.orgMember.findUnique({
      where: { userId },
      include: { org: { include: { license: true } } },
    });
  }
}
