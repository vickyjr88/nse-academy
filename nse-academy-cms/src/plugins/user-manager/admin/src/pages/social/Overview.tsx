import React, { useMemo, useState } from 'react';
import { Button } from '@strapi/design-system';
import { useApi } from '../../ui/api';
import { Kpi, KpiSkeleton } from '../../ui/kpi';
import { Bars } from '../../ui/charts';
import { Badge, Card, CardHead, EmptyState, Grid, Row, Segmented, Skeleton, Split, Stack } from '../../ui/primitives';
import { ago, shortDay, whole } from '../../ui/format';
import { usePalette } from '../../ui/theme';
import { PlatformMark } from './bits';
import type { Account, AutomationLite, PlatformInfo, Summary, TabId } from './types';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

interface Item {
  key: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
  go: () => void;
}

const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

export function Overview({
  accounts,
  platforms,
  goTo,
}: {
  accounts: Account[];
  platforms: PlatformInfo[];
  goTo: (tab: TabId, params?: Record<string, string>) => void;
}) {
  const p = usePalette();
  const [days, setDays] = useState(14);
  const summary = useApi<Summary>(`/marketing/summary?days=${days}`);
  const automation = useApi<AutomationLite>('/marketing/x/automation');
  const s = summary.data;
  const label = (id: string) => platforms.find((x) => x.id === id)?.label ?? id;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const active = accounts.filter((a) => a.isActive);
    if (accounts.length === 0) {
      out.push({ key: 'none', severity: 'high', title: 'No social account is connected', detail: 'Connect an account before anything can be posted.', action: 'Add account', go: () => goTo('accounts', { add: '1' }) });
    }
    for (const a of accounts) {
      const who = `${label(a.platform)} · ${a.accountName}`;
      if (a.health.state === 'expired') out.push({ key: `e${a.id}`, severity: 'high', title: `${who}: the token has ended`, detail: 'Posts to this account will fail until you paste a new token.', action: 'Update token', go: () => goTo('accounts', { edit: a.id }) });
      else if (a.health.state === 'expiring') out.push({ key: `x${a.id}`, severity: 'medium', title: `${who}: the token ends in ${a.health.daysLeft} day${a.health.daysLeft === 1 ? '' : 's'}`, detail: 'Replace it before then so posting does not stop.', action: 'Update token', go: () => goTo('accounts', { edit: a.id }) });
      else if (a.health.state === 'untested') out.push({ key: `u${a.id}`, severity: 'low', title: `${who} has not been tested`, detail: 'Press Test to check the keys against the platform.', action: 'Open accounts', go: () => goTo('accounts') });
    }
    if (s && s.totals.failed > 0) {
      out.push({ key: 'failed', severity: 'medium', title: `${whole(s.totals.failed)} post${s.totals.failed === 1 ? '' : 's'} failed in the last ${s.days} days`, detail: 'Open the failed posts to see the reason and send them again.', action: 'See failed', go: () => goTo('history', { status: 'failed' }) });
    }
    const auto = automation.data;
    if (auto) {
      if (auto.config.enabled && auto.config.mode === 'draft') out.push({ key: 'draft', severity: 'medium', title: 'Hourly posting is in draft mode', detail: 'Posts are saved as drafts and nothing is published until you switch it to live.', action: 'Open settings', go: () => goTo('hourly') });
      if (!auto.config.enabled) out.push({ key: 'off', severity: 'low', title: 'Hourly posting is off', detail: 'The market sentences are not posting on their own.', action: 'Open settings', go: () => goTo('hourly') });
      for (const t of auto.config.platforms ?? []) {
        if (t.enabled && !accounts.some((a) => a.platform === t.platform && a.isActive)) {
          out.push({ key: `t${t.platform}`, severity: 'high', title: `${label(t.platform)} is switched on for hourly posting but has no active account`, detail: 'Its slots are skipped until an account is connected or resumed.', action: 'Open accounts', go: () => goTo('accounts') });
        }
      }
    }
    const order = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, s, automation.data, platforms]);

  const connected = new Set(accounts.filter((a) => a.isActive).map((a) => a.platform));
  const tone = { high: p.danger, medium: p.warning, low: p.faint } as const;
  const todayRuns = automation.data?.runs ?? [];

  return (
    <Stack $gap={20}>
      <Row $justify="space-between" $wrap>
        <span style={{ color: p.muted, fontSize: 13 }}>Posts across every connected platform, by Nairobi day.</span>
        <Segmented value={days} options={RANGES} onChange={setDays} label="Period" />
      </Row>

      {summary.error ? (
        <Card><Row $justify="space-between"><span style={{ color: p.danger }}>Could not load the figures: {summary.error}</span><Button size="S" variant="secondary" onClick={summary.reload}>Try again</Button></Row></Card>
      ) : (
        <Grid $min={220}>
          {s ? (
            <>
              <Kpi label="Posts published" value={whole(s.totals.published)} delta={change(s.totals.published, s.previous.published)} spark={s.byDay.map((d) => d.published)} />
              <Kpi label="Success rate" value={s.totals.successRate === null ? '–' : `${s.totals.successRate}%`} hint={s.totals.successRate === null ? 'Nothing attempted yet' : `${whole(s.totals.failed)} failed`} />
              <Kpi label="Failed posts" value={whole(s.totals.failed)} delta={change(s.totals.failed, s.previous.failed)} rise="bad" />
              <Kpi label="Platforms connected" value={`${connected.size} of ${platforms.length || 5}`} hint={connected.size < platforms.length ? `Missing: ${platforms.filter((x) => !connected.has(x.id)).map((x) => x.label).join(', ')}` : 'All set'} />
            </>
          ) : (
            [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
          )}
        </Grid>
      )}

      <Card>
        <CardHead title="Needs your attention" />
        {automation.loading && !s ? (
          <Skeleton $h={56} />
        ) : items.length === 0 ? (
          <Row $gap={10} style={{ padding: '6px 0' }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: p.success }} />
            <span style={{ color: p.text, fontWeight: 600 }}>All clear.</span>
            <span style={{ color: p.muted }}>Every account is healthy and nothing has failed recently.</span>
          </Row>
        ) : (
          <Stack $gap={0}>
            {items.map((it) => (
              <Row key={it.key} $justify="space-between" $gap={16} style={{ padding: '10px 0', borderTop: `1px solid ${p.soft}` }}>
                <Row $gap={10} $align="flex-start" style={{ minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: tone[it.severity], flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: p.text }}>{it.title}</div>
                    <div style={{ fontSize: 13, color: p.muted }}>{it.detail}</div>
                  </div>
                </Row>
                <Button size="S" variant="secondary" onClick={it.go}>{it.action}</Button>
              </Row>
            ))}
          </Stack>
        )}
      </Card>

      <Split $ratio="2fr 1fr">
        <Card>
          <CardHead title="Posts per day" hint="Published, failed and saved-as-draft posts, all platforms." />
          {s ? (
            s.totals.published + s.totals.failed + s.totals.draft === 0 ? (
              <EmptyState title="Nothing posted in this period">Posts will show up here as the hourly slots run or you publish by hand.</EmptyState>
            ) : (
              <Bars
                data={s.byDay}
                x="day"
                xFormat={shortDay}
                stacked
                height={230}
                series={[
                  { key: 'published', label: 'Published', color: p.success },
                  { key: 'failed', label: 'Failed', color: p.danger },
                  { key: 'draft', label: 'Draft', color: p.faint },
                ]}
              />
            )
          ) : (
            <Skeleton $h={230} />
          )}
        </Card>
        <Card>
          <CardHead title="Hourly posting today" hint={automation.data ? (automation.data.config.enabled ? `On, ${automation.data.config.mode} mode` : 'Off') : undefined} right={<Button size="S" variant="tertiary" onClick={() => goTo('hourly')}>Settings</Button>} />
          {!automation.data ? (
            <Skeleton $h={120} />
          ) : todayRuns.length === 0 ? (
            <EmptyState title="No slot has run yet today" />
          ) : (
            <Stack $gap={8}>
              {todayRuns.slice(-6).reverse().map((r) => (
                <Row key={r.slotId} $justify="space-between" $gap={8}>
                  <span style={{ color: p.text, fontSize: 13 }}>{r.slotId}</span>
                  <Badge tone={r.status === 'posted' ? 'good' : r.status === 'failed' ? 'bad' : 'neutral'}>{r.status}</Badge>
                </Row>
              ))}
            </Stack>
          )}
        </Card>
      </Split>

      <Card>
        <CardHead title="Platforms" hint={`Last ${days} days. A platform with no active account is skipped by the hourly slots.`} />
        <Grid $min={250}>
          {platforms.map((pl) => {
            const stat = s?.byPlatform.find((x) => x.platform === pl.id);
            const mine = accounts.filter((a) => a.platform === pl.id);
            const live = mine.filter((a) => a.isActive);
            const worst = live.find((a) => a.health.state === 'expired') ? 'expired' : live.find((a) => a.health.state === 'expiring') ? 'expiring' : null;
            return (
              <div key={pl.id} style={{ border: `1px solid ${p.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row $justify="space-between">
                  <Row $gap={10}>
                    <PlatformMark platform={pl.id} />
                    <strong style={{ color: p.text }}>{pl.label}</strong>
                  </Row>
                  {live.length === 0 ? <Badge>{mine.length ? 'Paused' : 'Not connected'}</Badge> : worst === 'expired' ? <Badge tone="bad">Token ended</Badge> : worst === 'expiring' ? <Badge tone="warn">Token ending</Badge> : <Badge tone="good">Connected</Badge>}
                </Row>
                {s ? (
                  <div style={{ fontSize: 13, color: p.muted, lineHeight: 1.6 }}>
                    <div>{whole(stat?.published ?? 0)} published{stat && stat.failed ? <>, <span style={{ color: p.danger }}>{whole(stat.failed)} failed</span></> : null}{stat?.successRate != null ? ` · ${stat.successRate}%` : ''}</div>
                    <div>{stat?.lastPublishedAt ? `Last post ${ago(stat.lastPublishedAt)}` : 'No post in this period'}</div>
                  </div>
                ) : (
                  <Skeleton $h={36} />
                )}
                <Row $gap={8}>
                  {live.length === 0 ? (
                    <Button size="S" variant="default" onClick={() => goTo('accounts', { add: pl.id })}>{mine.length ? 'Open accounts' : 'Connect'}</Button>
                  ) : (
                    <Button size="S" variant="secondary" onClick={() => goTo('post')}>Post</Button>
                  )}
                  <Button size="S" variant="tertiary" onClick={() => goTo('history', { platform: pl.id })}>History</Button>
                </Row>
              </div>
            );
          })}
        </Grid>
      </Card>
    </Stack>
  );
}
