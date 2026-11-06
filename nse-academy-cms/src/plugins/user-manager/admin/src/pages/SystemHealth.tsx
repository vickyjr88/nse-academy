import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, Stat, adminFetch, kes, when } from './_ops';

interface Job { name: string; label: string; schedule: string; status: 'ok' | 'overdue' | 'failing' | 'no-data'; lastRunAt: string | null; lastSuccessAt: string | null; lastSummary: string | null; problem: string | null; runs24h: number; failures24h: number }
interface AiRow { feature: string; model: string | null; calls: number; failed: number; verified: number; unverified: number; costUsd: number; avgSeconds: number | null }
interface Health {
  generatedAt: string;
  jobs: Job[];
  feed: { attempts: number; succeeded: number; failureReasons: Record<string, number>; snapshotsStored: number; lastSnapshotAt: string | null };
  marketReport: { sessionYmd: string | null; exists: boolean; status: string | null; aiGenerated: boolean | null; model: string | null };
  email: { requests: number; delivered: number; hardBounces: number; softBounces: number; blocked: number; spamReports: number; opens: number; clicks: number } | null;
  aiLast7Days: AiRow[];
}
interface JobRun { id: string; job: string; startedAt: string; ok: boolean; durationMs: number | null; summary: string | null; error: string | null }

