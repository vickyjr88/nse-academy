import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ModelPortfolio, ModelPortfolioHolding } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadDailyCloses } from '../market-data/price-history';
import { AllocationService } from '../allocation/allocation.service';
import { eatDayBounds } from '../reports/report-helpers';
import { ModelInput, ModelPerformance, compareToModel, modelPerformance, validateModel } from './models';

type Row = ModelPortfolio & { holdings: ModelPortfolioHolding[] };

export interface ModelView {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  riskProfile: string | null;
  status: string;
  reviewedBy: string | null;
  inceptionDate: string;
  publishedAt: Date | null;
  holdings: { ticker: string; weightPct: number; rationale: string | null }[];
  performance: ModelPerformance | null;
}

const PERFORMANCE_NOTE = 'Buy-and-hold from the inception date at the stated weights. No rebalancing, fees, tax or dividends. Past performance does not predict future results.';

@Injectable()
export class ModelPortfoliosService {
  constructor(
    private prisma: PrismaService,
    private allocation: AllocationService,
  ) {}

  static readonly NOTE = PERFORMANCE_NOTE;

  private async view(rows: Row[]): Promise<ModelView[]> {
    if (rows.length === 0) return [];
    const tickers = [...new Set(rows.flatMap((r) => r.holdings.map((h) => h.ticker)))];
    const today = eatDayBounds(new Date(), 0).ymd;
    const oldest = rows.map((r) => r.inceptionDate).sort()[0];
    const lookback = Math.min(Math.max(Math.ceil((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86_400_000) + 14, 60), 800);
    const series = await loadDailyCloses(this.prisma, tickers, lookback);
    return rows.map((r) => {
      const holdings = r.holdings.slice().sort((a, b) => b.weightPct - a.weightPct).map((h) => ({ ticker: h.ticker, weightPct: h.weightPct, rationale: h.rationale }));
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        summary: r.summary,
        description: r.description,
        riskProfile: r.riskProfile,
        status: r.status,
        reviewedBy: r.reviewedBy,
        inceptionDate: r.inceptionDate,
        publishedAt: r.publishedAt,
        holdings,
        performance: modelPerformance(holdings, series, r.inceptionDate),
      };
    });
  }

  // ---- public

  async listPublished(): Promise<ModelView[]> {
    const rows = await this.prisma.modelPortfolio.findMany({ where: { status: 'published' }, include: { holdings: true }, orderBy: { publishedAt: 'desc' } });
    return this.view(rows);
  }

  async getPublished(slug: string): Promise<ModelView> {
    const row = await this.prisma.modelPortfolio.findUnique({ where: { slug }, include: { holdings: true } });
    if (!row || row.status !== 'published') throw new NotFoundException('Model portfolio not found');
    return (await this.view([row]))[0];
  }

  // ---- members

  async compare(userId: string, slug: string) {
    const model = await this.getPublished(slug);
    const overview = await this.allocation.overview(userId);
    const c = compareToModel(model.holdings, overview.rows.map((r) => ({ ticker: r.ticker, weightPct: r.weightPct })));
    return { slug: model.slug, name: model.name, hasHoldings: overview.rows.length > 0, ...c };
  }

  async useAsTargets(userId: string, slug: string) {
    const model = await this.getPublished(slug);
    const targets = await this.allocation.setTargets(userId, model.holdings.map((h) => ({ ticker: h.ticker, weightPct: h.weightPct })));
    return { slug: model.slug, targets };
  }

  // ---- admin

  async adminList(): Promise<ModelView[]> {
    const rows = await this.prisma.modelPortfolio.findMany({ include: { holdings: true }, orderBy: { updatedAt: 'desc' } });
    return this.view(rows);
  }

  private async assertPriced(tickers: string[]): Promise<void> {
    const series = await loadDailyCloses(this.prisma, tickers);
    const none = tickers.filter((t) => !(series.get(t)?.length));
    if (none.length) throw new BadRequestException(`No recent price history for ${none.join(', ')}. Check the stock code${none.length === 1 ? '' : 's'}.`);
  }

