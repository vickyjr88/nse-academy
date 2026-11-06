import React, { useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, Stat, adminFetch, day } from './_ops';

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

function change(now: number, before: number): string | undefined {
  if (before === 0) return now > 0 ? 'new' : undefined;
  const p = ((now - before) / before) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(0)}% vs previous period`;
}

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }} role="img" aria-label="Daily trend">
      {values.map((v, i) => (
        <div key={labels[i]} title={`${labels[i]}: ${v}`} style={{ flex: 1, minWidth: 2, height: `${Math.max(2, (v / max) * 100)}%`, background: v ? '#4945ff' : '#dcdce4', borderRadius: '2px 2px 0 0' }} />
      ))}
    </div>
  );
}

function Mini({ title, head, rows }: { title: string; head: [string, string, string?]; rows: (string | number)[][] }) {
  return (
    <Box style={{ flex: '1 1 340px' }}>
      <Typography variant="delta">{title}</Typography>
      {rows.length === 0 ? <Box paddingTop={2}><Typography textColor="neutral600">Nothing yet.</Typography></Box> : (
        <Table colCount={3} rowCount={rows.length + 1}>
          <Thead><Tr><Th><Typography variant="sigma">{head[0]}</Typography></Th><Th><Typography variant="sigma">{head[1]}</Typography></Th>{head[2] ? <Th><Typography variant="sigma">{head[2]}</Typography></Th> : <Th><span /></Th>}</Tr></Thead>
          <Tbody>{rows.map((r, i) => <Tr key={i}><Td><Typography>{r[0]}</Typography></Td><Td><Typography>{r[1]}</Typography></Td><Td><Typography>{r[2] ?? ''}</Typography></Td></Tr>)}</Tbody>
        </Table>
      )}
    </Box>
  );
}

export function AnalyticsAdmin() {
  const [members, setMembers] = useState<Members | null>(null);
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { adminFetch<Members>('/admin/analytics/members').then(setMembers).catch((e) => setError(e.message)); }, []);
  useEffect(() => { setTraffic(null); adminFetch<Traffic>(`/admin/analytics/traffic?days=${days}`).then(setTraffic).catch((e) => setError(e.message)); }, [days]);

  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load analytics: {error}</Typography></Box>;
  if (!members || !traffic) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading analytics…</Loader></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Analytics</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">How members use the app and how visitors find the website. Visitor tracking is anonymous: a random id kept in the browser, no IP address or device details stored, and visitors who send "Do Not Track" are not counted. Days are Nairobi days.</Typography></Box>
      </Box>

      <Typography variant="beta">Members</Typography>
      {!members.trackingSince && <Box paddingTop={2}><Typography textColor="neutral600">Activity tracking has just started. Numbers appear as members use the app.</Typography></Box>}
      <Flex gap={3} wrap="wrap" paddingTop={3} paddingBottom={3}>
        <Stat label="Active today" value={members.dau} />
        <Stat label="Active, 7 days" value={members.wau} />
        <Stat label="Active, 30 days" value={members.mau} />
        <Stat label="Stickiness" value={members.stickinessPct != null ? `${members.stickinessPct.toFixed(0)}%` : '-'} note="daily as a share of monthly" />
      </Flex>
      <Box paddingBottom={2}><Bars values={members.series.map((s) => s.count)} labels={members.series.map((s) => s.day)} /></Box>
      <Typography variant="pi" textColor="neutral600">Members active per day, last 30 days{members.trackingSince ? ` (tracking since ${members.trackingSince})` : ''}.</Typography>

      <Box paddingTop={6} paddingBottom={8}>
        <Typography variant="delta">Paying members gone quiet</Typography>
        {members.dormantPaying === null ? (
          <Box paddingTop={2}><Typography textColor="neutral600">Needs {members.dormantDays} days of activity data before it can say who has gone quiet ({members.trackingDays} so far). Showing it earlier would flag everyone.</Typography></Box>
        ) : members.dormantPaying.length === 0 ? (
          <Box paddingTop={2}><Typography textColor="neutral600">Every paying member has been active in the last {members.dormantDays} days.</Typography></Box>
        ) : (
          <Table colCount={4} rowCount={members.dormantPaying.length + 1}>
            <Thead><Tr><Th><Typography variant="sigma">Member</Typography></Th><Th><Typography variant="sigma">Plan</Typography></Th><Th><Typography variant="sigma">Last active</Typography></Th><Th><Typography variant="sigma">Plan ends</Typography></Th></Tr></Thead>
            <Tbody>{members.dormantPaying.map((m) => (
              <Tr key={m.userId}>
                <Td><Typography fontWeight="bold">{m.name}</Typography><br /><Typography variant="pi" textColor="neutral600">{m.email}</Typography></Td>
                <Td><Pill kind="neutral">{m.tier}</Pill></Td>
                <Td><Typography>{m.lastActiveAt ? day(m.lastActiveAt) : 'not since tracking began'}</Typography></Td>
                <Td><Typography>{day(m.endsOn)}</Typography></Td>
              </Tr>
            ))}</Tbody>
          </Table>
        )}
      </Box>

      <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
        <Typography variant="beta">Website visitors</Typography>
        <Flex gap={1}>{[7, 30, 90].map((d) => <Button key={d} size="S" variant={days === d ? 'default' : 'tertiary'} onClick={() => setDays(d)}>{d} days</Button>)}</Flex>
      </Flex>
      <Flex gap={3} wrap="wrap" paddingBottom={3}>
        <Stat label="Visitors" value={traffic.visitors.toLocaleString('en-KE')} note={change(traffic.visitors, traffic.previous.visitors)} />
        <Stat label="Page views" value={traffic.pageViews.toLocaleString('en-KE')} note={change(traffic.pageViews, traffic.previous.pageViews)} />
        <Stat label="Signups from the site" value={traffic.signups.reduce((n, s) => n + s.signups, 0)} note={`${traffic.signups.reduce((n, s) => n + s.paying, 0)} now paying`} />
      </Flex>
      <Box paddingBottom={2}><Bars values={traffic.series.map((s) => s.visitors)} labels={traffic.series.map((s) => s.day)} /></Box>
      <Typography variant="pi" textColor="neutral600">Unique visitors per day.</Typography>

      <Flex gap={6} wrap="wrap" paddingTop={6} alignItems="flex-start">
        <Mini title="Where visitors come from" head={['Source', 'Visitors', 'Views']} rows={traffic.sources.map((s) => [s.source, s.visitors, s.views])} />
        <Mini title="Top pages" head={['Page', 'Visitors', 'Views']} rows={traffic.topPages.map((p) => [p.path, p.visitors, p.views])} />
      </Flex>
      <Flex gap={6} wrap="wrap" paddingTop={6} alignItems="flex-start">
        <Mini title="Signups by source" head={['Source', 'Signups', 'Paying']} rows={traffic.signups.map((s) => [s.source, s.signups, s.paying])} />
        <Mini title="Campaign links (utm_campaign)" head={['Campaign', 'Visitors', 'Views']} rows={traffic.campaigns.map((c) => [c.campaign, c.visitors, c.views])} />
        <Mini title="Devices" head={['Device', 'Views']} rows={traffic.devices.map((d) => [d.device, d.views])} />
      </Flex>
    </Box>
  );
}