const usd = (n: number) => (n === 0 ? '-' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

export function SystemHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const [h, r] = await Promise.all([adminFetch<Health>('/admin/system/health'), adminFetch<JobRun[]>(`/admin/system/jobs?limit=40${filter ? `&job=${encodeURIComponent(filter)}` : ''}`)]);
      setData(h);
      setRuns(r);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading system health…</Loader></Box>;
  if (error || !data) return <Box padding={8}><Typography textColor="danger600">Failed to load system health: {error}</Typography></Box>;

  const problems = data.jobs.filter((j) => j.status === 'failing' || j.status === 'overdue');
  const rate = data.feed.attempts ? Math.round((data.feed.succeeded / data.feed.attempts) * 100) : null;
  const week = data.aiLast7Days;
  const weekCost = week.reduce((n, r) => n + r.costUsd, 0);

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={4}>
        <Box>
          <Typography variant="alpha">System Health</Typography>
          <Box paddingTop={2}><Typography textColor="neutral600">Are the scheduled jobs running, is the price feed healthy, and what is the AI costing? Refreshes every minute. The daily report emails the same picture at 08:00.</Typography></Box>
        </Box>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </Flex>

      <Flex gap={3} wrap="wrap" paddingBottom={6}>
        <Stat label="Scheduled jobs" value={<span style={{ color: problems.length ? '#b72b1a' : '#2f6846' }}>{problems.length ? `${problems.length} need attention` : 'All on schedule'}</span>} note={`${data.jobs.filter((j) => j.status === 'ok').length} of ${data.jobs.length} ok`} />
        <Stat label="Price polls today" value={rate === null ? '-' : `${rate}%`} note={`${data.feed.succeeded} of ${data.feed.attempts} succeeded`} />
        <Stat label="Last price snapshot" value={data.feed.lastSnapshotAt ? when(data.feed.lastSnapshotAt) : '-'} note={`${data.feed.snapshotsStored} stored today`} />
        <Stat label="AI cost, 7 days" value={usd(weekCost) === '-' ? '$0' : usd(weekCost)} note={`${week.reduce((n, r) => n + r.calls, 0)} calls`} />
      </Flex>

      <Box paddingBottom={6}>
        <Typography variant="beta">Scheduled jobs</Typography>
        <Box paddingTop={3}>
          <Table colCount={5} rowCount={data.jobs.length + 1}>
            <Thead><Tr><Th><Typography variant="sigma">Job</Typography></Th><Th><Typography variant="sigma">Status</Typography></Th><Th><Typography variant="sigma">Last success</Typography></Th><Th><Typography variant="sigma">24h</Typography></Th><Th><Typography variant="sigma">Detail</Typography></Th></Tr></Thead>
            <Tbody>
              {[...data.jobs].sort((a, b) => Number(b.status === 'failing' || b.status === 'overdue') - Number(a.status === 'failing' || a.status === 'overdue')).map((j) => (
                <Tr key={j.name} style={{ cursor: 'pointer' }} onClick={() => setFilter(filter === j.name ? '' : j.name)}>
                  <Td><Typography fontWeight="bold">{j.label}</Typography><br /><Typography variant="pi" textColor="neutral600">{j.schedule}</Typography></Td>
                  <Td><Pill kind={j.status}>{j.status}</Pill></Td>
                  <Td><Typography>{when(j.lastSuccessAt)}</Typography></Td>
                  <Td><Typography>{j.runs24h} runs{j.failures24h ? `, ${j.failures24h} failed` : ''}</Typography></Td>
                  <Td><Typography textColor={j.problem ? 'danger600' : 'neutral600'}>{j.problem ?? j.lastSummary ?? ''}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Box paddingBottom={6}>
        <Typography variant="beta">Recent runs{filter ? ` - ${filter}` : ''}</Typography>
        {filter ? <Box paddingTop={1}><Button variant="tertiary" size="S" onClick={() => setFilter('')}>Show all jobs</Button></Box> : <Box paddingTop={1}><Typography variant="pi" textColor="neutral600">Click a job above to filter.</Typography></Box>}
        <Box paddingTop={3}>
          <Table colCount={4} rowCount={runs.length + 1}>
            <Thead><Tr><Th><Typography variant="sigma">When</Typography></Th><Th><Typography variant="sigma">Job</Typography></Th><Th><Typography variant="sigma">Result</Typography></Th><Th><Typography variant="sigma">Detail</Typography></Th></Tr></Thead>
            <Tbody>
              {runs.map((r) => (
                <Tr key={r.id}>
                  <Td><Typography>{when(r.startedAt)}</Typography></Td>
                  <Td><Typography>{r.job}</Typography></Td>
                  <Td><Pill kind={r.ok ? 'ok' : 'failing'}>{r.ok ? 'ok' : 'failed'}</Pill>{r.durationMs != null ? <Typography variant="pi" textColor="neutral600"> {r.durationMs}ms</Typography> : null}</Td>
                  <Td><Typography textColor={r.error ? 'danger600' : 'neutral600'}>{r.error ?? r.summary ?? ''}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Box paddingBottom={6}>
        <Typography variant="beta">AI usage, last 7 days</Typography>
        <Box paddingTop={3}>
          {week.length === 0 ? <Typography textColor="neutral600">No AI requests recorded yet.</Typography> : (
            <Table colCount={6} rowCount={week.length + 1}>
              <Thead><Tr><Th><Typography variant="sigma">Feature / model</Typography></Th><Th><Typography variant="sigma">Calls</Typography></Th><Th><Typography variant="sigma">Failed</Typography></Th><Th><Typography variant="sigma">Passed our checks</Typography></Th><Th><Typography variant="sigma">Cost</Typography></Th><Th><Typography variant="sigma">Avg time</Typography></Th></Tr></Thead>
              <Tbody>
                {week.map((r) => (
                  <Tr key={`${r.feature}-${r.model}`}>
                    <Td><Typography fontWeight="bold">{r.feature}</Typography><br /><Typography variant="pi" textColor="neutral600">{r.model ?? 'no model answered'}</Typography></Td>
                    <Td><Typography>{r.calls}</Typography></Td>
                    <Td><Typography textColor={r.failed ? 'danger600' : 'neutral600'}>{r.failed}</Typography></Td>
                    <Td><Typography>{r.verified + r.unverified ? `${r.verified} of ${r.verified + r.unverified}` : '-'}</Typography></Td>
                    <Td><Typography>{usd(r.costUsd)}</Typography></Td>
                    <Td><Typography>{r.avgSeconds != null ? `${r.avgSeconds}s` : '-'}</Typography></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </Box>

      <Flex gap={6} wrap="wrap">
        <Box style={{ flex: '1 1 320px' }}>
          <Typography variant="beta">Public market report</Typography>
          <Box paddingTop={2}>
            {!data.marketReport.sessionYmd ? <Typography textColor="neutral600">No trading session yet.</Typography> : !data.marketReport.exists ? <Typography textColor="danger600">No report exists for {data.marketReport.sessionYmd}.</Typography> : (
              <Typography>{data.marketReport.sessionYmd}: <strong>{data.marketReport.status}</strong>, {data.marketReport.aiGenerated ? `written by ${data.marketReport.model}` : 'template story (AI did not pass verification)'}.</Typography>
            )}
          </Box>
        </Box>
        <Box style={{ flex: '1 1 320px' }}>
          <Typography variant="beta">Transactional email today</Typography>
          <Box paddingTop={2}>
            {data.email ? <Typography>{data.email.requests} sent, {data.email.delivered} delivered, {data.email.hardBounces + data.email.softBounces + data.email.blocked} bounced or blocked, {data.email.spamReports} spam complaints, {data.email.opens} opens, {data.email.clicks} clicks.</Typography> : <Typography textColor="neutral600">Not available.</Typography>}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
