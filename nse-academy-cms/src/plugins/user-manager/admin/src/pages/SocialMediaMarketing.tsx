import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@strapi/design-system';
import { useSearchParams } from 'react-router-dom';
import { Page } from '../ui/page';
import { useApi } from '../ui/api';
import { Badge, Card, Row, Segmented, Skeleton, Stack } from '../ui/primitives';
import { usePalette } from '../ui/theme';
import { XAutomationPanel } from './XAutomationPanel';
import { Overview } from './social/Overview';
import { Accounts } from './social/Accounts';
import { Compose } from './social/Compose';
import { History } from './social/History';
import type { Account, PlatformInfo, TabId } from './social/types';

const TABS: { value: TabId; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'post', label: 'Post' },
  { value: 'hourly', label: 'Hourly posting' },
  { value: 'history', label: 'History' },
];

const isTab = (v: string | null): v is TabId => !!v && TABS.some((t) => t.value === v);

/**
 * One place for every social account and post: how it is going, who is connected, publishing by hand, the hourly
 * schedule and the full history. The tab and its filters live in the address, so links from one tab to another work.
 */
export function SocialMediaMarketing() {
  const p = usePalette();
  const [params, setParams] = useSearchParams();
  const tab: TabId = isTab(params.get('tab')) ? (params.get('tab') as TabId) : 'overview';

  const platformsQ = useApi<PlatformInfo[]>('/marketing/platforms');
  const accountsQ = useApi<Account[]>('/marketing/accounts?includePaused=true');
  const platforms = platformsQ.data ?? [];
  const accounts = accountsQ.data ?? [];

  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const notify = useCallback((text: string, bad = false) => setMessage({ text, bad }), []);

  // A success message goes away on its own; an error stays until it is dismissed or replaced.
  useEffect(() => {
    if (!message || message.bad) return;
    const t = setTimeout(() => setMessage(null), 9000);
    return () => clearTimeout(t);
  }, [message]);

  const goTo = useCallback(
    (next: TabId, extra: Record<string, string> = {}) => {
      setMessage(null);
      setParams({ tab: next, ...extra });
    },
    [setParams],
  );

  const failed = platformsQ.error || accountsQ.error;
  const loading = (platformsQ.loading && !platformsQ.data) || (accountsQ.loading && !accountsQ.data);
  const needAttention = accounts.filter((a) => a.health.state === 'expired' || a.health.state === 'expiring').length;

  return (
    <Page
      title="Social media"
      description="One story, posted to X, Facebook, Instagram, Threads and TikTok. Every account and key lives here, encrypted."
      actions={needAttention > 0 ? <Badge tone="warn">{needAttention} account{needAttention === 1 ? '' : 's'} need a new token</Badge> : undefined}
    >
      {/* Scrolls sideways on a phone instead of clipping the last tabs. */}
      <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
        <Segmented value={tab} options={TABS} onChange={(t) => goTo(t)} label="Section" />
      </div>

      {message && (
        <Card $pad={12} role={message.bad ? 'alert' : 'status'} style={{ borderColor: message.bad ? p.danger : p.success }}>
          <Row $justify="space-between" $gap={12}>
            <Row $gap={10} style={{ minWidth: 0 }}>
              <Badge tone={message.bad ? 'bad' : 'good'}>{message.bad ? 'Problem' : 'Done'}</Badge>
              <span style={{ color: p.text, overflowWrap: 'anywhere' }}>{message.text}</span>
            </Row>
            <Button size="S" variant="tertiary" onClick={() => setMessage(null)}>Dismiss</Button>
          </Row>
        </Card>
      )}

      {failed ? (
        <Card>
          <Row $justify="space-between" $gap={12}>
            <span style={{ color: p.danger }}>Could not load the social media data: {platformsQ.error || accountsQ.error}</span>
            <Button size="S" variant="secondary" onClick={() => { platformsQ.reload(); accountsQ.reload(); }}>Try again</Button>
          </Row>
        </Card>
      ) : loading ? (
        <Stack $gap={14}><Skeleton $h={90} /><Skeleton $h={220} /></Stack>
      ) : (
        <>
          {tab === 'overview' && <Overview accounts={accounts} platforms={platforms} goTo={goTo} />}
          {tab === 'accounts' && (
            <Accounts
              accounts={accounts}
              platforms={platforms}
              reload={accountsQ.reload}
              notify={notify}
              openAdd={params.get('add')}
              openEdit={params.get('edit')}
            />
          )}
          {tab === 'post' && <Compose accounts={accounts} platforms={platforms} reload={accountsQ.reload} notify={notify} />}
          {tab === 'hourly' && <XAutomationPanel accounts={accounts.filter((a) => a.isActive)} platforms={platforms} />}
          {tab === 'history' && (
            <History
              key={`${params.get('platform') ?? ''}|${params.get('status') ?? ''}`}
              platforms={platforms}
              notify={notify}
              initialPlatform={params.get('platform') ?? ''}
              initialStatus={params.get('status') ?? ''}
            />
          )}
        </>
      )}
    </Page>
  );
}
