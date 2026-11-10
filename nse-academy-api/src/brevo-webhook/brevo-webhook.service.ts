import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LifecycleFlow } from '../lifecycle/lifecycle.service';
import { EmailSuppressionService, SUPPRESSING_EVENTS } from '../email-suppression/email-suppression.service';

/**
 * Maps the Brevo `tags` value sent with each transactional email (see the
 * `tags: [...]` argument on every `brevo.sendTransactional` call across
 * lifecycle.service.ts and payments.service.ts) back to the FlowEntry.flow
 * value it corresponds to. These two vocabularies were never the same
 * string on purpose - the Brevo tag is a delivery-analytics label visible
 * in Brevo's own dashboard, independent of this app's internal flow names -
 * so this table is the one place that reconciles them.
 *
 * Only tags for flows that actually write FlowEntry rows are listed here.
 * subscription-confirmed and subscription-expiring-soon, for example, are
 * real Brevo tags sent by PaymentsService but have no corresponding
 * FlowEntry - a click on those emails is simply not recorded (yet), not an
 * error.
 */
const BREVO_TAG_TO_FLOW: Record<string, LifecycleFlow> = {
  'lifecycle-day1': 'day1-nurture',
  'lifecycle-day7': 'day7-nurture',
  'lifecycle-day14': 'day14-nurture',
  'corporate-license-expiring-soon': 'corporate-expiry-warning',
  'subscription-renewal-nudge': 'renewal-nudge',
  'subscription-winback': 'winback',
  'referral-nudge': 'referral-nudge',
};

export interface BrevoWebhookEvent {
  event: string; // 'delivered' | 'opened' | 'click' | 'hard_bounce' | 'soft_bounce' | 'spam' | 'unsubscribed' | ...
  email?: string;
  tags?: string[];
  link?: string; // present on 'click' events
  date?: string;
}

@Injectable()
export class BrevoWebhookService {
  private readonly logger = new Logger(BrevoWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private suppression: EmailSuppressionService,
  ) {}

  /**
   * Brevo can batch multiple events in one POST (an array) or send one
   * object per request depending on how the webhook is configured - handle
   * both rather than assuming.
   */
  async handleEvent(payload: BrevoWebhookEvent | BrevoWebhookEvent[]): Promise<{ processed: number; matched: number }> {
    const events = Array.isArray(payload) ? payload : [payload];
    let matched = 0;
    for (const event of events) {
      if (await this.handleSingleEvent(event)) matched++;
    }
    return { processed: events.length, matched };
  }

  private async handleSingleEvent(rawEvent: BrevoWebhookEvent): Promise<boolean> {
    // A hard bounce, block, spam complaint, unsubscribe or invalid address means every further send to it only harms
    // our reputation, so it goes on the suppression list the sender checks. Soft bounces (a full mailbox, a server
    // that is down) are temporary and are left alone.
    const reason = SUPPRESSING_EVENTS[rawEvent.event];
    if (reason && rawEvent.email) {
      try {
        await this.suppression.suppress(rawEvent.email, reason);
        this.logger.log(`Suppressed ${rawEvent.email} after a Brevo ${rawEvent.event} event`);
        return true;
      } catch (err) {
        this.logger.error(`Could not suppress ${rawEvent.email}: ${(err as Error).message}`);
        return false;
      }
    }

    // Brevo reports a first open as "unique_opened"; the funnel only needs to know it happened.
    const event: BrevoWebhookEvent = rawEvent.event === 'unique_opened' ? { ...rawEvent, event: 'opened' } : rawEvent;
    if (event.event !== 'opened' && event.event !== 'click') {
      // Every other event type (delivered, deferred, soft_bounce...) is acknowledged without comment: Brevo sends all
      // of them once a webhook exists, not just the ones we act on.
      return false;
    }
    if (!event.email || !event.tags?.length) {
      this.logger.warn(`Brevo ${event.event} event missing email or tags - cannot match to a FlowEntry`);
      return false;
    }

    const flow = event.tags.map((t) => BREVO_TAG_TO_FLOW[t]).find(Boolean);
    if (!flow) {
      // Expected for tags with no FlowEntry equivalent (see the comment on
      // BREVO_TAG_TO_FLOW) - not every transactional email is flow-tracked.
      return false;
    }

    const user = await this.prisma.user.findUnique({ where: { email: event.email.toLowerCase() }, select: { id: true } });
    if (!user) {
      this.logger.warn(`Brevo ${event.event} event for ${event.email} - no matching user, ignoring`);
      return false;
    }

    // Most recent sent FlowEntry for this user+flow - opens/clicks always
    // refer to the last email of that type actually delivered, since a
    // user only gets each flow's email once per eligibility window (the
    // sentAt dedupe on the owning row guarantees that).
    const entry = await this.prisma.flowEntry.findFirst({
      where: { userId: user.id, flow, outcome: 'sent' },
      orderBy: { enteredAt: 'desc' },
    });
    if (!entry) {
      this.logger.warn(`Brevo ${event.event} event for ${event.email}/${flow} - no matching sent FlowEntry, ignoring`);
      return false;
    }

    const eventTime = event.date ? new Date(event.date) : new Date();
    if (event.event === 'opened' && !entry.openedAt) {
      await this.prisma.flowEntry.update({ where: { id: entry.id }, data: { openedAt: eventTime } });
    } else if (event.event === 'click') {
      // A click implies the email was opened, even if Brevo's separate
      // "opened" event was lost/deduped upstream (a known quirk of some
      // mail clients that prefetch links without firing an open pixel) -
      // backfill openedAt here too so the funnel doesn't show a click
      // without a corresponding open.
      await this.prisma.flowEntry.update({
        where: { id: entry.id },
        data: {
          openedAt: entry.openedAt ?? eventTime,
          clickedAt: entry.clickedAt ?? eventTime,
          clickedUrl: entry.clickedUrl ?? event.link ?? null,
        },
      });
    }
    return true;
  }
}
