import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@strapi/design-system';
import { adminFetch, LTextInput } from '../_ops';
import { Badge, Card, CardHead, EmptyState, Row, Segmented, Skeleton, Stack } from '../../ui/primitives';
import { usePalette } from '../../ui/theme';
import { ConfirmButton, PlatformMark, Select, stamp } from './bits';
import type { Notify, PlatformInfo, Post } from './types';

const PAGE = 50;
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'draft', label: 'Drafts' },
];

export function History({
  platforms,
  notify,
  initialPlatform = '',
  initialStatus = '',
  onChanged,
}: {
  platforms: PlatformInfo[];
  notify: Notify;
  initialPlatform?: string;
  initialStatus?: string;
  /** Called after something changed, so the other tabs' numbers refresh. */
  onChanged?: () => void;
}) {
  const p = usePalette();
  const [platform, setPlatform] = useState(initialPlatform);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const label = (id: string) => platforms.find((x) => x.id === id)?.label ?? id;

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (platform) params.set('platform', platform);
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      if (before) params.set('before', before);
      return `/marketing/posts?${params.toString()}`;
    },
    [platform, status, q],
  );

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const data = await adminFetch<Post[]>(query());
      if (id !== seq.current) return;
      setRows(data);
      setMore(data.length === PAGE);
      setError(null);
    } catch (e: any) {
      if (id === seq.current) setError(e.message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const data = await adminFetch<Post[]>(query(last.publishedAt));
      setRows((r) => [...r, ...data]);
      setMore(data.length === PAGE);
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function act(key: string, fn: () => Promise<string | void>, refresh = true) {
    setBusy(key);
    try {
      const msg = await fn();
      if (msg) notify(msg);
      if (refresh) await load();
      onChanged?.();
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setBusy(null);
    }
  }

  const resend = (post: Post) =>
    act(`resend-${post.id}`, async () => {
      const r = await adminFetch<{ postId: string; url?: string }>(`/marketing/posts/${post.id}/resend`, { method: 'POST' });
      return `${post.status === 'draft' ? 'Published' : post.status === 'failed' ? 'Posted on the retry' : 'Sent again'} to ${label(post.platform)}${r.url ? `: ${r.url}` : ''}`;
    });

  const remove = (post: Post) =>
    act(
      `del-${post.id}`,
      async () => {
        await adminFetch(`/marketing/posts/${post.id}`, { method: 'DELETE' });
        setRows((r) => r.filter((x) => x.id !== post.id));
        return 'Removed from the history.';
      },
      false,
    );

  const clearFailed = () =>
    act('clear', async () => {
      const r = await adminFetch<{ deleted: number }>(`/marketing/failed-posts${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`, { method: 'DELETE' });
      return `Removed ${r.deleted} failed attempt${r.deleted === 1 ? '' : 's'}.`;
    });

  const failedShown = rows.some((r) => r.status === 'failed');
  const filtered = !!(platform || status || q);

  return (
    <Card>
      <CardHead
        title="Post history"
        hint="Every post the system has made or tried to make. Resend publishes the same text and images as a new post; Retry tries a failed one again and replaces its entry. Delete only removes the entry here, not the post."
        right={<Button size="S" variant="tertiary" onClick={load} disabled={loading}>Refresh</Button>}
      />

      <Row $gap={10} $wrap style={{ marginBottom: 14 }}>
        <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All platforms</option>
          {platforms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </Select>
        <Segmented value={status} options={STATUSES} onChange={setStatus} label="Status" />
        <div style={{ flex: '1 1 200px', maxWidth: 320 }}>
          <LTextInput label="Search" name="search" placeholder="Search the text or the error" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
        </div>
        {failedShown && <ConfirmButton label="Clear failed" confirmLabel={`Clear failed${platform ? ` ${label(platform)}` : ''}`} loading={busy === 'clear'} disabled={!!busy} onConfirm={clearFailed} />}
      </Row>

      {error ? (
        <Row $justify="space-between"><span style={{ color: p.danger }}>Could not load the history: {error}</span><Button size="S" variant="secondary" onClick={load}>Try again</Button></Row>
      ) : loading ? (
        <Stack $gap={10}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} $h={44} />)}</Stack>
      ) : rows.length === 0 ? (
        <EmptyState title={filtered ? 'No post matches these filters' : 'Nothing has been posted yet'}>{filtered ? 'Clear a filter to see more.' : 'Posts appear here as soon as one is made or attempted.'}</EmptyState>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: p.muted, fontSize: 12 }}>
                  {['When', 'Account', 'Post', 'Status', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', fontWeight: 600, borderBottom: `1px solid ${p.border}` }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((post) => (
                  <tr key={post.id}>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, fontSize: 13, color: p.muted, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{stamp(post.publishedAt)}</td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, verticalAlign: 'top' }}>
                      <Row $gap={8}>
                        <PlatformMark platform={post.platform} size={26} />
                        <div style={{ fontSize: 13, color: p.text, fontWeight: 600 }}>{post.credential?.accountName ?? label(post.platform)}</div>
                      </Row>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, verticalAlign: 'top', maxWidth: 420 }}>
                      <div title={post.content} style={{ color: p.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>{post.content}</div>
                      <div style={{ fontSize: 12, color: p.muted, marginTop: 2 }}>
                        {post.mediaUrls?.length ? `${post.mediaUrls.length} image${post.mediaUrls.length === 1 ? '' : 's'}` : 'Text only'}
                        {post.reportId ? ` · report ${post.reportId}` : ''}
                      </div>
                      {post.status === 'failed' && post.error ? <div style={{ fontSize: 12, color: p.danger, marginTop: 4 }}>{post.error}</div> : null}
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, verticalAlign: 'top' }}>
                      <Badge tone={post.status === 'published' ? 'good' : post.status === 'failed' ? 'bad' : 'neutral'}>{post.status === 'draft' ? 'Draft' : post.status === 'failed' ? 'Failed' : 'Published'}</Badge>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, verticalAlign: 'top' }}>
                      <Row $gap={6} $justify="flex-end" $wrap>
                        {post.status === 'published' && post.url ? <Button size="S" variant="tertiary" onClick={() => window.open(post.url!, '_blank', 'noopener,noreferrer')}>View</Button> : null}
                        <ConfirmButton
                          variant="secondary"
                          label={post.status === 'draft' ? 'Publish' : post.status === 'failed' ? 'Retry' : 'Resend'}
                          confirmLabel={post.status === 'draft' ? `Publish to ${label(post.platform)}` : post.status === 'failed' ? `Retry on ${label(post.platform)}` : `Post again to ${label(post.platform)}`}
                          confirmVariant="success"
                          loading={busy === `resend-${post.id}`}
                          disabled={!!busy}
                          onConfirm={() => resend(post)}
                        />
                        <ConfirmButton label="Delete" confirmLabel="Remove entry" loading={busy === `del-${post.id}`} disabled={!!busy} onConfirm={() => remove(post)} />
                      </Row>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Row $justify="space-between" style={{ marginTop: 14 }}>
            <span style={{ fontSize: 13, color: p.muted }}>Showing {rows.length} post{rows.length === 1 ? '' : 's'}{more ? ', newest first' : '. That is all of them.'}</span>
            {more ? <Button size="S" variant="secondary" loading={loadingMore} onClick={loadMore}>Load older posts</Button> : null}
          </Row>
        </>
      )}
    </Card>
  );
}
