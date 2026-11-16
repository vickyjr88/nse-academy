import React, { useState } from 'react';
import { Button } from '@strapi/design-system';
import { useNavigate } from 'react-router-dom';
import { Page } from '../ui/page';
import { useApi } from '../ui/api';
import { Kpi, KpiSkeleton } from '../ui/kpi';
import { AreaTrend, Bars, Donut, Funnel } from '../ui/charts';
import { Badge, Card, CardHead, EmptyState, GoLink, Grid, RANGE_OPTIONS, Row, Segmented, Skeleton, Split } from '../ui/primitives';
import { ago, kes, kesCompact, shortDay, whole } from '../ui/format';
import { usePalette } from '../ui/theme';
import { href } from '../sections';

interface Overview {
  generatedAt: string;
  days: number;
  members: { total: number; new: number; previousNew: number; newChange: number | null; signupSeries: { day: string; count: number }[] };
  active: { dau: number; wau: number; mau: number; stickinessPct: number | null; series: { day: string; count: number }[]; trackingSince: string | null };
  paying: { total: number; intermediary: number; premium: number; web: number; play: number; churned: number; previousChurned: number };
  plans: { free: number; intermediary: number; premium: number };
  mrr: { kes: number; arrKes: number };
  revenue: { kes: number; previousKes: number; change: number | null; series: { day: string; web: number; play: number }[]; playIsEstimate: boolean };
  traffic: { visitors: number; previousVisitors: number; pageViews: number; series: { day: string; views: number; visitors: number }[] };
  funnel: { label: string; value: number }[];
  attention: { key: string; severity: 'high' | 'medium' | 'low'; title: string; detail: string; count: number; route: string | null }[];
  feed: { kind: string; title: string; at: string; route: string }[];
}

const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

