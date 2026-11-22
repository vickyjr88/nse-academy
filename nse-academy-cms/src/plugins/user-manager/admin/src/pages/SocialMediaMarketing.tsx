import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, day, when, LTextInput, LTextarea } from './_ops';
import { Card, CardHead } from '../ui/primitives';

interface Credential { id: string; accountName: string; lastTestedAt: string | null; createdAt: string }
interface Post {
  id: string;
  externalPostId: string;
  content: string;
  mediaUrls: string[];
  status: string;
  error: string | null;
  reportId: string | null;
  publishedAt: string;
  credential?: { accountName: string };
}

const EMPTY_CREDENTIAL = { accountName: '', apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' };
const KEY_FIELDS: ['apiKey' | 'apiSecret' | 'accessToken' | 'accessTokenSecret', string][] = [
  ['apiKey', 'API key'],
  ['apiSecret', 'API secret'],
  ['accessToken', 'Access token'],
  ['accessTokenSecret', 'Access token secret'],
];
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #8e8ea9', background: 'transparent', color: 'inherit' };

export function SocialMediaMarketing() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState(EMPTY_CREDENTIAL);
  const [reportForm, setReportForm] = useState({ credentialId: '', reportDate: '' });
  const [postForm, setPostForm] = useState({ credentialId: '', content: '', mediaUrls: '' });

  const load = useCallback(async () => {
    try {
      const [creds, history] = await Promise.all([
        adminFetch<Credential[]>('/marketing/x/credentials'),
        adminFetch<Post[]>('/marketing/x/posts'),
      ]);
      setCredentials(creds);
      setPosts(history);
      // Preselect the only account so a single-account setup needs no extra click.
      if (creds.length === 1) {
        setReportForm((f) => ({ ...f, credentialId: f.credentialId || creds[0].id }));
        setPostForm((f) => ({ ...f, credentialId: f.credentialId || creds[0].id }));
      }
    } catch (e: any) {
      setMessage({ text: `Could not load X data: ${e.message}`, bad: true });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

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
    if (editingId) {
      // Blank key fields mean "keep the stored value".
      const changes = Object.fromEntries(Object.entries(credentialForm).filter(([, v]) => v.trim()));
      await adminFetch(`/marketing/x/credentials/${editingId}`, { method: 'PUT', body: JSON.stringify(changes) });
      closeForm();
      return 'X account updated. Press Test to check the keys.';
    }
    await adminFetch('/marketing/x/credentials', { method: 'POST', body: JSON.stringify(credentialForm) });
    closeForm();
    return 'X account saved. The keys are stored encrypted.';
  });

  function closeForm() {
    setCredentialForm(EMPTY_CREDENTIAL);
    setEditingId(null);
    setShowAdd(false);
  }

  function openEdit(c: Credential) {
    setCredentialForm({ ...EMPTY_CREDENTIAL, accountName: c.accountName });
    setEditingId(c.id);
    setShowAdd(true);
  }

  const testCredential = (c: Credential) => run(`test-${c.id}`, async () => {
    const r = await adminFetch<{ success: boolean; message: string }>(`/marketing/x/test/${c.id}`, { method: 'POST' });
    if (!r.success) throw new Error(r.message);
    return `${c.accountName}: ${r.message}`;
  });

  const deleteCredential = (c: Credential) => window.confirm(`Delete "${c.accountName}"? Its stored keys and its post history here are removed. Posts already on X stay there.`) &&
    run(`delete-${c.id}`, async () => {
      await adminFetch(`/marketing/x/credentials/${c.id}`, { method: 'DELETE' });
      if (editingId === c.id) closeForm();
      return `${c.accountName} deleted.`;
    });

  const deletePost = (p: Post) => window.confirm('Remove this entry from the history? The post on X, if there is one, is not deleted.') &&
    run(`delpost-${p.id}`, async () => {
      await adminFetch(`/marketing/x/posts/${p.id}`, { method: 'DELETE' });
      return 'Removed from the history.';
    });

  const clearFailed = () => window.confirm('Remove every failed attempt from the history?') &&
    run('clear-failed', async () => {
      const r = await adminFetch<{ deleted: number }>('/marketing/x/failed-posts', { method: 'DELETE' });
      return `Removed ${r.deleted} failed attempt${r.deleted === 1 ? '' : 's'}.`;
    });

  const postReport = () => run('report', async () => {
    const r = await adminFetch<{ url: string }>('/marketing/x/report', { method: 'POST', body: JSON.stringify(reportForm) });
    return `Report for ${reportForm.reportDate} posted to X: ${r.url}`;
  });

  const postCustom = () => run('post', async () => {
    const mediaUrls = postForm.mediaUrls.split(/[\s,]+/).filter(Boolean);
    const r = await adminFetch<{ url: string }>('/marketing/x/post', {
      method: 'POST',
      body: JSON.stringify({ credentialId: postForm.credentialId, content: postForm.content, ...(mediaUrls.length ? { mediaUrls } : {}) }),
    });
    setPostForm((f) => ({ ...f, content: '', mediaUrls: '' }));
    return `Posted to X: ${r.url}`;
  });

  const resend = (p: Post) => window.confirm('Post this again to X? It will appear as a new post.') &&
    run(`resend-${p.id}`, async () => {
      const r = await adminFetch<{ url: string }>(`/marketing/x/resend/${p.id}`, { method: 'POST' });
      return `Resent to X: ${r.url}`;
    });

  const accountSelect = (value: string, onChange: (id: string) => void) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Account</div>
      <select aria-label="Account" style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an account…</option>
        {credentials.map((c) => <option key={c.id} value={c.id}>{c.accountName}</option>)}
      </select>
    </div>
  );

  if (loading) return <Box padding={8}><Loader>Loading X posting…</Loader></Box>;

  const credentialComplete = editingId
    ? credentialForm.accountName.trim() !== ''
    : Object.values(credentialForm).every((v) => v.trim());
  const reportReady = reportForm.credentialId && /^\d{4}-\d{2}-\d{2}$/.test(reportForm.reportDate);

  return (
    <Box padding={8}>
      <Box paddingBottom={2}><Typography variant="alpha">Social media: X (Twitter)</Typography></Box>
      <Box paddingBottom={6}>
        <Typography textColor="neutral600">
          The daily market report is posted to X automatically at 08:30 Nairobi time, with its story cards attached. Use this page to connect an account, post a report again, or resend an earlier post.
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
            hint="API keys and secrets are encrypted before they are stored and are never shown again."
            right={<Button size="S" variant={showAdd ? 'tertiary' : 'default'} onClick={() => (showAdd ? closeForm() : setShowAdd(true))}>{showAdd ? 'Cancel' : 'Add account'}</Button>}
          />
          {credentials.length === 0 ? (
            <Typography textColor="neutral600">No X account connected yet.</Typography>
          ) : (
            <Table colCount={3} rowCount={credentials.length + 1}>
              <Thead><Tr><Th><Typography variant="sigma">Account</Typography></Th><Th><Typography variant="sigma">Last tested</Typography></Th><Th><Typography variant="sigma"> </Typography></Th></Tr></Thead>
              <Tbody>
                {credentials.map((c) => (
                  <Tr key={c.id}>
                    <Td><Typography fontWeight="bold">{c.accountName}</Typography></Td>
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
                <Typography variant="delta">{editingId ? 'Edit account' : 'Add account'}</Typography>
                {editingId && <Box><Typography textColor="neutral600">Leave a key blank to keep the one already stored. Enter only the values that changed.</Typography></Box>}
              </Box>
              <Flex direction="column" alignItems="stretch" gap={3}>
                <LTextInput label="Account name" name="accountName" placeholder="e.g. NSE Academy" value={credentialForm.accountName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, accountName: e.target.value })} />
                {KEY_FIELDS.map(([field, label]) => (
                  <LTextInput
                    key={field}
                    label={label}
                    name={field}
                    type="password"
                    autoComplete="off"
                    placeholder={editingId ? 'Unchanged' : undefined}
                    value={credentialForm[field]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialForm({ ...credentialForm, [field]: e.target.value })}
                  />
                ))}
                <Box><Button disabled={!credentialComplete} loading={busy === 'save'} onClick={saveCredential}>{editingId ? 'Save changes' : 'Save account'}</Button></Box>
              </Flex>
            </Box>
          )}
        </Card>
      </Box>

      <Box paddingBottom={6}>
        <Card>
          <CardHead title="Post a market report" hint="Posts that day's summary with its story cards. Use a past date to publish an older report again." />
          {credentials.length === 0 ? <Typography textColor="neutral600">Connect an account first.</Typography> : (
            <Flex gap={3} alignItems="flex-end" wrap="wrap">
              <Box style={{ minWidth: 220 }}>{accountSelect(reportForm.credentialId, (id) => setReportForm({ ...reportForm, credentialId: id }))}</Box>
              <Box style={{ minWidth: 180 }}><LTextInput label="Report date" name="reportDate" type="date" value={reportForm.reportDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportForm({ ...reportForm, reportDate: e.target.value })} /></Box>
              <Button disabled={!reportReady} loading={busy === 'report'} onClick={postReport}>Post report</Button>
            </Flex>
          )}
        </Card>
      </Box>

      <Box paddingBottom={6}>
        <Card>
          <CardHead title="Post something else" hint="A custom post, with optional image links (separated by spaces, commas or new lines; up to four)." />
          {credentials.length === 0 ? <Typography textColor="neutral600">Connect an account first.</Typography> : (
            <Flex direction="column" alignItems="stretch" gap={3}>
              <Box style={{ maxWidth: 320 }}>{accountSelect(postForm.credentialId, (id) => setPostForm({ ...postForm, credentialId: id }))}</Box>
              <LTextarea label={`Post text (${postForm.content.length}/280)`} name="content" maxLength={280} value={postForm.content} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostForm({ ...postForm, content: e.target.value })} />
              <LTextarea label="Image links" name="mediaUrls" placeholder="https://…" value={postForm.mediaUrls} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostForm({ ...postForm, mediaUrls: e.target.value })} />
              <Box><Button disabled={!postForm.credentialId || !postForm.content.trim()} loading={busy === 'post'} onClick={postCustom}>Post to X</Button></Box>
            </Flex>
          )}
        </Card>
      </Box>

      <Card>
        <CardHead
          title="Post history"
          hint="The latest 50 posts. Resend publishes the same text and images again as a new post. Delete only removes the entry here; it does not delete the post on X."
          right={posts.some((p) => p.status === 'failed') ? <Button size="S" variant="danger-light" loading={busy === 'clear-failed'} disabled={!!busy} onClick={clearFailed}>Clear failed</Button> : undefined}
        />
        {posts.length === 0 ? <Typography textColor="neutral600">Nothing has been posted yet.</Typography> : (
          <Table colCount={6} rowCount={posts.length + 1}>
            <Thead>
              <Tr>
                {['Date', 'Account', 'Post', 'Images', 'Status', ''].map((h, i) => <Th key={i}><Typography variant="sigma">{h || ' '}</Typography></Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {posts.map((p) => (
                <Tr key={p.id}>
                  <Td><Typography>{day(p.publishedAt)}</Typography></Td>
                  <Td><Typography>{p.credential?.accountName ?? '-'}</Typography></Td>
                  <Td>
                    <Typography>{p.content.length > 80 ? `${p.content.slice(0, 80)}…` : p.content}</Typography>
                    {p.status === 'failed' && p.error ? <><br /><Typography variant="pi" textColor="danger600">{p.error}</Typography></> : null}
                  </Td>
                  <Td><Typography>{p.mediaUrls?.length ?? 0}</Typography></Td>
                  <Td><Pill kind={p.status === 'published' ? 'good' : 'bad'}>{p.status}</Pill></Td>
                  <Td>
                    <Flex gap={2}>
                      {p.status === 'published' && (
                        <>
                          <Button size="S" variant="tertiary" onClick={() => window.open(`https://x.com/i/status/${p.externalPostId}`, '_blank', 'noopener,noreferrer')}>View</Button>
                          <Button size="S" variant="secondary" loading={busy === `resend-${p.id}`} disabled={!!busy} onClick={() => resend(p)}>Resend</Button>
                        </>
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
