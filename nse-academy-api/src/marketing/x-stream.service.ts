import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XService } from './x.service';
import { XComposeService } from './x-compose';
import { XAutomationService } from './x-automation.service';
import { nairobiClock } from './x-slot';
import { parseStreamLine, ruleDiff, searchQueryFromRules, spendAllows, spendBuckets, streamCommentary, ExistingRule } from './x-stream-logic';

/**
 * Budgeted reader. One filtered-stream connection while `streamEnabled` is on,
 * plus one recent-search backfill per Nairobi day. Matches become drafts, never live posts.
 * No tweet fields and no expansions: those are billed on top of the per-post price.
 */
@Injectable()
export class XStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XStreamService.name);
  private stopped = false;
  private connected = false;
  private backfilledDay: string | null = null;
  private abort: AbortController | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private xService: XService,
    private compose: XComposeService,
    private automation: XAutomationService,
  ) {}

  onModuleInit(): void {
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.abort?.abort();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(() => {
        this.timer = null;
        resolve();
      }, ms);
    });
  }

  private async loop(): Promise<void> {
    let backoff = 5_000;
    while (!this.stopped) {
      try {
        const config = await this.automation.getConfig();
        if (!config.streamEnabled) {
          this.connected = false;
          await this.sleep(60_000);
          continue;
        }
        const clock = nairobiClock(new Date());
        if (!(await this.underCap(config.streamDailyPostCap, config.streamMonthlyUsdCap, config.streamUnitUsd, clock.ymd))) {
          this.connected = false;
          this.logger.warn('X read cap reached. The stream stays disconnected until the cap window moves.');
          await this.sleep(15 * 60_000);
          continue;
        }
        const credentialId = await this.automation.resolveCredentialId(config);
        if (!credentialId) {
          this.logger.warn('Stream is on but no X account is selected.');
          await this.sleep(60_000);
          continue;
        }
        await this.maybeBackfill(credentialId, config.streamRules, clock.ymd, config);
        if (config.streamRules.length === 0) {
          await this.sleep(60_000);
          continue;
        }
        await this.syncRules(credentialId, config.streamRules);
        await this.connect(credentialId, config);
        backoff = 5_000;
      } catch (err) {
        this.connected = false;
        if (this.stopped) return;
        this.logger.warn(`X stream paused: ${(err as Error).message}`);
        await this.sleep(backoff);
        backoff = Math.min(backoff * 2, 5 * 60_000);
      }
    }
  }

  private async underCap(dailyPostCap: number, monthlyUsdCap: number, unitUsd: number, ymd: string): Promise<boolean> {
    const buckets = spendBuckets(ymd);
    const [day, month] = await Promise.all([
      this.prisma.xReadSpend.findUnique({ where: { bucket: buckets.day } }),
      this.prisma.xReadSpend.findUnique({ where: { bucket: buckets.month } }),
    ]);
    return spendAllows({ todayPosts: day?.posts ?? 0, monthUsd: month?.usd ?? 0, dailyPostCap, monthlyUsdCap, unitUsd });
  }

  private async charge(ymd: string, unitUsd: number, posts: number): Promise<void> {
    const buckets = spendBuckets(ymd);
    for (const bucket of [buckets.day, buckets.month]) {
      await this.prisma.xReadSpend.upsert({
        where: { bucket },
        create: { bucket, posts, usd: unitUsd * posts },
        update: { posts: { increment: posts }, usd: { increment: unitUsd * posts } },
      });
    }
  }

  private async maybeBackfill(
    credentialId: string,
    rules: { tag: string; value: string }[],
    ymd: string,
    config: { streamDailyPostCap: number; streamMonthlyUsdCap: number; streamUnitUsd: number },
  ): Promise<void> {
    if (this.backfilledDay === ymd) return;
    const query = searchQueryFromRules(rules);
    if (!query) {
      this.backfilledDay = ymd;
      return;
    }
    const cursor = await this.prisma.xStreamCursor.findUnique({ where: { id: 'default' } });
    const queryParams: Record<string, string> = { query, max_results: '10' };
    if (cursor?.sinceId) queryParams.since_id = cursor.sinceId;
    const page = await this.xService.bearerRequest<{ data?: { id: string; text: string }[]; meta?: { newest_id?: string } }>(
      credentialId,
      'GET',
      '/tweets/search/recent',
      { query: queryParams },
    );
    const posts = page.data ?? [];
    let fresh = 0;
    for (const post of posts) {
      const stored = await this.storeItem(post.id, post.text, 'backfill', credentialId, true);
      if (stored) fresh += 1;
    }
    if (fresh > 0) await this.charge(ymd, config.streamUnitUsd, fresh);
    const newest = page.meta?.newest_id ?? posts[0]?.id;
    if (newest) {
      await this.prisma.xStreamCursor.upsert({ where: { id: 'default' }, create: { id: 'default', sinceId: newest }, update: { sinceId: newest } });
    }
    this.backfilledDay = ymd;
    if (fresh > 0) this.logger.log(`Recent search backfill stored ${fresh} post${fresh === 1 ? '' : 's'}.`);
  }

  private async syncRules(credentialId: string, desired: { tag: string; value: string }[]): Promise<void> {
    const current = await this.xService.bearerRequest<{ data?: ExistingRule[] }>(credentialId, 'GET', '/tweets/search/stream/rules');
    const diff = ruleDiff(desired, current.data ?? []);
    if (diff.deleteIds.length) {
      await this.xService.bearerRequest(credentialId, 'POST', '/tweets/search/stream/rules', { json: { delete: { ids: diff.deleteIds } } });
    }
    if (diff.add.length) {
      await this.xService.bearerRequest(credentialId, 'POST', '/tweets/search/stream/rules', {
        json: { add: diff.add.map((rule) => ({ value: rule.value, tag: rule.tag })) },
      });
    }
  }

  private async connect(credentialId: string, config: { streamDailyPostCap: number; streamMonthlyUsdCap: number; streamUnitUsd: number }): Promise<void> {
    const token = await this.xService.bearerTokenFor(credentialId);
    this.abort = new AbortController();
    const response = await fetch('https://api.twitter.com/2/tweets/search/stream', {
      headers: { Authorization: `Bearer ${token}` },
      signal: this.abort.signal,
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`X stream ${response.status}: ${detail.slice(0, 200)}`);
    }
    this.connected = true;
    this.logger.log('X filtered stream connected.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let breakAt = buffer.indexOf('\n');
        while (breakAt >= 0) {
          const line = buffer.slice(0, breakAt);
          buffer = buffer.slice(breakAt + 1);
          const stop = await this.onLine(line, credentialId, config);
          if (stop) {
            this.abort.abort();
            return;
          }
          breakAt = buffer.indexOf('\n');
        }
      }
    } finally {
      this.connected = false;
    }
  }

  /** True when the caller should drop the connection (cap hit or a fatal stream error). */
  private async onLine(
    line: string,
    credentialId: string,
    config: { streamDailyPostCap: number; streamMonthlyUsdCap: number; streamUnitUsd: number },
  ): Promise<boolean> {
    const parsed = parseStreamLine(line);
    if (!parsed) return false;
    if ('error' in parsed) throw new Error(parsed.error);
    const ymd = nairobiClock(new Date()).ymd;
    if (!(await this.underCap(config.streamDailyPostCap, config.streamMonthlyUsdCap, config.streamUnitUsd, ymd))) return true;
    const draft = parsed.tag === 'official' || parsed.tag === 'desk';
    const stored = await this.storeItem(parsed.id, parsed.text, parsed.tag, credentialId, draft);
    if (stored) await this.charge(ymd, config.streamUnitUsd, 1);
    return false;
  }

  /** False when this tweet id was already stored, so a backfill does not bill it twice. */
  private async storeItem(externalId: string, text: string, tag: string | null, credentialId: string, draft: boolean): Promise<boolean> {
    try {
      const row = await this.prisma.xStreamItem.create({ data: { externalId, text, ruleTag: tag } });
      if (!draft) return true;
      const fallback = streamCommentary(tag);
      const commentary = await this.compose.rewrite(fallback, `${text}\n${fallback}`, 'stream', `stream:${tag ?? 'untagged'}`);
      try {
        const saved = await this.xService.saveDraft({ credentialId, content: commentary, reportType: 'stream', quoteTweetId: externalId });
        await this.prisma.xStreamItem.update({ where: { id: row.id }, data: { draftPostId: saved.id } });
      } catch (err) {
        this.logger.warn(`Stored stream post ${externalId} but could not draft a reply: ${(err as Error).message}`);
      }
      return true;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return false;
      throw err;
    }
  }
}
