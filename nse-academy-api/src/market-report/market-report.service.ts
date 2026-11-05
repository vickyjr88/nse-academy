import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MarketReport, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNotifierService } from '../admin-notifier/admin-notifier.service';
import { escapeHtml } from '../brevo/email-template';
import { dataTable, quoteBlock, sectionHeading } from '../brevo/email-blocks';
import { MarketFacts } from './market-facts';
import { MarketFactsService } from './market-facts.service';
import { NarrativeService } from './narrative.service';
import { Lesson, Narrative, fillUrl } from './narrative';

export const CARD_COUNT = 5;

export interface PublicMarketReport {
  sessionYmd: string;
  label: string;
  url: string;
  headline: string;
  summary: string;
  story: string[];
  lessons: Lesson[];
  facts: MarketFacts;
  share: { xPost: string; xThread: string[]; whatsapp: string; caption: string; hashtags: string[] };
  aiGenerated: boolean;
  aiModel: string | null;
  publishedAt: string | null;
}

export interface PublicMarketReportSummary {
  sessionYmd: string;
  label: string;
  headline: string;
  summary: string;
  breadth: MarketFacts['breadth'];
  valueTradedKes: number;
  topGainer: { ticker: string; changePct: number } | null;
  topLoser: { ticker: string; changePct: number } | null;
  aiGenerated: boolean;
}

export interface GenerateOptions {
  /** Trading day YYYY-MM-DD. Defaults to the most recent session before now. */
  date?: string;
  /** Rebuild even if a report for that day exists. */
  force?: boolean;
  /** A human/editor-written narrative, held to the same verification as the AI's. */
  narrative?: unknown;
  /** Label recorded as the author of `narrative`, e.g. the model that drafted it. */
  narrativeAuthor?: string;
  /** Email the admin the share pack. */
  notify?: boolean;
}

@Injectable()
export class MarketReportService {
  private readonly logger = new Logger(MarketReportService.name);

  constructor(
    private prisma: PrismaService,
    private facts: MarketFactsService,
    private narratives: NarrativeService,
    private adminNotifier: AdminNotifierService,
    private config: ConfigService,
  ) {}

  /** 08:10 Nairobi, every day - before the 09:00 open, covering the last completed session. Idempotent. */
  @Cron('10 8 * * *', { timeZone: 'Africa/Nairobi' })
  async handleDaily(): Promise<void> {
    try {
      const ymd = await this.facts.latestSessionYmd(new Date());
      if (!ymd) {
        this.logger.warn('Daily market report skipped: no price data found');
        return;
      }
      const { created } = await this.generate({ date: ymd, notify: true });
      this.logger.log(created ? `Public market report for ${ymd} published` : `Public market report for ${ymd} already exists`);
    } catch (err) {
      this.logger.error(`Daily market report failed: ${(err as Error).message}`);
    }
  }

  async generate(opts: GenerateOptions = {}): Promise<{ report: MarketReport; created: boolean; note?: string; problems?: string[] }> {
    const ymd = opts.date ?? (await this.facts.latestSessionYmd(new Date()));
    if (!ymd) throw new NotFoundException('No price data available to build a report from');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new BadRequestException('date must be YYYY-MM-DD');

    const existing = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    if (existing && !opts.force) return { report: existing, created: false };

    const facts = await this.facts.build(ymd);

    let narrative: Narrative;
    let aiGenerated: boolean;
    let aiModel: string | null;
    let note: string | undefined;
    let problems: string[] | undefined;
    if (opts.narrative !== undefined) {
      const checked = this.narratives.validate(opts.narrative, facts);
      if (!checked.narrative) {
        throw new BadRequestException({ message: 'The supplied narrative failed verification against the facts', problems: checked.problems });
      }
      narrative = checked.narrative;
      aiGenerated = true;
      aiModel = opts.narrativeAuthor ?? 'editor';
    } else {
      const result = await this.narratives.write(facts);
      narrative = result.narrative;
      aiGenerated = result.aiGenerated;
      aiModel = result.model;
      note = result.note;
      problems = result.problems;
    }

    const data = {
      facts: facts as unknown as Prisma.InputJsonValue,
      story: { headline: narrative.headline, summary: narrative.summary, story: narrative.story, lessons: narrative.lessons } as unknown as Prisma.InputJsonValue,
      social: narrative.social as unknown as Prisma.InputJsonValue,
      aiGenerated,
      aiModel,
    };
    const report = await this.prisma.marketReport.upsert({
      where: { sessionDate: ymd },
      create: { sessionDate: ymd, status: 'published', publishedAt: new Date(), ...data },
      update: { ...data, status: 'published', publishedAt: existing?.publishedAt ?? new Date() },
    });

    if (opts.notify) void this.emailSharePack(report);
    return { report, created: !existing, note, problems };
  }

  // ------------------------------------------------------------- public reads

