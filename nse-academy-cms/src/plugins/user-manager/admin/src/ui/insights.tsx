import React, { useEffect, useState } from 'react';
import { Button } from '@strapi/design-system';
import { adminFetch } from '../pages/_ops';
import { useApi } from './api';
import { Kpi, KpiSkeleton } from './kpi';
import { AreaTrend, Bars, Donut, Funnel, RankBars } from './charts';
import { Card, CardHead, EmptyState, Grid, Row, Skeleton, Split } from './primitives';
import { kes, kesCompact, shortDay, whole } from './format';
import { usePalette } from './theme';

/** The shape of GET /admin/analytics that the pages use. Every field is optional so one missing block never blanks a page. */
interface Analytics {
  overview?: { totalUsers: number; newUsersThisMonth: number; newUsersLastMonth: number; activeSubscriptions: number; cancelledSubscriptions: number; tierBreakdown: { free: number; intermediary: number; premium: number }; estimatedMRR: number };
  lessonProgress?: { totalCompletions: number; uniqueLearners: number; topLessons: { lessonId: string; completions: number }[] };
  referrals?: { total: number; completed: number; pending: number; conversionRate: number; topReferrers: { userId: string; name: string; email: string; referralCount: number }[] };
  investorProfiles?: { total: number; byType: Record<string, number>; byCapitalRange: Record<string, number>; avgRiskScore: number };
  journalFeatures?: {
    trades: { total: number; buy: number; sell: number; usersWithTrades: number; topTickers: { ticker: string; count: number }[] };
    portfolio: { aggregateCostBasisKes: number };
    priceAlerts: { total: number; pending: number; triggered: number; cancelled: number; usersWithAlerts: number };
    dividends: { total: number; totalAmountKes: number; manual: number; cdscImport: number };
    realizedGains: { totalKes: number; closedPositions: number };
    statementImports: { total: number; completed: number; failed: number };
  };
  advisorFeatures?: {
    advisors: { total: number; pending: number; approved: number; suspended: number };
    clients: { totalConnections: number; accepted: number; pending: number; declined: number };
    queries: { total: number; open: number; answered: number; avgResponseHours: number | null };
    insights: { total: number; emailedCount: number };
    alerts: { total: number; buy: number; sell: number; totalRecipients: number };
  };
  subscriptionTrend?: { month: string; active: number; cancelled: number }[];
  googleAnalytics?: { totalActiveUsers: number; totalPageViews: number; avgBounceRate: number; dailyStats: { date: string; users: number; views: number }[] } | null;
  ebookFeatures?: { totalPurchases: number; totalRevenueKes: number; guestPurchases: number; accountPurchases: number };
  contactFeatures?: { totalSubmissions: number; new: number; read: number; replied: number };
}