  async create(input: ModelInput & { reviewedBy?: string | null }): Promise<ModelView> {
    const clean = this.clean(input);
    const problems = validateModel(clean);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    await this.assertPriced(clean.holdings.map((h) => h.ticker));
    try {
      const row = await this.prisma.modelPortfolio.create({
        data: {
          slug: clean.slug,
          name: clean.name,
          summary: clean.summary,
          description: clean.description,
          riskProfile: clean.riskProfile || null,
          inceptionDate: clean.inceptionDate,
          reviewedBy: input.reviewedBy?.trim() || null,
          holdings: { create: clean.holdings.map((h) => ({ ticker: h.ticker, weightPct: h.weightPct, rationale: h.rationale?.trim() || null })) },
        },
        include: { holdings: true },
      });
      return (await this.view([row]))[0];
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`A model with the address "${clean.slug}" already exists.`);
      throw err;
    }
  }

  /** Editing a published model sends it back to draft: what people copy must not change without a new review. */
  async update(id: string, input: ModelInput & { reviewedBy?: string | null }): Promise<ModelView & { backToDraft: boolean }> {
    const existing = await this.prisma.modelPortfolio.findUnique({ where: { id }, include: { holdings: true } });
    if (!existing) throw new NotFoundException('Model portfolio not found');
    const clean = this.clean(input);
    const problems = validateModel(clean);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    await this.assertPriced(clean.holdings.map((h) => h.ticker));

    const changedContent =
      existing.inceptionDate !== clean.inceptionDate ||
      JSON.stringify(existing.holdings.map((h) => [h.ticker, h.weightPct]).sort()) !== JSON.stringify(clean.holdings.map((h) => [h.ticker, h.weightPct]).sort());
    const backToDraft = existing.status === 'published' && changedContent;
    try {
      await this.prisma.$transaction([
        this.prisma.modelPortfolioHolding.deleteMany({ where: { modelId: id } }),
        this.prisma.modelPortfolio.update({
          where: { id },
          data: {
            slug: clean.slug,
            name: clean.name,
            summary: clean.summary,
            description: clean.description,
            riskProfile: clean.riskProfile || null,
            inceptionDate: clean.inceptionDate,
            reviewedBy: input.reviewedBy?.trim() || null,
            ...(backToDraft ? { status: 'draft', publishedAt: null } : {}),
            holdings: { create: clean.holdings.map((h) => ({ ticker: h.ticker, weightPct: h.weightPct, rationale: h.rationale?.trim() || null })) },
          },
        }),
      ]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`A model with the address "${clean.slug}" already exists.`);
      throw err;
    }
    const row = (await this.prisma.modelPortfolio.findUnique({ where: { id }, include: { holdings: true } })) as Row;
    return { ...(await this.view([row]))[0], backToDraft };
  }

  async publish(id: string): Promise<ModelView> {
    const row = await this.prisma.modelPortfolio.findUnique({ where: { id }, include: { holdings: true } });
    if (!row) throw new NotFoundException('Model portfolio not found');
    if (!row.reviewedBy?.trim()) throw new BadRequestException('Name the person who reviewed this model, with their credentials, before publishing it.');
    const [v] = await this.view([row]);
    if (!v.performance) throw new BadRequestException('Every stock needs price history from the inception date, so the performance shown is complete. Move the inception date later or check the stock codes.');
    const updated = await this.prisma.modelPortfolio.update({ where: { id }, data: { status: 'published', publishedAt: row.publishedAt ?? new Date() }, include: { holdings: true } });
    return (await this.view([updated]))[0];
  }

  async unpublish(id: string): Promise<ModelView> {
    const row = await this.prisma.modelPortfolio.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Model portfolio not found');
    const updated = await this.prisma.modelPortfolio.update({ where: { id }, data: { status: 'draft', publishedAt: null }, include: { holdings: true } });
    return (await this.view([updated]))[0];
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.prisma.modelPortfolio.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Model portfolio not found');
    await this.prisma.modelPortfolio.delete({ where: { id } });
    return { deleted: true };
  }

  private clean(i: ModelInput): ModelInput {
    return {
      slug: String(i.slug ?? '').trim().toLowerCase(),
      name: String(i.name ?? '').trim(),
      summary: String(i.summary ?? '').trim(),
      description: String(i.description ?? '').trim(),
      riskProfile: i.riskProfile ? String(i.riskProfile).trim().toLowerCase() : null,
      inceptionDate: String(i.inceptionDate ?? '').trim(),
      holdings: (i.holdings ?? []).map((h) => ({ ticker: String(h.ticker ?? '').trim().toUpperCase(), weightPct: Number(h.weightPct), rationale: h.rationale ? String(h.rationale).trim() : null })),
    };
  }
}