  private siteUrl(): string {
    return (this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net').replace(/\/$/, '');
  }

  async listPublic(limit = 30): Promise<PublicMarketReportSummary[]> {
    const rows = await this.prisma.marketReport.findMany({
      where: { status: 'published' },
      orderBy: { sessionDate: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((r) => {
      const facts = r.facts as unknown as MarketFacts;
      const story = r.story as unknown as { headline: string; summary: string };
      const g = facts.gainers[0];
      const l = facts.losers[0];
      return {
        sessionYmd: r.sessionDate,
        label: facts.label,
        headline: story.headline,
        summary: story.summary,
        breadth: facts.breadth,
        valueTradedKes: facts.valueTradedKes,
        topGainer: g ? { ticker: g.ticker, changePct: g.changePct } : null,
        topLoser: l ? { ticker: l.ticker, changePct: l.changePct } : null,
        aiGenerated: r.aiGenerated,
      };
    });
  }

  async getPublic(ymd: string): Promise<PublicMarketReport> {
    const row = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    if (!row || row.status !== 'published') throw new NotFoundException('Report not found');
    return this.toPublic(row);
  }

  async getLatestPublic(): Promise<PublicMarketReport> {
    const row = await this.prisma.marketReport.findFirst({ where: { status: 'published' }, orderBy: { sessionDate: 'desc' } });
    if (!row) throw new NotFoundException('No reports published yet');
    return this.toPublic(row);
  }

  private toPublic(row: MarketReport): PublicMarketReport {
    const facts = row.facts as unknown as MarketFacts;
    const story = row.story as unknown as { headline: string; summary: string; story: string[]; lessons: Lesson[] };
    const social = row.social as unknown as Narrative['social'];
    const url = `${this.siteUrl()}/market-report/${row.sessionDate}`;
    const filled = fillUrl({ ...story, social }, url).social;
    return {
      sessionYmd: row.sessionDate,
      label: facts.label,
      url,
      headline: story.headline,
      summary: story.summary,
      story: story.story,
      lessons: story.lessons,
      facts,
      // The reel script stays admin-side: it is for you, not a reading page.
      share: { xPost: filled.xPost, xThread: filled.xThread, whatsapp: filled.whatsapp, caption: filled.caption, hashtags: filled.hashtags },
      aiGenerated: row.aiGenerated,
      aiModel: row.aiModel,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  // ------------------------------------------------------------------- admin

  async getAdmin(ymd: string) {
    const row = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    if (!row) throw new NotFoundException('Report not found');
    return { ...row, shareUrl: `${this.siteUrl()}/market-report/${ymd}` };
  }

  async setStatus(ymd: string, status: 'published' | 'unpublished') {
    const row = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    if (!row) throw new NotFoundException('Report not found');
    return this.prisma.marketReport.update({
      where: { sessionDate: ymd },
      data: { status, publishedAt: status === 'published' ? row.publishedAt ?? new Date() : row.publishedAt },
    });
  }

  /** The morning email: the page is live, and everything needed to post it. */
  private async emailSharePack(row: MarketReport): Promise<void> {
    const r = this.toPublic(row);
    const social = fillUrl(
      { ...(row.story as unknown as Narrative), social: row.social as unknown as Narrative['social'] } as Narrative,
      r.url,
    ).social;
    const base = this.siteUrl();
    const cardLinks = Array.from({ length: CARD_COUNT }, (_, i) => `${base}/market-report/${r.sessionYmd}/card/${i + 1}`);

    const scenes = dataTable(
      [{ header: '#' }, { header: 'On screen' }, { header: 'Voiceover' }],
      social.reel.scenes.map((s, i) => [String(i + 1), escapeHtml(s.onScreen), escapeHtml(s.voiceover)]),
    );
    const rawHtml =
      sectionHeading('WhatsApp channel', 'copy and paste') + quoteBlock(social.whatsapp) +
      sectionHeading('X post') + quoteBlock(social.xPost) +
      sectionHeading('X thread') + social.xThread.map((t) => quoteBlock(t)).join('') +
      sectionHeading('Reel / Short script', 'about 40 seconds') +
      `<p style="margin:0 0 10px;font-size:14px;"><strong>Hook:</strong> ${escapeHtml(social.reel.hook)}</p>` +
      scenes +
      `<p style="margin:10px 0 0;font-size:14px;"><strong>Closing line:</strong> ${escapeHtml(social.reel.cta)}</p>` +
      sectionHeading('Caption and hashtags') + quoteBlock(`${social.caption}\n\n${social.hashtags.join(' ')}`) +
      sectionHeading('Reel cards', '1080 x 1920, save as images') +
      `<p style="margin:0;font-size:14px;line-height:1.9;">${cardLinks.map((u, i) => `<a href="${u}" style="color:#047857;">Card ${i + 1}</a>`).join(' &nbsp;&middot;&nbsp; ')}</p>`;

    await this.adminNotifier.notify({
      subject: `Market report is live: ${r.facts.shortLabel} - ready to share`,
      eyebrow: 'Public Report Live',
      heading: r.headline,
      bodyHtml: [
        escapeHtml(r.summary),
        r.aiGenerated
          ? `<span style="font-size:14px;color:#52525b;">Story written by AI (${escapeHtml(row.aiModel ?? 'AI')}) and checked against the numbers.</span>`
          : `<span style="font-size:14px;color:#b45309;">The AI was not used for this one, so it carries the standard template story. See the admin note if you expected an AI story.</span>`,
      ],
      rawHtml,
      button: { label: 'View the public page', url: r.url },
      bodyText: [
        r.headline,
        r.summary,
        `Public page: ${r.url}`,
        `WHATSAPP:\n${social.whatsapp}`,
        `X POST:\n${social.xPost}`,
        `X THREAD:\n${social.xThread.join('\n---\n')}`,
        `REEL: ${social.reel.hook}\n${social.reel.scenes.map((s, i) => `${i + 1}. [${s.onScreen}] ${s.voiceover}`).join('\n')}\n${social.reel.cta}`,
        `CAPTION:\n${social.caption}\n${social.hashtags.join(' ')}`,
        `CARDS:\n${cardLinks.join('\n')}`,
      ],
      tags: ['market-report'],
    });
  }
}