// The analytics call computes a lot, and several pages want it; share one answer for a minute.
let cached: { at: number; promise: Promise<Analytics> } | null = null;
function loadAnalytics(): Promise<Analytics> {
  if (cached && Date.now() - cached.at < 60_000) return cached.promise;
  const promise = adminFetch<Analytics>('/admin/analytics');
  cached = { at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

function useAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadAnalytics().then((d) => live && setData(d)).catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}

interface Series {
  total: number;
  previousTotal: number;
  change: number | null;
  value: number;
  series: { day: string; count: number; value: number }[];
}
const useSeries = (metric: string, days = 30) => useApi<Series>(`/admin/metrics/series?metric=${metric}&days=${days}`);

const Loading = () => (
  <Grid $min={200}>
    {[0, 1, 2, 3].map((i) => (
      <KpiSkeleton key={i} />
    ))}
  </Grid>
);

/** A trend card for one daily series. */
function Trend({ title, hint, metric, label, days = 30, valueFormat }: { title: string; hint?: string; metric: string; label: string; days?: number; valueFormat?: (n: number) => string }) {
  const { data } = useSeries(metric, days);
  return (
    <Card>
      <CardHead title={title} hint={hint} right={data ? <span style={{ fontWeight: 700 }}>{valueFormat ? valueFormat(data.value) : whole(data.total)}</span> : null} />
      {data ? <AreaTrend data={data.series} series={[{ key: valueFormat ? 'value' : 'count', label }]} height={190} format={valueFormat} /> : <Skeleton $h={190} />}
    </Card>
  );
}

export type InsightKind = 'revenue' | 'health' | 'users' | 'profiles' | 'lessons' | 'referrals' | 'advisors' | 'ebooks' | 'inbox' | 'leads' | 'prices' | 'portfolio';

/** Headline figures and charts for a data page, shown above its table. */
export function Insights({ kind }: { kind: InsightKind }) {
  const a = useAnalytics();
  const p = usePalette();
  const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 };

  if (kind === 'revenue') return <div style={wrap}><RevenueInsights /></div>;
  if (kind === 'health') return <div style={wrap}><HealthInsights /></div>;
  if (kind === 'prices') return <div style={wrap}><PriceInsights /></div>;
  if (kind === 'leads') return <div style={wrap}><LeadInsights /></div>;
  if (!a.data && !a.error) return <div style={wrap}><Loading /></div>;
  if (!a.data) return <div style={wrap}><Card><EmptyState title="Charts are unavailable">{a.error}</EmptyState></Card></div>;
  const d = a.data;

  if (kind === 'users' && d.overview) {
    const o = d.overview;
    const t = o.tierBreakdown;
    const change = o.newUsersLastMonth ? Math.round(((o.newUsersThisMonth - o.newUsersLastMonth) / o.newUsersLastMonth) * 1000) / 10 : null;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Members" value={whole(o.totalUsers)} />
          <Kpi label="New this month" value={whole(o.newUsersThisMonth)} delta={change} deltaNote="vs last month" />
          <Kpi label="Paying members" value={whole(o.activeSubscriptions)} hint={`${whole(o.cancelledSubscriptions)} ended`} />
          <Kpi label="Monthly recurring revenue" value={kes(o.estimatedMRR)} hint="list price" />
        </Grid>
        <Split>
          <Trend title="Sign-ups" hint="New members per day, last 30 days." metric="signups" label="New members" />
          <Card>
            <CardHead title="Plans" />
            <Donut centerLabel="members" data={[{ name: 'Free', value: t.free, color: p.border }, { name: 'Intermediary', value: t.intermediary, color: p.series[1] }, { name: 'Premium', value: t.premium, color: p.series[0] }]} />
          </Card>
        </Split>
      </div>
    );
  }

  if (kind === 'profiles' && d.investorProfiles) {
    const ip = d.investorProfiles;
    const types = Object.entries(ip.byType).map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }));
    const top = [...types].sort((x, y) => y.count - x.count)[0];
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Profiles taken" value={whole(ip.total)} />
          <Kpi label="Average risk score" value={`${ip.avgRiskScore}/100`} />
          <Kpi label="Most common type" value={top?.name ?? '–'} hint={top ? `${whole(top.count)} members` : undefined} />
        </Grid>
        <Split $ratio="1fr 1fr">
          <Card><CardHead title="Investor types" /><Bars data={types} series={[{ key: 'count', label: 'Members' }]} colorByPoint height={210} /></Card>
          <Card><CardHead title="How much they have to invest" hint="Capital range members chose." /><Donut data={Object.entries(ip.byCapitalRange).map(([name, value]) => ({ name, value }))} centerLabel="profiles" /></Card>
        </Split>
        <Trend title="Profiles per day" metric="profiles" label="Profiles taken" />
      </div>
    );
  }

  if (kind === 'lessons' && d.lessonProgress) {
    const lp = d.lessonProgress;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Lessons completed" value={whole(lp.totalCompletions)} />
          <Kpi label="Members learning" value={whole(lp.uniqueLearners)} hint={lp.uniqueLearners ? `${(lp.totalCompletions / lp.uniqueLearners).toFixed(1)} lessons each` : undefined} />
        </Grid>
        <Split>
          <Trend title="Completions per day" metric="lessons" label="Lessons completed" />
          <Card><CardHead title="Most completed lessons" /><LessonRank items={lp.topLessons.slice(0, 6)} /></Card>
        </Split>
      </div>
    );
  }

  if (kind === 'referrals' && d.referrals) {
    const r = d.referrals;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Referrals" value={whole(r.total)} />
          <Kpi label="Became paying" value={whole(r.completed)} hint={`${whole(r.pending)} still pending`} />
          <Kpi label="Conversion" value={`${r.conversionRate}%`} />
        </Grid>
        <Split>
          <Trend title="Referrals per day" metric="referrals" label="New referrals" />
          <Card><CardHead title="Top referrers" /><RankBars items={r.topReferrers.slice(0, 6).map((t) => ({ label: t.name || t.email, value: t.referralCount }))} /></Card>
        </Split>
      </div>
    );
  }

  if (kind === 'advisors' && d.advisorFeatures) {
    const f = d.advisorFeatures;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Advisers" value={whole(f.advisors.total)} hint={f.advisors.pending ? `${f.advisors.pending} waiting for approval` : 'none waiting'} />
          <Kpi label="Client connections" value={whole(f.clients.totalConnections)} hint={`${whole(f.clients.accepted)} accepted`} />
          <Kpi label="Questions asked" value={whole(f.queries.total)} hint={`${whole(f.queries.open)} unanswered`} />
          <Kpi label="Average reply time" value={f.queries.avgResponseHours == null ? '–' : `${f.queries.avgResponseHours.toFixed(1)} h`} rise="bad" />
        </Grid>
        <Split $ratio="1fr 1fr">
          <Card><CardHead title="Adviser status" /><Donut centerLabel="advisers" data={[{ name: 'Approved', value: f.advisors.approved, color: p.success }, { name: 'Pending', value: f.advisors.pending, color: p.warning }, { name: 'Suspended', value: f.advisors.suspended, color: p.danger }]} /></Card>
          <Card><CardHead title="Do requests turn into clients?" /><Funnel steps={[{ label: 'Connection requests', value: f.clients.totalConnections }, { label: 'Accepted', value: f.clients.accepted }, { label: 'Members who asked a question', value: f.queries.total }]} /></Card>
        </Split>
        <Trend title="Questions per day" metric="questions" label="Questions asked" />
        <Card>
          <CardHead title="What advisers have published" />
          <Row $gap={28} $wrap style={{ color: p.text, fontSize: 14 }}>
            <span><strong>{whole(f.insights.total)}</strong> insights ({whole(f.insights.emailedCount)} emailed)</span>
            <span><strong>{whole(f.alerts.total)}</strong> alerts ({f.alerts.buy} buy · {f.alerts.sell} sell)</span>
            <span><strong>{whole(f.alerts.totalRecipients)}</strong> alert recipients</span>
          </Row>
        </Card>
      </div>
    );
  }

  if (kind === 'ebooks' && d.ebookFeatures) {
    const e = d.ebookFeatures;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Ebook sales" value={whole(e.totalPurchases)} />
          <Kpi label="Revenue" value={kes(e.totalRevenueKes)} />
          <Kpi label="Average sale" value={e.totalPurchases ? kes(e.totalRevenueKes / e.totalPurchases) : '–'} />
        </Grid>
        <Split>
          <Trend title="Ebook revenue" hint="Per day, last 30 days." metric="ebooks" label="Revenue" valueFormat={kesCompact} />
          <Card><CardHead title="Who buys" hint="Buyers with a member account against guests." /><Donut centerLabel="sales" data={[{ name: 'With an account', value: e.accountPurchases, color: p.series[0] }, { name: 'Guests', value: e.guestPurchases, color: p.series[1] }]} /></Card>
        </Split>
      </div>
    );
  }

  if (kind === 'inbox' && d.contactFeatures) {
    const c = d.contactFeatures;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Messages" value={whole(c.totalSubmissions)} />
          <Kpi label="Waiting to be read" value={whole(c.new)} rise="bad" hint={c.new ? 'someone is waiting for an answer' : 'inbox is clear'} />
          <Kpi label="Replied" value={`${c.totalSubmissions ? Math.round((c.replied / c.totalSubmissions) * 100) : 0}%`} hint={`${whole(c.replied)} of ${whole(c.totalSubmissions)}`} />
        </Grid>
        <Split $ratio="1fr 1fr">
          <Trend title="Messages per day" metric="contacts" label="Messages" />
          <Card><CardHead title="Status" /><Donut centerLabel="messages" data={[{ name: 'New', value: c.new, color: p.danger }, { name: 'Read', value: c.read, color: p.warning }, { name: 'Replied', value: c.replied, color: p.success }]} /></Card>
        </Split>
      </div>
    );
  }

  if (kind === 'portfolio' && d.journalFeatures) {
    const j = d.journalFeatures;
    return (
      <div style={wrap}>
        <Grid $min={200}>
          <Kpi label="Trades logged" value={whole(j.trades.total)} hint={`${whole(j.trades.usersWithTrades)} members`} />
          <Kpi label="Cost basis tracked" value={kes(j.portfolio.aggregateCostBasisKes)} />
          <Kpi label="Realised gains" value={kes(j.realizedGains.totalKes)} hint={`${whole(j.realizedGains.closedPositions)} closed positions`} />
          <Kpi label="Dividends logged" value={kes(j.dividends.totalAmountKes)} hint={`${whole(j.dividends.total)} entries`} />
        </Grid>
        <Split $ratio="1fr 1fr">
          <Trend title="Trades per day" metric="trades" label="Trades" />
          <Card><CardHead title="Most traded stocks" /><RankBars items={j.trades.topTickers.slice(0, 7).map((t) => ({ label: t.ticker, value: t.count }))} /></Card>
        </Split>
        <Split $ratio="1fr 1fr 1fr">
          <Card><CardHead title="Buys and sells" /><Donut centerLabel="trades" data={[{ name: 'Buy', value: j.trades.buy, color: p.success }, { name: 'Sell', value: j.trades.sell, color: p.danger }]} height={150} /></Card>
          <Card><CardHead title="Price alerts" hint={`${whole(j.priceAlerts.usersWithAlerts)} members use them`} /><Donut centerLabel="alerts" data={[{ name: 'Waiting', value: j.priceAlerts.pending, color: p.series[0] }, { name: 'Triggered', value: j.priceAlerts.triggered, color: p.success }, { name: 'Cancelled', value: j.priceAlerts.cancelled, color: p.border }]} height={150} /></Card>
          <Card><CardHead title="CDS statement imports" hint="Members seeding a portfolio from a PDF." /><Donut centerLabel="imports" data={[{ name: 'Worked', value: j.statementImports.completed, color: p.success }, { name: 'Failed', value: j.statementImports.failed, color: p.danger }]} height={150} /></Card>
        </Split>
      </div>
    );
  }

  return null;
}

