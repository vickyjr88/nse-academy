import React, { useEffect, useMemo, useState } from 'react';
import { adminFetch, LTextInput, LTextarea } from '../_ops';
import { Badge, Card, CardHead, EmptyState, Row, Stack } from '../../ui/primitives';
import { usePalette } from '../../ui/theme';
import { CheckRow, ConfirmButton, FieldLabel, PlatformMark, tabButtonLabel, todayNairobi } from './bits';
import type { Account, Notify, PlatformInfo } from './types';

interface Result {
  platform: string;
  credentialId: string;
  status: 'posted' | 'skipped' | 'failed';
  url?: string;
  reason?: string;
}

function AccountPicker({
  accounts,
  platforms,
  selected,
  onChange,
}: {
  accounts: Account[];
  platforms: PlatformInfo[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const p = usePalette();
  const label = (id: string) => platforms.find((x) => x.id === id)?.label ?? id;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  if (accounts.length === 0) return <EmptyState title="No active account">Connect or resume an account on the Accounts tab first.</EmptyState>;
  return (
    <div>
      <Row $justify="space-between" style={{ marginBottom: 6 }}>
        <FieldLabel style={{ padding: 0 }}>Post to</FieldLabel>
        <span style={{ fontSize: 12 }}>
          <a href="#all" onClick={(e) => { e.preventDefault(); onChange(accounts.map((a) => a.id)); }} style={{ color: p.primary, fontWeight: 600 }}>All</a>
          {' · '}
          <a href="#none" onClick={(e) => { e.preventDefault(); onChange([]); }} style={{ color: p.primary, fontWeight: 600 }}>None</a>
        </span>
      </Row>
      <Row $gap={8} $wrap>
        {accounts.map((a) => (
          <CheckRow key={a.id} $on={selected.includes(a.id)}>
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            <PlatformMark platform={a.platform} size={22} />
            <span>
              {label(a.platform)} <span style={{ color: p.muted }}>· {a.accountName}</span>
            </span>
            {a.health.state === 'expired' ? <Badge tone="bad">Token ended</Badge> : null}
          </CheckRow>
        ))}
      </Row>
    </div>
  );
}

function Results({ rows, accounts, platforms }: { rows: Result[]; accounts: Account[]; platforms: PlatformInfo[] }) {
  const p = usePalette();
  if (rows.length === 0) return null;
  return (
    <Stack $gap={0} style={{ marginTop: 14 }} aria-live="polite">
      {rows.map((r) => {
        const a = accounts.find((x) => x.id === r.credentialId);
        const name = `${platforms.find((x) => x.id === r.platform)?.label ?? r.platform}${a ? ` · ${a.accountName}` : ''}`;
        return (
          <Row key={r.credentialId} $justify="space-between" $gap={12} style={{ padding: '8px 0', borderTop: `1px solid ${p.soft}` }}>
            <Row $gap={10} style={{ minWidth: 0 }}>
              <Badge tone={r.status === 'posted' ? 'good' : r.status === 'failed' ? 'bad' : 'neutral'}>{r.status === 'posted' ? 'Posted' : r.status === 'failed' ? 'Failed' : 'Skipped'}</Badge>
              <span style={{ color: p.text, fontWeight: 600 }}>{name}</span>
            </Row>
            <span style={{ fontSize: 13, color: r.status === 'failed' ? p.danger : p.muted, textAlign: 'right' }}>
              {r.status === 'posted' && r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: p.primary, fontWeight: 600 }}>View post</a> : r.reason ?? ''}
            </span>
          </Row>
        );
      })}
    </Stack>
  );
}

