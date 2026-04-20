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
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
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

    const callbackUrl = `${this.configService.get('NEXTJS_URL')}/payment/corporate-callback`;

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: org.email,
        amount: config.amountKobo,
        callback_url: callbackUrl,
        metadata: { orgId, plan },
      }),
    });

    const json = await response.json();
    if (!json.status) {
      this.logger.error(`Paystack init failed: ${json.message}`);
      throw new InternalServerErrorException(json.message || 'Paystack initialization failed');
    }

    return { authorizationUrl: json.data.authorization_url };
  }

  async verifyAndActivateLicense(orgId: string, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.paystackSecret}` },
    });
    const json = await response.json();

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
        paystackReference: reference,
        amountKes: config.amountKes,
      },
      update: {
        tier: 'premium',
        seats: config.seats,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

    const inviteLink = `${this.configService.get('NEXTJS_URL')}/dashboard/corporate/invite?token=${inviteToken}`;
    return { inviteLink };
  }

  async acceptInvite(token: string, userId: string) {
    const member = await this.prisma.orgMember.findUnique({ where: { inviteToken: token } });
    if (!member) throw new NotFoundException('Invalid or expired invite token');

    await this.prisma.orgMember.update({
      where: { id: member.id },
      data: { userId, inviteAccepted: true, inviteToken: null },
    });

    await this.prisma.corporateLicense.update({
      where: { orgId: member.orgId },
      data: { seatsUsed: { increment: 1 } },
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