function LessonRank({ items }: { items: { lessonId: string; completions: number }[] }) {
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    // Lesson titles live in Strapi's own content; fall back to the id if they cannot be read.
    fetch('/api/lessons?pagination[limit]=200')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return;
        const m: Record<string, string> = {};
        for (const l of j.data) m[l.documentId || String(l.id)] = l.title || l.attributes?.title || '';
        setTitles(m);
      })
      .catch(() => undefined);
  }, []);
  return <RankBars items={items.map((i) => ({ label: titles[i.lessonId] || `Lesson ${i.lessonId.slice(0, 8)}`, value: i.completions }))} />;
}

function LeadInsights() {
  const { data } = useSeries('leads');
  const stats = useApi<{ total?: number; byMagnet?: Record<string, number> | { slug: string; count: number }[]; converted?: number; conversionRate?: number }>('/leads/stats');
  return (
    <>
      <Grid $min={200}>
        {data ? <Kpi label="Leads, last 30 days" value={whole(data.total)} delta={data.change} spark={data.series.map((s) => s.count)} /> : <KpiSkeleton />}
        {stats.data?.total != null ? <Kpi label="Leads in all" value={whole(stats.data.total)} /> : null}
        {stats.data?.converted != null ? <Kpi label="Became members" value={whole(stats.data.converted)} hint={stats.data.total ? `${Math.round((stats.data.converted / stats.data.total) * 100)}% of leads` : undefined} /> : null}
      </Grid>
      <Trend title="New leads per day" metric="leads" label="Leads" />
    </>
  );
}

