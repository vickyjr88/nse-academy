import { BadRequestException, Injectable } from '@nestjs/common';
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
}
