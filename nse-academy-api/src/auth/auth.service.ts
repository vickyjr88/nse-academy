import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { LeadsService } from '../leads/leads.service';
import { EbookService } from '../ebook/ebook.service';
import { BrevoService } from '../brevo/brevo.service';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly brevoListId?: number;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private referrals: ReferralsService,
    private leads: LeadsService,
    private ebooks: EbookService,
    private brevo: BrevoService,
    private config: ConfigService,
  ) {
    const listIdRaw = this.config.get<string>('BREVO_LIST_ID');
    this.brevoListId = listIdRaw ? Number(listIdRaw) : undefined;
  }

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email, passwordHash, ...(dto.phone ? { phone: dto.phone } : {}) },
    });

    if (dto.referralCode) {
      await this.referrals.recordPendingReferral(dto.referralCode, user.id);
    }

    // Mark any matching lead as converted + flag in Brevo so the welcome
    // drip can branch on REGISTERED=true. Fire-and-forget - register flow
    // must not block on Brevo.
    void this.leads.markConverted(email);
    void this.ebooks.claimPurchasesForEmail(user.id, user.email);

    // markConverted only touches Brevo for users who came through the
    // lead-magnet funnel first (it no-ops for anyone who wasn't already a
    // captured Lead) - a direct signup otherwise gets no Brevo contact and
    // no welcome email at all. Do both explicitly here so every signup is
    // covered regardless of how they arrived.
    void this.brevo.upsertContact({
      email,
      attributes: { FIRSTNAME: user.name, REGISTERED: true, REGISTERED_AT: new Date().toISOString() },
      listIds: this.brevoListId ? [this.brevoListId] : [],
    });
    void this.sendWelcomeEmail(user.email, user.name);

    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    void this.ebooks.claimPurchasesForEmail(user.id, user.email);

    return this.signToken(user.id, user.email);
  }

  private signToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: userId, email },
    };
  }

  private static readonly GENERIC_FORGOT_PASSWORD_RESPONSE = {
    message: 'If that email is registered, a reset link has been sent.',
  };

  /**
   * Always returns the same generic response regardless of whether the
   * email matches a user - the response shape must not let a caller
   * distinguish a registered email from an unregistered one.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) return AuthService.GENERIC_FORGOT_PASSWORD_RESPONSE;

    await this.issuePasswordReset(user);

    return AuthService.GENERIC_FORGOT_PASSWORD_RESPONSE;
  }

  /**
   * Creates a fresh reset token and emails it to the user. Shared by the
   * self-service forgot-password flow and any admin-driven flow that needs
   * to give a newly-created user a way to set their own password (e.g.
   * an org admin account created inline while setting up a corporate
   * license) - same operation either way, just a different trigger.
   */
  async issuePasswordReset(user: { id: string; email: string; name: string }): Promise<void> {
    // Invalidate any still-unused tokens from earlier requests so an old
    // leaked link stops working once a new one is issued.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    void this.sendResetPasswordEmail(user.email, user.name, token);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  private async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Welcome to NSE Academy',
        htmlContent: this.renderWelcomeEmailHtml(name),
        textContent: this.renderWelcomeEmailText(name),
        tags: ['welcome-email'],
      });
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendResetPasswordEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.webUrl()}/auth/reset-password/${token}`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Reset your NSE Academy password',
        htmlContent: this.renderResetPasswordEmailHtml(resetUrl),
        textContent: this.renderResetPasswordEmailText(resetUrl),
        tags: ['password-reset'],
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}: ${(err as Error).message}`);
    }
  }

  private renderWelcomeEmailHtml(name: string): string {
    const firstName = name.split(' ')[0];
    const dashboardUrl = `${this.webUrl()}/dashboard`;
    const profilerUrl = `${this.webUrl()}/investor-profiler`;
    return renderEmailHtml({
      eyebrow: 'Welcome',
      heading: `Welcome, ${firstName}`,
      bodyHtml: [
        'Your account is ready. Take the free 3-minute investor profiler quiz to get a personalised learning path and stock picks matched to your risk tolerance and goals.',
      ],
      button: { label: 'Take the Investor Profiler', url: profilerUrl },
      footNoteHtml: `Or head straight to <a href="${dashboardUrl}" style="color:#047857;">your dashboard</a>.`,
      siteUrl: this.webUrl(),
    });
  }

  private renderWelcomeEmailText(name: string): string {
    const firstName = name.split(' ')[0];
    const dashboardUrl = `${this.webUrl()}/dashboard`;
    const profilerUrl = `${this.webUrl()}/investor-profiler`;
    return renderEmailText({
      heading: `Welcome, ${firstName}`,
      bodyText: [
        'Your account is ready. Take the free 3-minute investor profiler quiz to get a personalised learning path and stock picks matched to your risk tolerance and goals.',
      ],
      button: { label: 'Take the Investor Profiler', url: profilerUrl },
      footNoteText: `Or head straight to your dashboard: ${dashboardUrl}`,
      siteUrl: this.webUrl(),
    });
  }

  private renderResetPasswordEmailHtml(resetUrl: string): string {
    return renderEmailHtml({
      eyebrow: 'Password Reset',
      heading: 'Reset your password',
      bodyHtml: [
        "We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.",
      ],
      button: { label: 'Reset Password', url: resetUrl },
      footNoteHtml: "If you didn't request this, you can safely ignore this email - your password won't change.",
      siteUrl: this.webUrl(),
    });
  }

  private renderResetPasswordEmailText(resetUrl: string): string {
    return renderEmailText({
      heading: 'Reset your password',
      bodyText: [
        "We received a request to reset your password. Use the link below to choose a new one. This link expires in 1 hour.",
      ],
      button: { label: 'Reset Password', url: resetUrl },
      footNoteText: "If you didn't request this, you can safely ignore this email - your password won't change.",
      siteUrl: this.webUrl(),
    });
  }
}
