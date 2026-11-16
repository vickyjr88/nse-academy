import React, { useState } from 'react';
import { Page } from '../ui/page';
import { useApi } from '../ui/api';
import { Kpi, KpiSkeleton } from '../ui/kpi';
import { AreaTrend, Donut, RankBars } from '../ui/charts';
import { Badge, Card, CardHead, EmptyState, Grid, RANGE_OPTIONS, Segmented, Skeleton, Split } from '../ui/primitives';
import { whole } from '../ui/format';
import { usePalette } from '../ui/theme';
import { day } from './_ops';

interface Members {
  trackingSince: string | null; trackingDays: number; dau: number; wau: number; mau: number; stickinessPct: number | null; dormantDays: number;
  dormantPaying: { userId: string; name: string; email: string; tier: string; lastActiveAt: string | null; endsOn: string | null }[] | null;
  series: { day: string; count: number }[];
}
interface Traffic {
  days: number; pageViews: number; visitors: number; previous: { pageViews: number; visitors: number };
  topPages: { path: string; views: number; visitors: number }[];
  sources: { source: string; views: number; visitors: number }[];
  campaigns: { campaign: string; views: number; visitors: number }[];
  devices: { device: string; views: number }[];
  signups: { source: string; signups: number; paying: number }[];
  series: { day: string; views: number; visitors: number }[];
}

const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

export function AnalyticsAdmin() {
  const [days, setDays] = useState(30);
  const members = useApi<Members>('/admin/analytics/members');
  const traffic = useApi<Traffic>(`/admin/analytics/traffic?days=${days}`);
  const ga = useApi<{ googleAnalytics?: { totalActiveUsers: number; totalPageViews: number; avgBounceRate: number; dailyStats: { date: string; users: number; views: number }[] } | null }>('/admin/analytics').data?.googleAnalytics;
  const p = usePalette();
  const m = members.data;
  const t = traffic.data;

  return (
    <Page
      title="Audience & traffic"
      description="How members use the app and how visitors find the website. Visitor tracking is anonymous: a random id kept in the browser, no IP address or device details stored, and visitors who send Do Not Track are not counted. Days are Nairobi days."
      actions={<Segmented label="Time range" value={days} options={RANGE_OPTIONS} onChange={setDays} />}
    >
      <Grid $min={200}>
        {m ? (
          <>
            <Kpi label="Active today" value={whole(m.dau)} spark={m.series.map((s) => s.count)} />
            <Kpi label="Active, 7 days" value={whole(m.wau)} />
            <Kpi label="Active, 30 days" value={whole(m.mau)} />
            <Kpi label="Stickiness" value={m.stickinessPct != null ? `${Math.round(m.stickinessPct)}%` : '–'} hint="daily as a share of monthly" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        )}
      </Grid>

      <Split $ratio="1fr 1fr">
        <Card>
          <CardHead title="Members active per day" hint={m?.trackingSince ? `Tracking since ${m.trackingSince}.` : 'Activity tracking has just started; numbers appear as members use the app.'} />
          {m ? <AreaTrend data={m.series} series={[{ key: 'count', label: 'Active members', color: p.series[2] }]} height={210} /> : <Skeleton $h={210} />}
        </Card>
        <Card>
          <CardHead title="Paying members gone quiet" hint={m ? `Paid plans with no activity in ${m.dormantDays} days: worth a personal nudge.` : undefined} />
          {!m ? <Skeleton $h={210} /> : m.dormantPaying === null ? (
            <EmptyState title="Not enough data yet">Needs {m.dormantDays} days of activity data before this can say who has gone quiet ({m.trackingDays} so far). Showing it earlier would flag everyone.</EmptyState>
          ) : m.dormantPaying.length === 0 ? (
            <EmptyState title="Everyone is active">Every paying member has been active in the last {m.dormantDays} days.</EmptyState>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, maxHeight: 230, overflowY: 'auto' }}>
              {m.dormantPaying.map((d) => (
                <li key={d.userId} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: p.text }}>{d.name}</strong>
                    <span style={{ color: p.muted }}>{d.email}</span>
                  </span>
                  <Badge>{d.tier}</Badge>
                  <span style={{ color: p.muted, whiteSpace: 'nowrap' }}>{d.lastActiveAt ? `last ${day(d.lastActiveAt)}` : 'not since tracking began'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Split>

      <Grid $min={200}>
        {t ? (
          <>
            <Kpi label="Website visitors" value={whole(t.visitors)} delta={change(t.visitors, t.previous.visitors)} spark={t.series.map((s) => s.visitors)} />
            <Kpi label="Page views" value={whole(t.pageViews)} delta={change(t.pageViews, t.previous.pageViews)} spark={t.series.map((s) => s.views)} />
            <Kpi label="Signups from the site" value={whole(t.signups.reduce((n, s) => n + s.signups, 0))} hint={`${t.signups.reduce((n, s) => n + s.paying, 0)} now paying`} />
            <Kpi label="Pages per visitor" value={t.visitors ? (t.pageViews / t.visitors).toFixed(1) : '–'} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        )}
      </Grid>

      <Card>
        <CardHead title="Visitors and page views" hint="Per day." />
        {t ? <AreaTrend data={t.series} series={[{ key: 'visitors', label: 'Visitors' }, { key: 'views', label: 'Page views', color: p.series[1] }]} height={230} /> : <Skeleton $h={230} />}
      </Card>

      {ga ? (
        <Card>
          <CardHead title="Google Analytics" hint="Last 30 days, from Google. Our own count above is cookie-free and anonymous, so the two will differ." right={<span style={{ color: p.muted, fontSize: 12 }}>{whole(ga.totalActiveUsers)} users · {whole(ga.totalPageViews)} views · {ga.avgBounceRate}% bounce</span>} />
          <AreaTrend data={ga.dailyStats} x="date" series={[{ key: 'users', label: 'Users' }, { key: 'views', label: 'Page views', color: p.series[1] }]} height={200} />
        </Card>
      ) : null}

      <Split $ratio="1fr 1fr">
        <Card><CardHead title="Where visitors come from" />{t ? <RankBars items={t.sources.slice(0, 8).map((s) => ({ label: s.source, value: s.visitors, sub: `${whole(s.views)} views` }))} /> : <Skeleton $h={180} />}</Card>
        <Card><CardHead title="Top pages" />{t ? <RankBars items={t.topPages.slice(0, 8).map((s) => ({ label: s.path, value: s.visitors, sub: `${whole(s.views)} views` }))} /> : <Skeleton $h={180} />}</Card>
      </Split>
      <Split $ratio="1fr 1fr 1fr">
        <Card><CardHead title="Signups by source" hint="Where members who signed up first arrived from." />{t ? <RankBars items={t.signups.slice(0, 8).map((s) => ({ label: s.source, value: s.signups, sub: `${s.paying} paying` }))} /> : <Skeleton $h={160} />}</Card>
        <Card><CardHead title="Campaign links" hint="utm_campaign" />{t ? <RankBars items={t.campaigns.slice(0, 8).map((s) => ({ label: s.campaign, value: s.visitors }))} empty="No tagged campaign links yet." /> : <Skeleton $h={160} />}</Card>
        <Card><CardHead title="Devices" />{t ? <Donut height={140} data={t.devices.map((d) => ({ name: d.device, value: d.views }))} /> : <Skeleton $h={160} />}</Card>
      </Split>
    </Page>
  );
}