function Attention({ items }: { items: Overview['attention'] }) {
  const p = usePalette();
  const navigate = useNavigate();
  const tone = { high: p.danger, medium: p.warning, low: p.faint } as const;
  if (!items.length) {
    return (
      <Row $gap={10} style={{ padding: '6px 0' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: p.success }} />
        <span style={{ color: p.text, fontWeight: 600 }}>All clear.</span>
        <span style={{ color: p.muted }}>No failing jobs, unread messages, pending approvals or payments on hold.</span>
      </Row>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
      {items.map((i) => (
        <li key={i.key}>
          <button
            type="button"
            disabled={!i.route}
            onClick={() => i.route && navigate(href(i.route))}
            style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8, cursor: i.route ? 'pointer' : 'default' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: tone[i.severity], flexShrink: 0 }} aria-label={`${i.severity} priority`} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', color: p.text, fontWeight: 600, fontSize: 14 }}>{i.title}</span>
              <span style={{ display: 'block', color: p.muted, fontSize: 12 }}>{i.detail}</span>
            </span>
            <Badge tone={i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warning' : 'neutral'}>{i.count}</Badge>
            {i.route ? <span style={{ color: p.faint }}>›</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Feed({ items }: { items: Overview['feed'] }) {
  const p = usePalette();
  const navigate = useNavigate();
  const dot: Record<string, string> = { signup: p.primary, payment: p.success, play: p.series[2] };
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
      {items.map((f, idx) => (
        <li key={idx}>
          <button type="button" onClick={() => navigate(href(f.route))} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '7px 6px', borderRadius: 8, cursor: 'pointer' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: dot[f.kind] ?? p.faint, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, color: p.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
            <span style={{ color: p.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{ago(f.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function OverviewPage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<Overview>(`/admin/metrics/overview?days=${days}`);
  const p = usePalette();

  const range = <Segmented label="Time range" value={days} options={RANGE_OPTIONS} onChange={setDays} />;
  const actions = (
    <>
      {range}
      <Button variant="tertiary" size="S" onClick={reload} disabled={loading}>
        Refresh
      </Button>
    </>
  );

  if (error && !data) {
    return (
      <Page title="Overview" actions={actions}>
        <Card>
          <EmptyState title="Could not load the overview">{error}</EmptyState>
        </Card>
      </Page>
    );
  }

  const d = data;
  return (
    <Page title="Overview" description="How the business is doing, and what needs you today. Figures compare the period with the one just before it." actions={actions}>
      <Grid $min={180}>
        {d ? (
          <>
            <Kpi label="New members" value={whole(d.members.new)} delta={d.members.newChange} spark={d.members.signupSeries.map((s) => s.count)} hint={`${whole(d.members.total)} in all`} to="members" />
            <Kpi label="Paying members" value={whole(d.paying.total)} hint={`${d.paying.premium} Premium · ${d.paying.intermediary} Intermediary`} to="revenue" />
            <Kpi label="Revenue" value={kes(d.revenue.kes)} delta={d.revenue.change} spark={d.revenue.series.map((s) => s.web + s.play)} hint={d.revenue.playIsEstimate && d.paying.play ? 'Play shown at list price' : undefined} to="revenue" />
            <Kpi label="Monthly recurring revenue" value={kes(d.mrr.kes)} hint={`${kesCompact(d.mrr.arrKes)} a year at list price`} to="revenue" />
            <Kpi label="Active this month" value={whole(d.active.mau)} hint={d.active.stickinessPct != null ? `${whole(d.active.dau)} today · ${Math.round(d.active.stickinessPct)}% come back daily` : `${whole(d.active.dau)} today`} spark={d.active.series.map((s) => s.count)} to="overview/audience" />
            <Kpi label="Website visitors" value={whole(d.traffic.visitors)} delta={change(d.traffic.visitors, d.traffic.previousVisitors)} spark={d.traffic.series.map((s) => s.visitors)} to="overview/audience" />
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => <KpiSkeleton key={i} />)
        )}
      </Grid>

      <Card>
        <CardHead title="Needs your attention" hint="The things only a person can clear, most urgent first." />
        {d ? <Attention items={d.attention} /> : <Skeleton $h={60} />}
      </Card>

      <Split>
        <Card>
          <CardHead
            title="Revenue"
            hint={d?.revenue.playIsEstimate ? 'Web payments are exact. Google Play counts each new subscription at list price; Play holds the real receipts.' : undefined}
            right={d ? <span style={{ fontWeight: 700, color: p.text, fontSize: 18 }}>{kes(d.revenue.kes)}</span> : null}
          />
          {d ? <Bars data={d.revenue.series} x="day" xFormat={shortDay} series={[{ key: 'web', label: 'Website (Paystack)' }, { key: 'play', label: 'Google Play (est.)' }]} stacked format={kesCompact} height={240} /> : <Skeleton $h={240} />}
          {d ? (
            <Row $gap={16} style={{ marginTop: 10, fontSize: 12, color: p.muted }}>
              <span><span style={{ color: p.series[0] }}>■</span> Website</span>
              <span><span style={{ color: p.series[1] }}>■</span> Google Play (estimate)</span>
              <span style={{ marginLeft: 'auto' }}><GoLink to="revenue">Payments &amp; plans →</GoLink></span>
            </Row>
          ) : null}
        </Card>
        <Card>
          <CardHead title="Who pays, and for what" hint={d ? `${whole(d.plans.free)} members are on the free plan. Paying: ${whole(d.paying.web)} on the website, ${whole(d.paying.play)} through Google Play.` : undefined} />
          {d ? (
            <Donut
              centerLabel="paying"
              data={[
                { name: 'Premium', value: d.plans.premium, color: p.series[0] },
                { name: 'Intermediary', value: d.plans.intermediary, color: p.series[1] },
              ]}
            />
          ) : (
            <Skeleton $h={190} />
          )}
          {d && (d.paying.churned || d.paying.previousChurned) ? (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: p.muted }}>
              {whole(d.paying.churned)} plan{d.paying.churned === 1 ? '' : 's'} ended in this period ({whole(d.paying.previousChurned)} in the one before).
            </p>
          ) : null}
        </Card>
      </Split>

      <Split>
        <Card>
          <CardHead title="New members" hint="Sign-ups per day." right={d ? <GoLink to="members">All members →</GoLink> : null} />
          {d ? <AreaTrend data={d.members.signupSeries} series={[{ key: 'count', label: 'New members' }]} height={220} /> : <Skeleton $h={220} />}
        </Card>
        <Card>
          <CardHead title="From visit to paying" hint="This period. Each step counts different people, so it shows where people drop away, not an exact path." />
          {d ? <Funnel steps={d.funnel} /> : <Skeleton $h={180} />}
        </Card>
      </Split>

      <Split $ratio="1fr 1fr">
        <Card>
          <CardHead title="Active members" hint={d?.active.trackingSince ? `Members who used the app each day (tracking since ${d.active.trackingSince}).` : 'Activity tracking has just started; numbers appear as members use the app.'} right={d ? <GoLink to="overview/audience">Audience →</GoLink> : null} />
          {d ? <AreaTrend data={d.active.series} series={[{ key: 'count', label: 'Active members', color: p.series[2] }]} height={200} /> : <Skeleton $h={200} />}
        </Card>
        <Card>
          <CardHead title="Latest activity" hint="Sign-ups and payments as they happen." />
          {d ? <Feed items={d.feed} /> : <Skeleton $h={200} />}
        </Card>
      </Split>
    </Page>
  );
}