export function Compose({ accounts, platforms, reload, notify }: { accounts: Account[]; platforms: PlatformInfo[]; reload: () => void; notify: Notify }) {
  const p = usePalette();
  const active = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const [busy, setBusy] = useState<string | null>(null);

  // Market report
  const [reportDate, setReportDate] = useState(todayNairobi());
  const [reportPick, setReportPick] = useState<string[]>([]);
  const [reportResults, setReportResults] = useState<Result[]>([]);

  // Custom post
  const [postPick, setPostPick] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [images, setImages] = useState('');
  const [postResults, setPostResults] = useState<Result[]>([]);

  // Start with every active account ticked, but only once, so a later untick sticks.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && active.length) {
      setReportPick(active.filter((a) => a.health.state !== 'expired').map((a) => a.id));
      setSeeded(true);
    }
  }, [active, seeded]);

  const info = (id: string) => platforms.find((x) => x.id === id);
  const chosen = active.filter((a) => postPick.includes(a.id));
  const mediaUrls = images.split(/[\s,]+/).filter(Boolean);
  const limit = chosen.length ? Math.min(...chosen.map((a) => info(a.platform)?.textLimit ?? 280)) : 280;
  const needImage = chosen.filter((a) => info(a.platform)?.needsMedia && mediaUrls.length === 0);
  const tooLong = content.length > limit;
  const postReady = chosen.length > 0 && content.trim() !== '' && needImage.length === 0 && !tooLong;
  const reportReady = reportPick.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(reportDate);

  async function postReport() {
    setBusy('report');
    setReportResults([]);
    try {
      const targets = active.filter((a) => reportPick.includes(a.id)).map((a) => ({ platform: a.platform, credentialId: a.id }));
      const r = await adminFetch<{ results: Result[] }>('/marketing/report/post', { method: 'POST', body: JSON.stringify({ reportDate, targets }) });
      setReportResults(r.results);
      const ok = r.results.filter((x) => x.status === 'posted').length;
      const bad = r.results.filter((x) => x.status === 'failed').length;
      notify(`Report for ${reportDate}: ${ok} posted${bad ? `, ${bad} failed` : ''}${r.results.length - ok - bad ? `, ${r.results.length - ok - bad} skipped` : ''}.`, bad > 0 && ok === 0);
      reload();
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setBusy(null);
    }
  }

  async function postCustom() {
    setBusy('post');
    setPostResults([]);
    const rows: Result[] = [];
    // One at a time: each platform has its own limits, and a failure on one should not hide the others.
    for (const a of chosen) {
      try {
        const r = await adminFetch<{ postId: string; url?: string }>('/marketing/post', {
          method: 'POST',
          body: JSON.stringify({ platform: a.platform, credentialId: a.id, content, ...(mediaUrls.length ? { mediaUrls } : {}) }),
        });
        rows.push({ platform: a.platform, credentialId: a.id, status: 'posted', url: r.url });
      } catch (e: any) {
        rows.push({ platform: a.platform, credentialId: a.id, status: 'failed', reason: e.message });
      }
      setPostResults([...rows]);
    }
    const ok = rows.filter((r) => r.status === 'posted').length;
    if (ok === rows.length) {
      setContent('');
      setImages('');
    }
    notify(`${ok} of ${rows.length} posted.`, ok === 0);
    reload();
    setBusy(null);
  }

  return (
    <Stack $gap={20}>
      <Card>
        <CardHead
          title="Post a market report"
          hint="Posts that day's verified sentence with its cards, adapted for each platform (X takes four cards, Facebook and Threads one, Instagram a carousel). Pick a past date to publish an older report again."
        />
        <Stack $gap={14}>
          <div style={{ maxWidth: 220 }}>
            <LTextInput label="Report date" name="reportDate" type="date" value={reportDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportDate(e.target.value)} />
          </div>
          <AccountPicker accounts={active} platforms={platforms} selected={reportPick} onChange={setReportPick} />
          <Row $gap={10}>
            <ConfirmButton
              size="M"
              variant="default"
              confirmVariant="success"
              label={`Post to ${tabButtonLabel(reportPick.length, 'account')}`}
              confirmLabel="Yes, publish now"
              disabled={!reportReady || !!busy}
              loading={busy === 'report'}
              onConfirm={postReport}
            />
            <span style={{ fontSize: 12, color: p.muted }}>This publishes immediately. The report must already be published on the site.</span>
          </Row>
          <Results rows={reportResults} accounts={accounts} platforms={platforms} />
        </Stack>
      </Card>

      <Card>
        <CardHead title="Write a post" hint="Your own text to any connected accounts. Image links must be public. Instagram and TikTok cannot post without an image." />
        <Stack $gap={14}>
          <AccountPicker accounts={active} platforms={platforms} selected={postPick} onChange={setPostPick} />
          <div>
            <LTextarea
              label={`Post text (${content.length}/${limit})`}
              name="content"
              rows={5}
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            />
            {tooLong ? <div style={{ fontSize: 12, color: p.danger, marginTop: 4 }}>Too long for {chosen.filter((a) => (info(a.platform)?.textLimit ?? 0) === limit).map((a) => info(a.platform)?.label).join(', ')}: the limit is {limit} characters.</div> : null}
          </div>
          <LTextarea label="Image links (optional, one per line)" name="mediaUrls" rows={3} placeholder="https://…" value={images} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImages(e.target.value)} />
          {needImage.length > 0 && (
            <div style={{ fontSize: 13, color: p.warning }}>
              {needImage.map((a) => info(a.platform)?.label).join(' and ')} need{needImage.length === 1 ? 's' : ''} an image. Add a link, or untick {needImage.length === 1 ? 'it' : 'them'}.
            </div>
          )}
          <Row $gap={10}>
            <ConfirmButton
              size="M"
              variant="default"
              confirmVariant="success"
              label={`Post to ${tabButtonLabel(chosen.length, 'account')}`}
              confirmLabel="Yes, publish now"
              disabled={!postReady || !!busy}
              loading={busy === 'post'}
              onConfirm={postCustom}
            />
            {content.trim() ? <span style={{ fontSize: 12, color: p.muted }}>{mediaUrls.length} image{mediaUrls.length === 1 ? '' : 's'}</span> : null}
          </Row>
          <Results rows={postResults} accounts={accounts} platforms={platforms} />
        </Stack>
      </Card>
    </Stack>
  );
}
