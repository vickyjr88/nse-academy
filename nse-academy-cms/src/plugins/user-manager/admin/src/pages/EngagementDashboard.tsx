import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Flex,
  Loader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface FlowSummary {
  flow: string;
  entered: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  opened: number;
  clicked: number;
}

interface FunnelStage {
  stage: string;
  count: number;
}

interface DailyVolume {
  date: string;
  flow: string;
  entered: number;
  sent: number;
}

interface VariantResult {
  variant: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
}

const VARIANT_LABELS: Record<string, string> = {
  'trade-journal': 'Trade Journal angle',
  'stock-advisor': 'Stock Advisor angle',
  'data-still-there': 'Data-still-there angle',
  'social-proof': 'Advisors-directory angle',
  unknown: 'Unknown (sent before variants existed)',
};

const TRIGGERABLE_FLOWS = ['day1-nurture', 'day7-nurture', 'day14-nurture'] as const;

const FLOW_LABELS: Record<string, string> = {
  'day1-nurture': 'Day 1 Nurture',
  'day7-nurture': 'Day 7 Nurture',
  'day14-nurture': 'Day 14 Nurture (Intermediary pitch)',
  'engaged-free-tagging': 'Engaged-Free Tagging (lessons)',
  'active-trader-tagging': 'Active-Trader Tagging (price alerts)',
  'corporate-expiry-warning': 'Corporate Expiry Warning',
  'renewal-nudge': 'Renewal Nudge (5-day)',
  winback: 'Win-back (7-day)',
  'referral-nudge': 'Stale Referral Nudge (7-day)',
};