interface Price {
  ticker: string;
  name: string;
  price: number;
  volume: string;
  change: string;
}

function SyncPrices({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: true });
  const p = usePalette();
  const run = async () => {
    setState({ busy: true, msg: null, ok: true });
    try {
      const r = await adminFetch<{ message?: string }>('/market-data/sync', { method: 'POST' });
      setState({ busy: false, msg: r.message ?? 'Price refresh started.', ok: true });
      onDone();
    } catch (e) {
      setState({ busy: false, msg: (e as Error).message, ok: false });
    }
  };
  return (
    <Row $gap={12} $justify="flex-end">
      {state.msg ? <span style={{ fontSize: 13, color: state.ok ? p.success : p.danger }} role="status">{state.msg}</span> : null}
      <Button variant="secondary" size="S" onClick={run} disabled={state.busy}>
        {state.busy ? 'Refreshing…' : 'Refresh prices now'}
      </Button>
    </Row>
  );
}

function PriceInsights() {
  const { data, reload } = useApi<{ data: Price[] }>('/admin/stock-prices');
  const p = usePalette();
  if (!data) return <Loading />;
  const rows = data.data.map((r) => ({ ...r, move: parseFloat(String(r.change).replace(/[^0-9.+-]/g, '')) || 0 }));
  const up = rows.filter((r) => r.move > 0).length;
  const down = rows.filter((r) => r.move < 0).length;
  const flat = rows.length - up - down;
  const movers = [...rows].sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, 7);
  return (
    <>
      <SyncPrices onDone={reload} />
      <Grid $min={200}>
        <Kpi label="Counters tracked" value={whole(rows.length)} />
        <Kpi label="Rising today" value={whole(up)} />
        <Kpi label="Falling today" value={whole(down)} rise="bad" />
      </Grid>
      <Split $ratio="1fr 1fr">
        <Card><CardHead title="Market breadth" hint="How many counters rose, fell or did not move." /><Donut centerLabel="counters" data={[{ name: 'Rose', value: up, color: p.success }, { name: 'Fell', value: down, color: p.danger }, { name: 'Unchanged', value: flat, color: p.border }]} /></Card>
        <Card><CardHead title="Biggest movers" hint="Largest change since the previous close." /><RankBars format={(n) => `${n.toFixed(2)}%`} items={movers.map((m) => ({ label: m.ticker, sub: m.name, value: Math.abs(m.move) }))} /></Card>
      </Split>
    </>
  );
}

