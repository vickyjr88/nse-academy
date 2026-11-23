import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, day, when, LTextInput, LTextarea } from './_ops';
import { Card, CardHead } from '../ui/primitives';
import { XAutomationPanel } from './XAutomationPanel';

interface PlatformInfo { id: string; label: string; needsMedia: boolean; textLimit: number }
interface Credential {
  id: string;
  platform: string;
  accountName: string;
  externalId: string | null;
  expiresAt: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  hasBearer?: boolean;
  hasRefreshToken?: boolean;
}
interface Post {
  id: string;
  platform: string;
  externalPostId: string;
  url: string | null;
  content: string;
  mediaUrls: string[];
  status: string;
  error: string | null;
  reportId: string | null;
  publishedAt: string;
  credential?: { accountName: string };
}

type Field = 'accountName' | 'externalId' | 'apiKey' | 'apiSecret' | 'accessToken' | 'accessTokenSecret' | 'refreshToken' | 'bearerToken' | 'expiresAt';
const EMPTY_CREDENTIAL: Record<Field, string> & { platform: string } = {
  platform: 'x',
  accountName: '',
  externalId: '',
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  accessTokenSecret: '',
  refreshToken: '',
  bearerToken: '',
  expiresAt: '',
};

const PLATFORM_HINTS: Record<string, string> = {
  x: 'The four OAuth 1.0a keys from the X developer console. The bearer token is only for reads.',
  facebook: 'A Page access token and the numeric Page ID. The token needs pages_manage_posts.',
  instagram: 'A long-lived token and the Instagram professional account ID, not the Page ID. Publishing needs an image.',
  threads: 'A Threads access token. The user ID is filled in automatically when it is blank.',
  tiktok: 'An access token plus the open_id, client key and client secret. Store the refresh token so the 24-hour token renews itself.',
};

const dateOnly = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #8e8ea9', background: 'transparent', color: 'inherit' };

