import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResearchNote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadDailyBars } from '../market-data/price-history';
import { MarketFactsService } from '../market-report/market-facts.service';
import { cleanName } from '../market-report/market-facts';
import { eatDayBounds } from '../reports/report-helpers';
import { NoteDraft, REVIEWER_PLACEHOLDER, StockFacts, computeStockFacts, draftBrief, draftFocusList, screenFocusList } from './research-facts';

export type NoteKind = 'FOCUS_LIST' | 'BRIEF';

export interface NoteView {
  id: string;
  kind: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  tickers: string[];
  period: string | null;
  facts: unknown;
  status: string;
  reviewedBy: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

const view = (n: ResearchNote): NoteView => ({
  id: n.id, kind: n.kind, slug: n.slug, title: n.title, summary: n.summary, body: n.body, tickers: n.tickers, period: n.period,
  facts: n.facts, status: n.status, reviewedBy: n.reviewedBy, publishedAt: n.publishedAt, updatedAt: n.updatedAt,
});

const LOOKBACK_DAYS = 130;

@Injectable()
export class ResearchService {
  constructor(
    private prisma: PrismaService,
    private facts: MarketFactsService,
  ) {}

  private async names(): Promise<Map<string, string>> {
    const rows = await this.prisma.$queryRaw<{ ticker: string; name: string }[]>`select distinct on (ticker) ticker, name from "StockPrice" order by ticker, "timestamp" desc`;
    return new Map(rows.map((r) => [r.ticker, cleanName(r.name)]));
  }

  private async allFacts(only?: string): Promise<StockFacts[]> {
    const today = eatDayBounds(new Date(), 0).ymd;
    const [bars, sectors, names] = await Promise.all([loadDailyBars(this.prisma, only ? [only] : null, LOOKBACK_DAYS), this.facts.sectorMap(), this.names()]);
    const out: StockFacts[] = [];
    for (const [ticker, b] of bars) {
      const f = computeStockFacts(ticker, names.get(ticker) ?? ticker, sectors[ticker] ?? null, b, today);
      if (f) out.push(f);
    }
    return out;
  }

  /** Saves a draft. An existing draft with the same address is replaced; a published note is never overwritten. */
  private async saveDraft(kind: NoteKind, d: NoteDraft): Promise<NoteView> {
    const existing = await this.prisma.researchNote.findUnique({ where: { slug: d.slug } });
    if (existing && existing.status === 'published') throw new ConflictException(`"${existing.title}" is already published. Unpublish it first if you want to regenerate it.`);
    const data = { kind, slug: d.slug, title: d.title, summary: d.summary, body: d.body, tickers: d.tickers, period: d.period, facts: d.facts as Prisma.InputJsonValue };
    const row = existing
      ? await this.prisma.researchNote.update({ where: { id: existing.id }, data: { ...data, reviewedBy: null } })
      : await this.prisma.researchNote.create({ data });
    return view(row);
  }

  async generateFocusList(period?: string): Promise<NoteView> {
    const p = period ?? eatDayBounds(new Date(), 0).ymd.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new BadRequestException('period must be YYYY-MM');
    const all = await this.allFacts();
    const { picks, universe } = screenFocusList(all);
    if (picks.length === 0) throw new BadRequestException('No liquid stock met any of the three screens right now, so there is no list to draft.');
    const stocks = all.filter((f) => picks.some((x) => x.ticker === f.ticker));
    return this.saveDraft('FOCUS_LIST', draftFocusList(p, picks, stocks, universe));
  }

  async generateBrief(ticker: string): Promise<NoteView> {
    const t = String(ticker ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9.]{1,12}$/.test(t)) throw new BadRequestException('Give a valid stock code.');
    const [f] = await this.allFacts(t);
    if (!f) throw new BadRequestException(`${t} does not have enough recent price history (about 60 sessions and trading in the last week) for a brief.`);
    return this.saveDraft('BRIEF', draftBrief(f));
  }

  // ---- admin

  async adminList(): Promise<NoteView[]> {
    return (await this.prisma.researchNote.findMany({ orderBy: { updatedAt: 'desc' } })).map(view);
  }

  async update(id: string, input: { title?: string; summary?: string; body?: string; reviewedBy?: string | null }): Promise<NoteView> {
    const existing = await this.prisma.researchNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Note not found');
    const data: Prisma.ResearchNoteUpdateInput = {};
    if (input.title !== undefined) {
      if (!input.title.trim() || input.title.length > 160) throw new BadRequestException('Give the note a title of up to 160 characters.');
      data.title = input.title.trim();
    }
    if (input.summary !== undefined) {
      if (!input.summary.trim() || input.summary.length > 300) throw new BadRequestException('Write a summary of up to 300 characters.');
      data.summary = input.summary.trim();
    }
    if (input.body !== undefined) {
      if (!input.body.trim()) throw new BadRequestException('The note needs a body.');
      data.body = input.body.trim();
    }
    if (input.reviewedBy !== undefined) data.reviewedBy = input.reviewedBy?.trim() || null;
    // A published note must keep its reviewer and lose none of its review: edits that break either send it back to draft.
    const nextBody = (data.body as string | undefined) ?? existing.body;
    const nextReviewer = data.reviewedBy !== undefined ? (data.reviewedBy as string | null) : existing.reviewedBy;
    if (existing.status === 'published' && (!nextReviewer || nextBody.includes(REVIEWER_PLACEHOLDER))) {
      data.status = 'draft';
      data.publishedAt = null;
    }
    return view(await this.prisma.researchNote.update({ where: { id }, data }));
  }

  async publish(id: string): Promise<NoteView> {
    const n = await this.prisma.researchNote.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Note not found');
    if (!n.reviewedBy?.trim()) throw new BadRequestException('Name the person who reviewed this note, with their credentials, before publishing it.');
    if (n.body.includes(REVIEWER_PLACEHOLDER)) throw new BadRequestException('Replace the reviewer-commentary placeholder with your own analysis before publishing.');
    return view(await this.prisma.researchNote.update({ where: { id }, data: { status: 'published', publishedAt: n.publishedAt ?? new Date() } }));
  }

  async unpublish(id: string): Promise<NoteView> {
    const n = await this.prisma.researchNote.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Note not found');
    return view(await this.prisma.researchNote.update({ where: { id }, data: { status: 'draft', publishedAt: null } }));
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const n = await this.prisma.researchNote.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Note not found');
    await this.prisma.researchNote.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- public

  async listPublished(kind?: string): Promise<Omit<NoteView, 'facts' | 'body'>[]> {
    const rows = await this.prisma.researchNote.findMany({
      where: { status: 'published', ...(kind === 'FOCUS_LIST' || kind === 'BRIEF' ? { kind } : {}) },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => {
      const { facts: _f, body: _b, ...rest } = view(r);
      return rest;
    });
  }

  async getPublished(slug: string): Promise<NoteView> {
    const n = await this.prisma.researchNote.findUnique({ where: { slug } });
    if (!n || n.status !== 'published') throw new NotFoundException('Research note not found');
    return view(n);
  }

  async briefFor(ticker: string): Promise<NoteView> {
    return this.getPublished(`brief-${String(ticker).trim().toLowerCase()}`);
  }
}