interface OverviewLite {
  paying: { total: number; intermediary: number; premium: number; web: number; play: number; churned: number; previousChurned: number };
  plans: { free: number; intermediary: number; premium: number };
  mrr: { kes: number; arrKes: number };
  revenue: { kes: number; previousKes: number; change: number | null; series: { day: string; web: number; play: number }[]; playIsEstimate: boolean };
}

function RevenueInsights() {
  const { data } = useApi<OverviewLite>('/admin/metrics/overview?days=90');
  const trend = useAnalytics().data?.subscriptionTrend;
  const p = usePalette();
  if (!data) return <Loading />;
  return (
    <>
      <Grid $min={200}>
        <Kpi label="Revenue, last 90 days" value={kes(data.revenue.kes)} delta={data.revenue.change} spark={data.revenue.series.map((s) => s.web + s.play)} />
        <Kpi label="Monthly recurring revenue" value={kes(data.mrr.kes)} hint={`${kesCompact(data.mrr.arrKes)} a year`} />
        <Kpi label="Paying members" value={whole(data.paying.total)} hint={`${whole(data.paying.web)} website · ${whole(data.paying.play)} Google Play`} />
        <Kpi label="Plans ended, 90 days" value={whole(data.paying.churned)} rise="bad" hint={`${whole(data.paying.previousChurned)} in the 90 before`} />
      </Grid>
      <Split>
        <Card>
          <CardHead title="Revenue per day" hint={data.revenue.playIsEstimate ? 'Website payments are exact. Google Play shows each new subscription at list price.' : undefined} />
          <Bars data={data.revenue.series} x="day" xFormat={shortDay} series={[{ key: 'web', label: 'Website (Paystack)' }, { key: 'play', label: 'Google Play (est.)' }]} stacked format={kesCompact} height={230} />
        </Card>
        <Card>
          <CardHead title="Paying members" hint="By plan and where they pay." />
          <Donut centerLabel="paying" data={[{ name: 'Premium', value: data.paying.premium, color: p.series[0] }, { name: 'Intermediary', value: data.paying.intermediary, color: p.series[1] }]} />
          <div style={{ height: 14 }} />
          <Donut centerLabel="paying" height={120} data={[{ name: 'Website', value: data.paying.web, color: p.series[3] }, { name: 'Google Play', value: data.paying.play, color: p.series[2] }]} />
        </Card>
      </Split>
      {trend && trend.length ? (
        <Card>
          <CardHead title="Plans started and ended, by month" hint="Subscriptions active at the end of each month, and those that ended in it." />
          <Bars data={trend} x="month" series={[{ key: 'active', label: 'Active', color: p.success }, { key: 'cancelled', label: 'Ended', color: p.danger }]} height={200} />
        </Card>
      ) : null}
    </>
  );
}

