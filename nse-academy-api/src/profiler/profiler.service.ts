import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QUIZ_QUESTIONS } from './quiz-questions.seed';

const CAPITAL_RANGE_MAP: Record<number, string> = {
  0: '<100k',
  1: '100k-500k',
  2: '500k-2M',
  3: '>2M',
};

const HORIZON_YEARS_MAP: Record<number, number> = {
  0: 1,
  1: 2,
  2: 5,
  3: 10,
};

@Injectable()
export class ProfilerService {
  constructor(private prisma: PrismaService) {}

  getQuestions() {
    return QUIZ_QUESTIONS;
  }

  async submitQuiz(userId: string, dto: SubmitQuizDto) {
    let totalScore = 0;
    let capitalRange = '<100k';
    let horizonYears = 1;

    for (const answer of dto.answers) {
      const question = QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(`Invalid questionId: ${answer.questionId}`);
      }
      if (answer.optionIndex < 0 || answer.optionIndex >= question.options.length) {
        throw new BadRequestException(
          `Invalid optionIndex ${answer.optionIndex} for question ${answer.questionId}`,
        );
      }

      totalScore += question.options[answer.optionIndex].score;

      if (answer.questionId === 4) {
        capitalRange = CAPITAL_RANGE_MAP[answer.optionIndex] ?? '<100k';
      }
      if (answer.questionId === 1) {
        horizonYears = HORIZON_YEARS_MAP[answer.optionIndex] ?? 1;
      }
    }

    const riskScore = Math.min(100, totalScore);
    const type = this.computeType(riskScore);

    return this.prisma.investorProfile.upsert({
      where: { userId },
      create: { userId, type, riskScore, horizonYears, capitalRange, quizAnswers: dto.answers as any },
      update: { type, riskScore, horizonYears, capitalRange, quizAnswers: dto.answers as any },
    });
  }

  private computeType(score: number): string {
    if (score <= 25) return 'conservative';
    if (score <= 45) return 'dividend';
    if (score <= 65) return 'moderate';
    if (score <= 80) return 'aggressive';
    return 'growth';
  }

  async setShareVisibility(userId: string, isPublic: boolean) {
    const profile = await this.prisma.investorProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('No investor profile to share. Complete the quiz first.');
    }

    let publicSlug = profile.publicSlug;
    if (isPublic && !publicSlug) {
      publicSlug = await this.generateUniqueSlug();
    }

    return this.prisma.investorProfile.update({
      where: { userId },
      data: { isPublic, publicSlug },
      select: {
        isPublic: true,
        publicSlug: true,
        type: true,
        riskScore: true,
        horizonYears: true,
        capitalRange: true,
      },
    });
  }

  async getPublicProfile(slug: string) {
    const profile = await this.prisma.investorProfile.findUnique({
      where: { publicSlug: slug },
      select: {
        type: true,
        riskScore: true,
        horizonYears: true,
        capitalRange: true,
        createdAt: true,
        isPublic: true,
        user: { select: { name: true } },
      },
    });

    if (!profile || !profile.isPublic) {
      throw new NotFoundException('Profile not found or not public.');
    }

    return {
      type: profile.type,
      riskScore: profile.riskScore,
      horizonYears: profile.horizonYears,
      capitalRange: profile.capitalRange,
      createdAt: profile.createdAt,
      displayName: firstName(profile.user.name),
    };
  }

  async listPublicSlugs() {
    const profiles = await this.prisma.investorProfile.findMany({
      where: { isPublic: true, publicSlug: { not: null } },
      select: { publicSlug: true, createdAt: true },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
    return profiles.map((p) => ({ slug: p.publicSlug, updatedAt: p.createdAt }));
  }

  private async generateUniqueSlug(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = randomBytes(6).toString('base64url');
      const exists = await this.prisma.investorProfile.findUnique({
        where: { publicSlug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new Error('Failed to generate unique share slug');
  }
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'NSE Investor';
  const trimmed = fullName.trim();
  if (!trimmed) return 'NSE Investor';
  return trimmed.split(/\s+/)[0];
}