export function SocialMediaMarketing() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [historyPlatform, setHistoryPlatform] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState(EMPTY_CREDENTIAL);
  const [reportForm, setReportForm] = useState({ credentialId: '', reportDate: '' });
  const [postForm, setPostForm] = useState({ credentialId: '', content: '', mediaUrls: '' });

  const load = useCallback(async () => {
    try {
      const [platformList, accounts, history] = await Promise.all([
        adminFetch<PlatformInfo[]>('/marketing/platforms'),
        adminFetch<Credential[]>('/marketing/accounts'),
        adminFetch<Post[]>('/marketing/posts'),
      ]);
      setPlatforms(platformList);
      setCredentials(accounts);
      setPosts(history);
      // Preselect the only X account so report posting needs no extra click.
      const xAccounts = accounts.filter((a) => a.platform === 'x');
      if (xAccounts.length === 1) setReportForm((f) => ({ ...f, credentialId: f.credentialId || xAccounts[0].id }));
      if (accounts.length === 1) setPostForm((f) => ({ ...f, credentialId: f.credentialId || accounts[0].id }));
    } catch (e: any) {
      setMessage({ text: `Could not load social media data: ${e.message}`, bad: true });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const label = useCallback(
    (id: string) => platforms.find((p) => p.id === id)?.label ?? id,
    [platforms],
  );
  const info = useCallback((id: string) => platforms.find((p) => p.id === id), [platforms]);
  const xAccounts = credentials.filter((c) => c.platform === 'x');

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ text: await fn() });
      await load();
    } catch (e: any) {
      setMessage({ text: e.message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  const saveCredential = () => run('save', async () => {
    const platform = credentialForm.platform;
    if (editingId) {
      // Blank key fields mean "keep the stored value"; booleans and dates are sent only when set.
      const changes = Object.fromEntries(Object.entries(credentialForm).filter(([, value]) => value.trim()));
      delete changes.platform;
      await adminFetch(`/marketing/accounts/${editingId}`, { method: 'PUT', body: JSON.stringify(changes) });
      closeForm();
      return `${label(platform)} account updated. Press Test to check the keys.`;
    }
    await adminFetch('/marketing/accounts', { method: 'POST', body: JSON.stringify(credentialForm) });
    closeForm();
    return `${label(platform)} account saved. The keys are stored encrypted.`;
  });

  function closeForm() {
    setCredentialForm(EMPTY_CREDENTIAL);
    setEditingId(null);
    setShowAdd(false);
  }

  function openEdit(c: Credential) {
    setCredentialForm({
      ...EMPTY_CREDENTIAL,
      platform: c.platform,
      accountName: c.accountName,
      externalId: c.externalId ?? '',
      expiresAt: dateOnly(c.expiresAt),
    });
    setEditingId(c.id);
    setShowAdd(true);
  }

  const testCredential = (c: Credential) => run(`test-${c.id}`, async () => {
    const r = await adminFetch<{ success: boolean; message: string }>(`/marketing/accounts/${c.id}/test`, { method: 'POST' });
    if (!r.success) throw new Error(r.message);
    return `${label(c.platform)} · ${c.accountName}: ${r.message}`;
  });

  const deleteCredential = (c: Credential) => window.confirm(`Delete "${c.accountName}"? Its stored keys and its post history here are removed. Posts already on ${label(c.platform)} stay there.`) &&
    run(`delete-${c.id}`, async () => {
      await adminFetch(`/marketing/accounts/${c.id}`, { method: 'DELETE' });
      if (editingId === c.id) closeForm();
      return `${c.accountName} deleted.`;
    });

  const deletePost = (p: Post) => window.confirm('Remove this entry from the history? The post itself, if there is one, is not deleted.') &&
    run(`delpost-${p.id}`, async () => {
      await adminFetch(`/marketing/posts/${p.id}`, { method: 'DELETE' });
      return 'Removed from the history.';
    });

  const clearFailed = () => window.confirm(`Remove every failed ${historyPlatform ? label(historyPlatform) : ''} attempt from the history?`) &&
    run('clear-failed', async () => {
      const query = historyPlatform ? `?platform=${encodeURIComponent(historyPlatform)}` : '';
      const r = await adminFetch<{ deleted: number }>(`/marketing/failed-posts${query}`, { method: 'DELETE' });
      return `Removed ${r.deleted} failed attempt${r.deleted === 1 ? '' : 's'}.`;
    });

  const postReport = () => run('report', async () => {
    const r = await adminFetch<{ url: string }>('/marketing/x/report', { method: 'POST', body: JSON.stringify(reportForm) });
    return `Report for ${reportForm.reportDate} posted to X: ${r.url}`;
  });

  const postCustom = () => run('post', async () => {
    const account = credentials.find((c) => c.id === postForm.credentialId);
    if (!account) throw new Error('Choose an account first');
    const mediaUrls = postForm.mediaUrls.split(/[\s,]+/).filter(Boolean);
    const r = await adminFetch<{ postId: string; url?: string }>('/marketing/post', {
      method: 'POST',
      body: JSON.stringify({ platform: account.platform, credentialId: account.id, content: postForm.content, ...(mediaUrls.length ? { mediaUrls } : {}) }),
    });
    setPostForm((f) => ({ ...f, content: '', mediaUrls: '' }));
    return `Posted to ${label(account.platform)}${r.url ? `: ${r.url}` : ''}`;
  });

  const resend = (p: Post) => window.confirm(p.status === 'draft' ? `Publish this draft to ${label(p.platform)} now?` : `Post this again to ${label(p.platform)}? It will appear as a new post.`) &&
    run(`resend-${p.id}`, async () => {
      const r = await adminFetch<{ postId: string; url?: string }>(`/marketing/posts/${p.id}/resend`, { method: 'POST' });
      return `${p.status === 'draft' ? 'Published' : 'Resent'} to ${label(p.platform)}${r.url ? `: ${r.url}` : ''}`;
    });

  const accountSelect = (value: string, onChange: (id: string) => void, onlyPlatform?: string) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Account</div>
      <select aria-label="Account" style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an account…</option>
        {credentials
          .filter((c) => !onlyPlatform || c.platform === onlyPlatform)
          .map((c) => <option key={c.id} value={c.id}>{label(c.platform)} · {c.accountName}</option>)}
      </select>
    </div>
  );

  if (loading) return <Box padding={8}><Loader>Loading social media…</Loader></Box>;

  const formPlatform = info(credentialForm.platform);
  const editing = editingId !== null;
  const requiredKeys: Field[] = credentialForm.platform === 'x' ? ['accountName', 'apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'] : ['accountName', 'accessToken'];
  const credentialComplete = editing
    ? credentialForm.accountName.trim() !== ''
    : requiredKeys.every((field) => credentialForm[field].trim());
  const reportReady = reportForm.credentialId && /^\d{4}-\d{2}-\d{2}$/.test(reportForm.reportDate);
  const chosenPostAccount = credentials.find((c) => c.id === postForm.credentialId);
  const chosenPlatform = chosenPostAccount ? info(chosenPostAccount.platform) : undefined;
  const postReady = !!chosenPostAccount && postForm.content.trim() !== '' && (!chosenPlatform?.needsMedia || postForm.mediaUrls.trim() !== '');
  const visiblePosts = historyPlatform ? posts.filter((p) => p.platform === historyPlatform) : posts;

  return (
    <Box padding={8}>
      <Box paddingBottom={2}><Typography variant="alpha">Social media</Typography></Box>
      <Box paddingBottom={6}>
        <Typography textColor="neutral600">
          One story, posted to X, a Facebook Page, Instagram, Threads and TikTok. Every account and key lives here, encrypted;
          the hourly slots reuse the X sentence and adapt it to each platform&apos;s limit.
        </Typography>
      </Box>

      {message && (
        <Box paddingBottom={4}>
          <Card $pad={12}><Pill kind={message.bad ? 'bad' : 'good'}>{message.bad ? 'Error' : 'Done'}</Pill> <Typography>{message.text}</Typography></Card>
        </Box>
      )}

      <Box paddingBottom={6}>
        <Card>
          <CardHead
            title="Accounts"
            hint="Tokens are encrypted before they are stored and are never shown again. Add one account per platform (or several on X)."
            right={<Button size="S" variant={showAdd ? 'tertiary' : 'default'} onClick={() => (showAdd ? closeForm() : setShowAdd(true))}>{showAdd ? 'Cancel' : 'Add account'}</Button>}
          />
          {credentials.length === 0 ? (
            <Typography textColor="neutral600">No social account connected yet.</Typography>
          ) : (
            <Table colCount={4} rowCount={credentials.length + 1}>
              <Thead><Tr>{['Platform', 'Account', 'Last tested', ''].map((h, i) => <Th key={i}><Typography variant="sigma">{h || ' '}</Typography></Th>)}</Tr></Thead>
              <Tbody>
                {credentials.map((c) => (
                  <Tr key={c.id}>
                    <Td><Pill>{label(c.platform)}</Pill></Td>
                    <Td>
                      <Typography fontWeight="bold">{c.accountName}</Typography>
                      {c.externalId ? <Typography textColor="neutral600"> · id {c.externalId}</Typography> : null}
                      {c.hasRefreshToken ? <Typography textColor="neutral600"> · refresh token saved</Typography> : null}
                      {c.expiresAt ? <Typography textColor="neutral600"> · token ends {day(c.expiresAt)}</Typography> : null}
                    </Td>
                    <Td><Typography>{when(c.lastTestedAt)}</Typography></Td>
                    <Td>
                      <Flex gap={2}>
                        <Button size="S" variant="secondary" loading={busy === `test-${c.id}`} onClick={() => testCredential(c)}>Test</Button>
                        <Button size="S" variant="tertiary" disabled={!!busy} onClick={() => openEdit(c)}>Edit</Button>
                        <Button size="S" variant="danger-light" loading={busy === `delete-${c.id}`} disabled={!!busy} onClick={() => deleteCredential(c)}>Delete</Button>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {showAdd && (
            <Box paddingTop={5}>
              <Box paddingBottom={3}>
                <Typography variant="delta">{editing ? 'Edit account' : 'Add account'}</Typography>
                <Box><Typography textColor="neutral600">
                  {editing ? 'Leave a key blank to keep the one already stored. Enter only the values that changed.' : PLATFORM_HINTS[credentialForm.platform]}
                </Typography></Box>
              </Box>
              <Flex direction="column" alignItems="stretch" gap={3}>
                {!editing && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Platform</div>
                    <select
                      aria-label="Platform"
                      style={selectStyle}
                      value={credentialForm.platform}
                      onChange={(e) => setCredentialForm({ ...EMPTY_CREDENTIAL, platform: e.target.value, accountName: credentialForm.accountName })}
                    >
                      {platforms.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                )}
                <LTextInput label="Account name" name="accountName" placeholder="e.g. NSE Academy" value={credentialForm.accountName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, accountName: e.target.value })} />

                {credentialForm.platform !== 'x' && (
                  <LTextInput
                    label={credentialForm.platform === 'facebook' ? 'Page ID' : credentialForm.platform === 'instagram' ? 'Instagram professional account ID' : credentialForm.platform === 'threads' ? 'Threads user ID (optional)' : 'TikTok open_id'}
                    name="externalId"
                    placeholder={editing ? 'Unchanged' : 'The numeric id, not the @handle'}
                    value={credentialForm.externalId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, externalId: e.target.value })}
                  />
                )}

                {credentialForm.platform === 'x' && (
                  <>
                    <LTextInput label="API key" name="apiKey" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.apiKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, apiKey: e.target.value })} />
                    <LTextInput label="API secret" name="apiSecret" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.apiSecret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, apiSecret: e.target.value })} />
                    <LTextInput label="Access token" name="accessToken" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.accessToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, accessToken: e.target.value })} />
                    <LTextInput label="Access token secret" name="accessTokenSecret" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.accessTokenSecret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, accessTokenSecret: e.target.value })} />
                    <LTextInput label="Bearer token (reads only, optional)" name="bearerToken" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : 'For the stream and recent search'} value={credentialForm.bearerToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, bearerToken: e.target.value })} />
                  </>
                )}

                {credentialForm.platform !== 'x' && (
                  <>
                    <LTextInput label="Access token" name="accessToken" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.accessToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, accessToken: e.target.value })} />
                    {credentialForm.platform === 'tiktok' && (
                      <>
                        <LTextInput label="Refresh token" name="refreshToken" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.refreshToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, refreshToken: e.target.value })} />
                        <LTextInput label="Client key" name="apiKey" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.apiKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, apiKey: e.target.value })} />
                        <LTextInput label="Client secret" name="apiSecret" type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={credentialForm.apiSecret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, apiSecret: e.target.value })} />
                      </>
                    )}
                    {credentialForm.platform === 'threads' && (
                      <LTextInput label="Token expiry (optional)" name="expiresAt" type="date" value={credentialForm.expiresAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, expiresAt: e.target.value })} />
                    )}
                    {credentialForm.platform === 'tiktok' && (
                      <LTextInput label="Token expiry (optional)" name="expiresAt" type="date" value={credentialForm.expiresAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, expiresAt: e.target.value })} />
                    )}
                  </>
                )}

                <Box><Button disabled={!credentialComplete} loading={busy === 'save'} onClick={saveCredential}>{editing ? 'Save changes' : 'Save account'}</Button></Box>
              </Flex>
            </Box>
          )}
        </Card>
      </Box>

      <XAutomationPanel accounts={credentials} platforms={platforms} />

      <Box paddingBottom={6}>
        <Card>
          <CardHead title="Post a market report to X" hint="Posts that day's verified X sentence with its story cards. Use a past date to publish an older report again. Other platforms publish from the hourly slots." />
          {xAccounts.length === 0 ? <Typography textColor="neutral600">Connect an X account first.</Typography> : (
            <Flex gap={3} alignItems="flex-end" wrap="wrap">
              <Box style={{ minWidth: 220 }}>{accountSelect(reportForm.credentialId, (id) => setReportForm({ ...reportForm, credentialId: id }), 'x')}</Box>
              <Box style={{ minWidth: 180 }}><LTextInput label="Report date" name="reportDate" type="date" value={reportForm.reportDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportForm({ ...reportForm, reportDate: e.target.value })} /></Box>
              <Button disabled={!reportReady} loading={busy === 'report'} onClick={postReport}>Post report</Button>
            </Flex>
          )}
        </Card>
      </Box>

      <Box paddingBottom={6}>
        <Card>
          <CardHead title="Post something else" hint="A custom post to any connected platform, with optional public image links (separated by spaces, commas or new lines). Instagram and TikTok need at least one image." />
          {credentials.length === 0 ? <Typography textColor="neutral600">Connect an account first.</Typography> : (
            <Flex direction="column" alignItems="stretch" gap={3}>
              <Box style={{ maxWidth: 360 }}>{accountSelect(postForm.credentialId, (id) => setPostForm({ ...postForm, credentialId: id }))}</Box>
              <LTextarea
                label={`Post text (${postForm.content.length}/${chosenPlatform?.textLimit ?? 280})`}
                name="content"
                maxLength={chosenPlatform?.textLimit ?? 4000}
                value={postForm.content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostForm({ ...postForm, content: e.target.value })}
              />
              <LTextarea label={`Image links${chosenPlatform?.needsMedia ? ' (required)' : ' (optional)'}`} name="mediaUrls" placeholder="https://…" value={postForm.mediaUrls} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostForm({ ...postForm, mediaUrls: e.target.value })} />
              <Box><Button disabled={!postReady} loading={busy === 'post'} onClick={postCustom}>Post{chosenPlatform ? ` to ${chosenPlatform.label}` : ''}</Button></Box>
            </Flex>
          )}
        </Card>
      </Box>

      <Card>
        <CardHead
          title="Post history"
          hint="The latest 50 posts across platforms. Resend publishes the same text and images again as a new post. Delete only removes the entry here."
          right={<Flex gap={2} alignItems="center">
            <select aria-label="Filter by platform" style={selectStyle} value={historyPlatform} onChange={(e) => setHistoryPlatform(e.target.value)}>
              <option value="">All platforms</option>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {visiblePosts.some((p) => p.status === 'failed') ? <Button size="S" variant="danger-light" loading={busy === 'clear-failed'} disabled={!!busy} onClick={clearFailed}>Clear failed</Button> : undefined}
          </Flex>}
        />
        {visiblePosts.length === 0 ? <Typography textColor="neutral600">Nothing has been posted yet.</Typography> : (
          <Table colCount={7} rowCount={visiblePosts.length + 1}>
            <Thead>
              <Tr>
                {['Date', 'Platform', 'Account', 'Post', 'Images', 'Status', ''].map((h, i) => <Th key={i}><Typography variant="sigma">{h || ' '}</Typography></Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {visiblePosts.map((p) => (
                <Tr key={p.id}>
                  <Td><Typography>{day(p.publishedAt)}</Typography></Td>
                  <Td><Typography>{label(p.platform)}</Typography></Td>
                  <Td><Typography>{p.credential?.accountName ?? '-'}</Typography></Td>
                  <Td>
                    <Typography>{p.content.length > 80 ? `${p.content.slice(0, 80)}…` : p.content}</Typography>
                    {p.status === 'failed' && p.error ? <><br /><Typography variant="pi" textColor="danger600">{p.error}</Typography></> : null}
                  </Td>
                  <Td><Typography>{p.mediaUrls?.length ?? 0}</Typography></Td>
                  <Td><Pill kind={p.status === 'published' ? 'good' : p.status === 'failed' ? 'bad' : 'neutral'}>{p.status}</Pill></Td>
                  <Td>
                    <Flex gap={2}>
                      {p.status === 'published' && p.url && (
                        <Button size="S" variant="tertiary" onClick={() => window.open(p.url!, '_blank', 'noopener,noreferrer')}>View</Button>
                      )}
                      {(p.status === 'published' || p.status === 'draft') && (
                        <Button size="S" variant="secondary" loading={busy === `resend-${p.id}`} disabled={!!busy} onClick={() => resend(p)}>{p.status === 'draft' ? 'Publish' : 'Resend'}</Button>
                      )}
                      <Button size="S" variant="danger-light" loading={busy === `delpost-${p.id}`} disabled={!!busy} onClick={() => deletePost(p)}>Delete</Button>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
