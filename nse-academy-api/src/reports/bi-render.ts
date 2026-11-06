// HTML and text for the business-intelligence parts of the daily report. Pure: data in, strings out.

import { escapeHtml } from '../brevo/email-template';
import { dataTable, sectionHeading, statRows } from '../brevo/email-blocks';
import { BusinessMetrics } from './business-metrics.service';
import { SystemReport } from './system-health.service';
import { EngagementMetrics } from './engagement-metrics.service';
import { EXPECTED_POLLS_PER_DAY, conversionPct, emailBounceRate, feedSuccessRate, trendNote } from './bi-rules';
import { formatKes } from './report-helpers';

const MUTED = '#71717a';
const GOOD = '#047857';
const BAD = '#b91c1c';
const WARN = '#b45309';

const usd = (n: number) => (n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const note = (t: string) => `<span style="font-size:12px;color:${MUTED};">${t}</span>`;
const MAX_JOB_ROWS = 8;
const jobProblems = (s: SystemReport) => s.jobs.filter((j) => j.status === 'failing' || j.status === 'overdue');

/** Four headline numbers across the top of the email. */
export function kpiStrip(b: BusinessMetrics | null, s: SystemReport | null, signupsDay: number): string {
  const cell = (label: string, value: string, sub: string, color = '#18181b') =>
    `<td width="25%" valign="top" style="padding:12px 8px;border:1px solid #e4e4e7;background:#fafafa;">
      <div style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:${MUTED};">${label}</div>
      <div style="font-size:19px;font-weight:700;color:${color};padding:4px 0 2px;">${value}</div>
      <div style="font-size:12px;color:${MUTED};line-height:1.4;">${sub}</div></td>`;
  const cells: string[] = [];
  cells.push(
    b
      ? cell('Revenue', b.revenue.recordedSince ? formatKes(b.revenue.dayKes) : '-', b.revenue.recordedSince ? `${b.revenue.dayPayments} payment${b.revenue.dayPayments === 1 ? '' : 's'} &middot; ${formatKes(b.revenue.monthToDateKes)} this month` : 'ledger starts with the next payment')
      : cell('Revenue', '-', 'unavailable'),
  );
  cells.push(b ? cell('Paying members', String(b.recurring.activePaid), `MRR ${formatKes(b.recurring.mrrKes)}`) : cell('Paying members', '-', 'unavailable'));
  cells.push(cell('New signups', String(signupsDay), b ? trendNote(b.growth.signups7d, b.growth.signupsPrev7d).replace('on the week before', 'wk/wk') : ''));
  if (s) {
    const problems = jobProblems(s).length;
    cells.push(cell('Systems', problems ? `${problems} issue${problems === 1 ? '' : 's'}` : 'All clear', `${s.jobs.filter((j) => j.status === 'ok').length} of ${s.jobs.length} jobs on schedule`, problems ? BAD : GOOD));
  } else {
    cells.push(cell('Systems', '-', 'unavailable'));
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0" style="margin:0 0 8px;border-collapse:separate;"><tr>${cells.join('')}</tr></table>`;
}

export function businessHtml(b: BusinessMetrics): string {
  const f = b.funnel;
  const funnelRows = [
    ['Signed up', f.signups, '100%'],
    ['Completed the investor profile', f.profiled, conversionPct(f.profiled, f.signups)],
    ['Set up a portfolio (trade or import)', f.activated, conversionPct(f.activated, f.signups)],
    ['Paying today', f.paying, conversionPct(f.paying, f.signups)],
  ].map(([label, n, rate]) => [escapeHtml(String(label)), String(n), String(rate)]);

  return [
    sectionHeading('Business', 'revenue, growth and retention'),
    statRows([
      { label: 'Subscription revenue yesterday', value: b.revenue.recordedSince ? formatKes(b.revenue.dayKes) : '-', note: b.revenue.recordedSince ? `${b.revenue.dayPayments} payment${b.revenue.dayPayments === 1 ? '' : 's'}` : undefined },
      { label: 'Subscription revenue this month', value: b.revenue.recordedSince ? formatKes(b.revenue.monthToDateKes) : '-', note: b.revenue.recordedSince ? `${formatKes(b.revenue.last30DaysKes)} over the last 30 days` : 'no payments recorded yet' },
      { label: 'Monthly recurring revenue', value: formatKes(b.recurring.mrrKes), note: `at list price; ${formatKes(b.recurring.arrKes)} a year` },
      { label: 'Paying members', value: b.recurring.activePaid, note: `${b.recurring.premium} premium, ${b.recurring.intermediary} intermediary` },
      { label: 'Signups, last 7 days', value: b.growth.signups7d, note: trendNote(b.growth.signups7d, b.growth.signupsPrev7d) },
      { label: 'Lapsed yesterday', value: b.churn.lapsedDay, note: `${b.churn.lapsed30d} in the last 30 days` },
      { label: 'Renewing within 7 days', value: b.churn.expiringNext7 },
    ]) +
      (b.revenue.recordedSince ? `<p style="margin:4px 0 0;font-size:12px;color:${MUTED};">Revenue counts payments recorded since ${escapeHtml(b.revenue.recordedSince)}; earlier ones are in Paystack.</p>` : '') +
      `<p style="margin:16px 0 4px;font-size:14px;font-weight:700;">Signup funnel <span style="font-weight:400;color:${MUTED};">people who joined in the last ${f.windowDays} days</span></p>` +
      dataTable([{ header: 'Stage' }, { header: 'People', align: 'right' }, { header: 'Of signups', align: 'right' }], funnelRows) +
      `<p style="margin:16px 0 4px;font-size:14px;font-weight:700;">Product usage yesterday</p>` +
      statRows([
        { label: 'Trades logged', value: b.product.tradesLogged },
        { label: 'CDSC statements imported', value: b.product.statementsImported, note: b.product.statementsFailed ? `${b.product.statementsFailed} failed` : undefined },
        { label: 'Portfolio Watch alerts sent', value: b.product.portfolioWatchSent },
        { label: 'Price alerts created', value: b.product.alertsCreated },
        { label: 'Lessons completed', value: b.product.lessonsCompleted },
      ]),
  ].join('');
}

export function systemHtml(s: SystemReport): string {
  const bad = jobProblems(s);
  const noData = s.jobs.filter((j) => j.status === 'no-data').length;
  const ok = s.jobs.filter((j) => j.status === 'ok').length;

  const jobsHtml =
    `<p style="margin:0 0 8px;font-size:14px;color:#52525b;"><strong style="color:${bad.length ? BAD : GOOD};">${ok} of ${s.jobs.length}</strong> scheduled jobs ran on time${noData ? ` &middot; ${noData} not yet observed` : ''}.</p>` +
    (bad.length
      ? dataTable(
          [{ header: 'Job' }, { header: 'Status' }, { header: 'Detail' }],
          bad.slice(0, MAX_JOB_ROWS).map((j) => [`<strong>${escapeHtml(j.label)}</strong><br>${note(escapeHtml(j.schedule))}`, `<span style="color:${BAD};font-weight:700;">${j.status}</span>`, escapeHtml(j.problem ?? '')]),
        ) + (bad.length > MAX_JOB_ROWS ? `<p style="margin:0 0 8px;font-size:12px;color:${MUTED};">and ${bad.length - MAX_JOB_ROWS} more in the admin's System health page.</p>` : '')
      : '');

  const f = s.feed;
  const rate = feedSuccessRate(f);
  const topFail = Object.entries(f.failureReasons).sort((a, b) => b[1] - a[1]);
  const feedHtml = statRows([
    { label: 'Price polls that succeeded', value: rate === null ? 'none recorded' : `${Math.round(rate * 100)}%`, note: rate === null ? undefined : `${f.succeeded} of ${f.attempts}${topFail.length ? `; failures: ${topFail.map(([k, n]) => `${escapeHtml(k)} x${n}`).join(', ')}` : ''}` },
    { label: 'Price snapshots stored', value: f.snapshotsStored, note: `about ${EXPECTED_POLLS_PER_DAY} expected on a full trading day` },
    { label: 'Latest snapshot', value: f.lastSnapshotAt ? f.lastSnapshotAt.slice(0, 16).replace('T', ' ') + ' UTC' : 'none' },
  ]);

  const mr = s.marketReport;
  const reportLine = !mr.sessionYmd
    ? 'No trading session to report on.'
    : !mr.exists
      ? `<span style="color:${BAD};">No report exists for ${escapeHtml(mr.sessionYmd)}.</span>`
      : `${escapeHtml(mr.sessionYmd)}: <strong>${escapeHtml(mr.status ?? '')}</strong>, ${mr.aiGenerated ? `written by ${escapeHtml(mr.model ?? 'AI')}` : `<span style="color:${WARN};">template story (AI did not pass verification)</span>`}.`;

  const aiHtml = s.ai.calls
    ? dataTable(
        [{ header: 'AI feature / model' }, { header: 'Calls', align: 'right' }, { header: 'Verified', align: 'right' }, { header: 'Cost', align: 'right' }, { header: 'Avg time', align: 'right' }],
        [
          ...s.ai.rows.map((r) => [
            `${escapeHtml(r.feature)}<br>${note(escapeHtml(r.model ?? 'no model answered'))}`,
            `${r.calls}${r.failed ? ` <span style="color:${BAD};">(${r.failed} failed)</span>` : ''}`,
            r.verified + r.unverified ? `${r.verified}/${r.verified + r.unverified}` : '-',
            r.costUsd ? usd(r.costUsd) : '-',
            r.avgSeconds != null ? `${r.avgSeconds}s` : '-',
          ]),
          ['<strong>Total</strong>', `<strong>${s.ai.calls}</strong>`, '', `<strong>${usd(s.ai.costUsd)}</strong>`, ''],
        ],
      )
    : `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">No AI requests were made.</p>`;

  let emailHtml = '';
  if (s.email) {
    const e = s.email;
    const lost = e.hardBounces + e.softBounces + e.blocked + e.invalid;
    emailHtml = statRows([
      { label: 'Transactional emails sent', value: e.requests, note: `${e.delivered} delivered` },
      { label: 'Bounced or blocked', value: lost, note: e.requests ? `${(emailBounceRate(e) * 100).toFixed(1)}% of sent` : undefined },
      { label: 'Spam complaints', value: e.spamReports },
      { label: 'Opens / clicks', value: `${e.opens} / ${e.clicks}` },
    ]);
  } else {
    emailHtml = `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">Email delivery statistics were unavailable.</p>`;
  }
  const campaignHtml = s.campaigns.length
    ? `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Campaigns sent</p>` +
      dataTable(
        [{ header: 'Campaign' }, { header: 'Sent', align: 'right' }, { header: 'Opened', align: 'right' }, { header: 'Clicked', align: 'right' }, { header: 'Unsub', align: 'right' }],
        s.campaigns.map((c) => [
          escapeHtml(c.subject),
          String(c.sent),
          `${c.opens} (${conversionPct(c.opens, c.delivered || c.sent)})`,
          `${c.clicks} (${conversionPct(c.clicks, c.delivered || c.sent)})`,
          String(c.unsubscribed),
        ]),
      )
    : '';

  return [
    sectionHeading('System health', 'is everything running?'),
    jobsHtml,
    `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Market data feed</p>`,
    feedHtml,
    `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Public market report</p>`,
    `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">${reportLine}</p>`,
    `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">AI usage and cost</p>`,
    aiHtml,
    `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Email delivery</p>`,
    emailHtml,
    campaignHtml,
  ].join('');
}

export function engagementHtml(e: EngagementMetrics): string {
  const m = e.members;
  const t = e.traffic;
  const track = m.trackingSince ? `Member activity has been recorded since ${escapeHtml(m.trackingSince)} (${m.trackingDays} day${m.trackingDays === 1 ? '' : 's'}).` : 'Member activity tracking has just started; figures appear as members use the app.';

  const members =
    sectionHeading('Members and visitors', 'who is using the product') +
    statRows([
      { label: 'Members active yesterday', value: m.dau },
      { label: 'Active in the last 7 days', value: m.wau },
      { label: 'Active in the last 30 days', value: m.mau, note: m.stickinessPct != null ? `${m.stickinessPct}% of monthly members came back yesterday` : undefined },
    ]) +
    `<p style="margin:4px 0 0;font-size:12px;color:${MUTED};">${track}</p>`;

  const dormant = m.dormantPaying;
  const dormantHtml =
    dormant === null
      ? `<p style="margin:12px 0 0;font-size:12px;color:${MUTED};">"Paying but quiet" members will be listed once ${m.dormantDays} days of activity have been recorded.</p>`
      : dormant.length === 0
        ? `<p style="margin:12px 0 0;font-size:14px;color:#52525b;">Every paying member has used the app in the last ${m.dormantDays} days.</p>`
        : `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Paying members gone quiet <span style="font-weight:400;color:${MUTED};">no activity in ${m.dormantDays} days</span></p>` +
          dataTable(
            [{ header: 'Member' }, { header: 'Plan' }, { header: 'Last seen', align: 'right' }, { header: 'Ends', align: 'right' }],
            dormant.slice(0, 8).map((d) => [`${escapeHtml(d.name)}<br>${note(escapeHtml(d.email))}`, escapeHtml(d.tier), d.lastActiveAt ? d.lastActiveAt.slice(0, 10) : 'never', d.endsOn ?? '-']),
          );

  const web =
    `<p style="margin:16px 0 4px;font-size:14px;font-weight:700;">Website</p>` +
    statRows([
      { label: 'Visitors yesterday', value: t.day.visitors, note: `${t.day.pageViews} page view${t.day.pageViews === 1 ? '' : 's'}` },
      { label: 'Visitors, last 7 days', value: t.week.visitors, note: trendNote(t.week.visitors, t.previousWeek.visitors) },
      { label: 'Page views, last 7 days', value: t.week.pageViews, note: trendNote(t.week.pageViews, t.previousWeek.pageViews) },
    ]) +
    (t.week.sources.length
      ? `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Where visitors came from <span style="font-weight:400;color:${MUTED};">last 7 days</span></p>` +
        dataTable([{ header: 'Source' }, { header: 'Visitors', align: 'right' }, { header: 'Views', align: 'right' }], t.week.sources.slice(0, 6).map((s) => [escapeHtml(s.source), String(s.visitors), String(s.views)]))
      : '') +
    (t.week.signups.length
      ? `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Signups by source <span style="font-weight:400;color:${MUTED};">last 7 days</span></p>` +
        dataTable([{ header: 'Source' }, { header: 'Signups', align: 'right' }, { header: 'Paying now', align: 'right' }], t.week.signups.slice(0, 6).map((s) => [escapeHtml(s.source), String(s.signups), String(s.paying)]))
      : '') +
    (t.week.topPages.length
      ? `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Top pages <span style="font-weight:400;color:${MUTED};">last 7 days</span></p>` +
        dataTable([{ header: 'Page' }, { header: 'Visitors', align: 'right' }, { header: 'Views', align: 'right' }], t.week.topPages.slice(0, 6).map((p) => [escapeHtml(p.path), String(p.visitors), String(p.views)]))
      : t.week.pageViews === 0
        ? `<p style="margin:8px 0 0;font-size:12px;color:${MUTED};">No page views recorded yet. Visitor tracking starts counting once the website update is live.</p>`
        : '');

  const a = e.adminChanges;
  const admin =
    sectionHeading('Admin changes', 'the audit trail') +
    (a.total === 0
      ? `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">No changes were made in the admin yesterday.</p>`
      : `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">${a.total} change${a.total === 1 ? '' : 's'} by ${a.byActor.map((x) => `${escapeHtml(x.actor)} (${x.count})`).join(', ')}${a.failed ? `, <span style="color:${BAD};">${a.failed} failed</span>` : ''}.</p>` +
        dataTable([{ header: 'Who' }, { header: 'What' }], a.recent.map((r) => [escapeHtml(r.actor), `${escapeHtml(r.action)}${r.ok ? '' : ` <span style="color:${BAD};">(failed)</span>`}`])));

  return members + dormantHtml + web + admin;
}

/** The same story in plain text, for the text part of the email. */
export function biText(b: BusinessMetrics | null, s: SystemReport | null, e: EngagementMetrics | null = null): string[] {
  const out: string[] = [];
  if (b) {
    out.push(
      `BUSINESS: revenue yesterday ${b.revenue.recordedSince ? formatKes(b.revenue.dayKes) : 'n/a'} (${b.revenue.dayPayments} payments), month to date ${b.revenue.recordedSince ? formatKes(b.revenue.monthToDateKes) : 'n/a'}; ` +
        `${b.recurring.activePaid} paying members, MRR ${formatKes(b.recurring.mrrKes)}; signups last 7 days ${b.growth.signups7d} (${trendNote(b.growth.signups7d, b.growth.signupsPrev7d)}); ` +
        `${b.churn.lapsedDay} lapsed yesterday, ${b.churn.expiringNext7} renew within 7 days`,
    );
    out.push(`FUNNEL (last ${b.funnel.windowDays} days): ${b.funnel.signups} signed up, ${b.funnel.profiled} profiled (${conversionPct(b.funnel.profiled, b.funnel.signups)}), ${b.funnel.activated} set up a portfolio (${conversionPct(b.funnel.activated, b.funnel.signups)}), ${b.funnel.paying} paying (${conversionPct(b.funnel.paying, b.funnel.signups)})`);
  }
  if (s) {
    const bad = jobProblems(s);
    const rate = feedSuccessRate(s.feed);
    out.push(`SYSTEM: ${s.jobs.filter((j) => j.status === 'ok').length} of ${s.jobs.length} jobs on schedule${bad.length ? `; problems: ${bad.map((j) => `${j.label} (${j.status})`).join(', ')}` : ''}`);
    out.push(`FEED: ${rate === null ? 'no polls recorded' : `${Math.round(rate * 100)}% of polls succeeded (${s.feed.succeeded}/${s.feed.attempts})`}, ${s.feed.snapshotsStored} snapshots stored`);
    out.push(`AI: ${s.ai.calls} calls, ${s.ai.failed} failed, cost ${usd(s.ai.costUsd)}`);
    if (s.email) out.push(`EMAIL: ${s.email.requests} sent, ${s.email.delivered} delivered, ${s.email.hardBounces + s.email.softBounces + s.email.blocked + s.email.invalid} bounced/blocked, ${s.email.spamReports} spam complaints`);
  }
  if (e) {
    out.push(`MEMBERS: ${e.members.dau} active yesterday, ${e.members.wau} in 7 days, ${e.members.mau} in 30 days${e.members.dormantPaying ? `; ${e.members.dormantPaying.length} paying members quiet for ${e.members.dormantDays} days` : ''}`);
    out.push(`WEBSITE: ${e.traffic.day.visitors} visitors yesterday (${e.traffic.day.pageViews} views); ${e.traffic.week.visitors} in 7 days (${trendNote(e.traffic.week.visitors, e.traffic.previousWeek.visitors)})${e.traffic.week.sources[0] ? `; top source ${e.traffic.week.sources[0].source}` : ''}`);
    out.push(`ADMIN CHANGES: ${e.adminChanges.total}${e.adminChanges.failed ? `, ${e.adminChanges.failed} failed` : ''}`);
  }
  return out;
}