async function fetchJson(path: string) {
  const res = await fetch(`${NSE_API_URL}${path}`, { headers: { 'x-admin-key': NSE_ADMIN_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function EngagementDashboard() {
  const [flowSummaries, setFlowSummaries] = useState<FlowSummary[] | null>(null);
  const [signupFunnel, setSignupFunnel] = useState<FunnelStage[] | null>(null);
  const [churnFunnel, setChurnFunnel] = useState<FunnelStage[] | null>(null);
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[] | null>(null);
  const [day14Variants, setDay14Variants] = useState<VariantResult[] | null>(null);
  const [winbackVariants, setWinbackVariants] = useState<VariantResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [triggerPreviews, setTriggerPreviews] = useState<Record<string, number | null>>({});
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ flow: string; sent: number; failed: number } | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [flows, signup, churn, daily, day14Var, winbackVar] = await Promise.all([
        fetchJson('/admin/analytics/flows'),
        fetchJson('/admin/analytics/funnel/signup'),
        fetchJson('/admin/analytics/funnel/churn-recovery'),
        fetchJson('/admin/analytics/daily-volume?days=30'),
        fetchJson('/admin/analytics/variants/day14-nurture'),
        fetchJson('/admin/analytics/variants/winback'),
      ]);
      setFlowSummaries(flows);
      setSignupFunnel(signup);
      setChurnFunnel(churn);
      setDailyVolume(daily);
      setDay14Variants(day14Var);
      setWinbackVariants(winbackVar);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  async function loadTriggerPreviews() {
    for (const flow of TRIGGERABLE_FLOWS) {
      try {
        const data = await fetchJson(`/admin/lifecycle/trigger/${flow}/preview`);
        setTriggerPreviews((prev) => ({ ...prev, [flow]: data.count }));
      } catch {
        setTriggerPreviews((prev) => ({ ...prev, [flow]: null }));
      }
    }
  }

  useEffect(() => {
    loadAll();
    loadTriggerPreviews();
  }, []);

  async function handleTrigger(flow: string) {
    setTriggering(flow);
    setTriggerError(null);
    setTriggerResult(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/lifecycle/trigger/${flow}`, {
        method: 'POST',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setTriggerResult({ flow, sent: data.sent, failed: data.failed });
      loadTriggerPreviews();
      loadAll();
    } catch (e: any) {
      setTriggerError(e.message || 'Failed to trigger flow');
    } finally {
      setTriggering(null);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading engagement analytics…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Alert closeLabel="Close" title="Failed to load" variant="danger">
          {error}
        </Alert>
      </Box>
    );
  }

  // Daily volume comes back as one row per (date, flow) - pivot into one
  // row per date with a column per flow so the line chart can plot every
  // flow's trend on the same timeline.
  const dailyByDate = new Map<string, Record<string, number | string>>();
  for (const row of dailyVolume ?? []) {
    if (!dailyByDate.has(row.date)) dailyByDate.set(row.date, { date: row.date });
    dailyByDate.get(row.date)![row.flow] = row.sent;
  }
  const dailyChartData = Array.from(dailyByDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const flowsWithVolume = Array.from(new Set((dailyVolume ?? []).map((r) => r.flow)));
  const FLOW_COLORS = ['#047857', '#0ea5e9', '#f59e0b', '#a855f7', '#ef4444', '#64748b', '#ec4899'];

  const totalEntered = (flowSummaries ?? []).reduce((sum, f) => sum + f.entered, 0);
  const totalSent = (flowSummaries ?? []).reduce((sum, f) => sum + f.sent, 0);
  const totalFailed = (flowSummaries ?? []).reduce((sum, f) => sum + f.failed, 0);

  return (
    <Box padding={8}>
      <Box paddingBottom={6}>
        <Typography variant="alpha">Engagement Automation</Typography>
        <Box paddingTop={2}>
          <Typography textColor="neutral600">
            Live view of the lifecycle flows: who has entered each one, what happened, and how users move
            through the signup and churn-recovery funnels.
          </Typography>
        </Box>
      </Box>

      <Flex gap={4} paddingBottom={6} wrap="wrap">
        <StatCard label="Total Flow Entries (all-time)" value={totalEntered.toLocaleString()} />
        <StatCard label="Emails Sent" value={totalSent.toLocaleString()} tone="positive" />
        <StatCard label="Failed Sends" value={totalFailed.toLocaleString()} tone={totalFailed > 0 ? 'negative' : 'neutral'} />
      </Flex>

      {/* Signup funnel */}
      <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius marginBottom={6}>
        <Typography variant="delta">Signup → Paid Funnel</Typography>
        <Box paddingTop={1} paddingBottom={4}>
          <Typography variant="pi" textColor="neutral600">
            Distinct users who reached each stage. A drop between stages is where people fall out of the flow.
          </Typography>
        </Box>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={signupFunnel ?? []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={160} />
            <Tooltip />
            <Bar dataKey="count" fill="#047857" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Churn recovery funnel */}
      <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius marginBottom={6}>
        <Typography variant="delta">Lapsed → Reactivated Funnel</Typography>
        <Box paddingTop={1} paddingBottom={4}>
          <Typography variant="pi" textColor="neutral600">
            Users whose subscription lapsed to free, and how many recovery emails brought back.
          </Typography>
        </Box>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={churnFunnel ?? []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={200} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {(churnFunnel ?? []).map((entry, i) => (
                <Cell key={entry.stage} fill={i === (churnFunnel ?? []).length - 1 ? '#047857' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Daily volume trend */}
      {dailyChartData.length > 0 && (
        <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius marginBottom={6}>
          <Typography variant="delta">Daily Sends, Last 30 Days</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyChartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {flowsWithVolume.map((flow, i) => (
                <Line
                  key={flow}
                  type="monotone"
                  dataKey={flow}
                  name={FLOW_LABELS[flow] || flow}
                  stroke={FLOW_COLORS[i % FLOW_COLORS.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* A/B variant results */}
      <VariantResultsCard title="Day 14 Pitch — A/B Results" results={day14Variants} />
      <VariantResultsCard title="Win-back Email — A/B Results" results={winbackVariants} />

      {/* Flow health table */}
      <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius marginBottom={6}>
        <Typography variant="delta">Flow Health (All-Time)</Typography>
        <Box paddingTop={4}>
          <Table colCount={8} rowCount={(flowSummaries ?? []).length}>
            <Thead>
              <Tr>
                <Th><Typography variant="sigma">Flow</Typography></Th>
                <Th><Typography variant="sigma">Entered</Typography></Th>
                <Th><Typography variant="sigma">Sent</Typography></Th>
                <Th><Typography variant="sigma">Opened</Typography></Th>
                <Th><Typography variant="sigma">Clicked</Typography></Th>
                <Th><Typography variant="sigma">Failed</Typography></Th>
                <Th><Typography variant="sigma">Pending</Typography></Th>
                <Th><Typography variant="sigma">Skipped</Typography></Th>
              </Tr>
            </Thead>
            <Tbody>
              {(flowSummaries ?? []).map((f) => (
                <Tr key={f.flow}>
                  <Td><Typography fontWeight="semiBold">{FLOW_LABELS[f.flow] || f.flow}</Typography></Td>
                  <Td><Typography>{f.entered.toLocaleString()}</Typography></Td>
                  <Td><Typography textColor="success600">{f.sent.toLocaleString()}</Typography></Td>
                  <Td>
                    <Typography>
                      {f.opened.toLocaleString()}
                      {f.sent > 0 ? ` (${Math.round((f.opened / f.sent) * 100)}%)` : ''}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography>
                      {f.clicked.toLocaleString()}
                      {f.sent > 0 ? ` (${Math.round((f.clicked / f.sent) * 100)}%)` : ''}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography textColor={f.failed > 0 ? 'danger600' : undefined}>
                      {f.failed.toLocaleString()}
                    </Typography>
                  </Td>
                  <Td><Typography>{f.pending.toLocaleString()}</Typography></Td>
                  <Td><Typography>{f.skipped.toLocaleString()}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* Manual trigger */}
      <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius>
        <Typography variant="delta">Manually Run a Flow</Typography>
        <Box paddingTop={1} paddingBottom={4}>
          <Typography variant="pi" textColor="neutral600">
            The daily crons only catch users who match "today's" exact signup-date window. Use this to backfill
            every currently-eligible existing user right now, regardless of when they signed up.
          </Typography>
        </Box>

        {triggerResult && (
          <Box paddingBottom={4}>
            <Alert closeLabel="Close" title="Triggered" variant="success" onClose={() => setTriggerResult(null)}>
              {FLOW_LABELS[triggerResult.flow] || triggerResult.flow}: sent to {triggerResult.sent} user
              {triggerResult.sent === 1 ? '' : 's'}
              {triggerResult.failed > 0 ? `, ${triggerResult.failed} failed` : ''}.
            </Alert>
          </Box>
        )}
        {triggerError && (
          <Box paddingBottom={4}>
            <Alert closeLabel="Close" title="Failed" variant="danger" onClose={() => setTriggerError(null)}>
              {triggerError}
            </Alert>
          </Box>
        )}

        <Flex gap={4} wrap="wrap">
          {TRIGGERABLE_FLOWS.map((flow) => {
            const count = triggerPreviews[flow];
            return (
              <Box
                key={flow}
                padding={4}
                borderColor="neutral200"
                hasRadius
                style={{ flex: '1 1 240px', minWidth: '240px' }}
              >
                <Typography fontWeight="semiBold">{FLOW_LABELS[flow]}</Typography>
                <Box paddingTop={2} paddingBottom={3}>
                  <Typography variant="pi" textColor="neutral600">
                    {count == null ? 'Loading eligible count…' : `${count} eligible user${count === 1 ? '' : 's'} right now`}
                  </Typography>
                </Box>
                <Button
                  onClick={() => handleTrigger(flow)}
                  loading={triggering === flow}
                  disabled={triggering !== null || !count}
                  variant="secondary"
                  fullWidth
                >
                  Run Now
                </Button>
              </Box>
            );
          })}
        </Flex>
      </Box>
    </Box>
  );
}

function VariantResultsCard({ title, results }: { title: string; results: VariantResult[] | null }) {
  const rows = results ?? [];
  const hasData = rows.some((r) => r.sent > 0);

  return (
    <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius marginBottom={6}>
      <Typography variant="delta">{title}</Typography>
      <Box paddingTop={1} paddingBottom={4}>
        <Typography variant="pi" textColor="neutral600">
          Each variant is a genuinely different sales angle, assigned deterministically per user - the same
          person always sees the same variant. "Converted" means currently on an active paid subscription.
        </Typography>
      </Box>
      {!hasData ? (
        <Typography textColor="neutral600">No sends yet.</Typography>
      ) : (
        <Table colCount={6} rowCount={rows.length}>
          <Thead>
            <Tr>
              <Th><Typography variant="sigma">Variant</Typography></Th>
              <Th><Typography variant="sigma">Sent</Typography></Th>
              <Th><Typography variant="sigma">Opened</Typography></Th>
              <Th><Typography variant="sigma">Clicked</Typography></Th>
              <Th><Typography variant="sigma">Converted</Typography></Th>
              <Th><Typography variant="sigma">Conversion Rate</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.variant}>
                <Td><Typography fontWeight="semiBold">{VARIANT_LABELS[r.variant] || r.variant}</Typography></Td>
                <Td><Typography>{r.sent.toLocaleString()}</Typography></Td>
                <Td><Typography>{r.opened.toLocaleString()}</Typography></Td>
                <Td><Typography>{r.clicked.toLocaleString()}</Typography></Td>
                <Td><Typography textColor="success600">{r.converted.toLocaleString()}</Typography></Td>
                <Td>
                  <Typography fontWeight="semiBold">
                    {r.sent > 0 ? `${((r.converted / r.sent) * 100).toFixed(1)}%` : '—'}
                  </Typography>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
}