interface HealthLite {
  jobs: { status: string }[];
  feed: { attempts: number; succeeded: number };
  email: { requests: number; delivered: number; hardBounces: number; softBounces: number; blocked: number; spamReports: number; opens: number; clicks: number } | null;
  aiLast7Days: { feature: string; model: string | null; calls: number; failed: number; costUsd: number }[];
}

function HealthInsights() {
  const { data } = useApi<HealthLite>('/admin/system/health');
  const p = usePalette();
  if (!data) return <Loading />;
  const count = (s: string) => data.jobs.filter((j) => j.status === s).length;
  const ai = data.aiLast7Days;
  const cost = ai.reduce((n, r) => n + r.costUsd, 0);
  const e = data.email;
  return (
    <>
      <Split $ratio="1fr 1fr">
        <Card>
          <CardHead title="Scheduled jobs" hint="Each job's latest verdict." />
          <Donut centerLabel="jobs" data={[{ name: 'Healthy', value: count('ok'), color: p.success }, { name: 'Failing', value: count('failing'), color: p.danger }, { name: 'Overdue', value: count('overdue'), color: p.warning }, { name: 'No data yet', value: count('no-data'), color: p.border }]} />
        </Card>
        <Card>
          <CardHead title="AI usage, last 7 days" hint={`About $${cost.toFixed(cost < 1 ? 3 : 2)} in all.`} />
          <RankBars format={(n) => `${whole(n)} calls`} items={ai.map((r) => ({ label: r.feature, sub: r.failed ? `${r.failed} failed` : r.model ?? undefined, value: r.calls }))} empty="No AI requests recorded yet." />
        </Card>
      </Split>
      {e ? (
        <Card>
          <CardHead title="Email today" hint="From the email provider's delivery reports." />
          <Funnel steps={[{ label: 'Sent', value: e.requests }, { label: 'Delivered', value: e.delivered }, { label: 'Opened', value: e.opens }, { label: 'Clicked', value: e.clicks }]} />
          {e.hardBounces + e.softBounces + e.blocked + e.spamReports > 0 ? (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: p.danger }}>
              {e.hardBounces} hard and {e.softBounces} soft bounces, {e.blocked} blocked, {e.spamReports} spam reports.
            </p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
