import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { LTextInput, LTextarea, Pill, adminFetch, when } from './_ops';

interface StockRow { ticker: string; price: number; ret1mPct: number | null; ret3mPct: number | null; fromHighPct: number; volatilityPct: number; avgDailyValueKes: number }
interface Note {
  id: string; kind: string; slug: string; title: string; summary: string; body: string; tickers: string[]; period: string | null;
  facts: { asOf?: string; universe?: number; stocks?: StockRow[] }; status: string; reviewedBy: string | null; publishedAt: string | null; updatedAt: string;
}

const thisMonth = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 7);
const pct = (n: number | null) => (n == null ? '-' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);

export function ResearchAdmin() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<Note | null>(null);
  const [period, setPeriod] = useState(thisMonth());
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    try { setNotes(await adminFetch<Note[]>('/admin/research')); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(done: string, fn: () => Promise<Note | void>) {
    setBusy(true);
    setMessage(null);
    try { const n = await fn(); if (n) setSel(n); setMessage({ text: done }); await load(); } catch (e: any) { setMessage({ text: e.message, bad: true }); } finally { setBusy(false); }
  }

  const draftFocus = () => act("Drafted. Read the numbers, write your analysis, name yourself as reviewer, then publish.", () => adminFetch<Note>('/admin/research/generate', { method: 'POST', body: JSON.stringify({ kind: 'FOCUS_LIST', period }) }));
  const draftBrief = () => act('Drafted. Read the numbers, write your analysis, name yourself as reviewer, then publish.', () => adminFetch<Note>('/admin/research/generate', { method: 'POST', body: JSON.stringify({ kind: 'BRIEF', ticker }) }));
  const save = () => sel && act('Saved.', () => adminFetch<Note>(`/admin/research/${sel.id}`, { method: 'PUT', body: JSON.stringify({ title: sel.title, summary: sel.summary, body: sel.body, reviewedBy: sel.reviewedBy ?? '' }) }));
  const publish = () => sel && window.confirm(`Publish "${sel.title}"? It becomes public, with ${sel.reviewedBy || '(nobody)'} named as reviewer.`) && act('Published.', async () => { await adminFetch(`/admin/research/${sel.id}`, { method: 'PUT', body: JSON.stringify({ title: sel.title, summary: sel.summary, body: sel.body, reviewedBy: sel.reviewedBy ?? '' }) }); return adminFetch<Note>(`/admin/research/${sel.id}/publish`, { method: 'POST' }); });
  const unpublish = () => sel && act('Back to draft.', () => adminFetch<Note>(`/admin/research/${sel.id}/unpublish`, { method: 'POST' }));
  const remove = () => sel && window.confirm(`Delete "${sel.title}" permanently?`) && act('Deleted.', async () => { await adminFetch(`/admin/research/${sel.id}`, { method: 'DELETE' }); setSel(null); });

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading research…</Loader></Box>;
  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Research</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">The monthly focus list and company briefs shown on the website. The system drafts the facts from stored prices (three fixed screens for the focus list, with a liquidity floor). A qualified person then writes the analysis, is named as reviewer, and publishes. Nothing can be published with the placeholder still in it or without a named reviewer.</Typography></Box>
      </Box>
      {message && <Box paddingBottom={4}><Typography textColor={message.bad ? 'danger600' : 'success600'}>{message.text}</Typography></Box>}

      <Flex gap={4} wrap="wrap" alignItems="flex-end" paddingBottom={6}>
        <Flex gap={2} alignItems="flex-end">
          <Box style={{ width: 150 }}><LTextInput label="Focus list month" name="period" placeholder="YYYY-MM" value={period} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriod(e.target.value)} /></Box>
          <Button loading={busy} onClick={draftFocus}>Draft the focus list</Button>
        </Flex>
        <Flex gap={2} alignItems="flex-end">
          <Box style={{ width: 130 }}><LTextInput label="Company brief" name="ticker" placeholder="SCOM" value={ticker} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTicker(e.target.value)} /></Box>
          <Button variant="secondary" disabled={!ticker.trim()} loading={busy} onClick={draftBrief}>Draft a brief</Button>
        </Flex>
      </Flex>

      {notes.length === 0 ? <Typography textColor="neutral600">No notes yet.</Typography> : (
        <Table colCount={5} rowCount={notes.length + 1}>
          <Thead><Tr>{['Note', 'Kind', 'Status', 'Reviewed by', 'Updated'].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
          <Tbody>
            {notes.map((n) => (
              <Tr key={n.id} style={{ cursor: 'pointer', background: sel?.id === n.id ? '#f0f0ff' : undefined }} onClick={() => { setSel(n); setMessage(null); }}>
                <Td><Typography fontWeight="bold">{n.title}</Typography></Td>
                <Td><Typography>{n.kind === 'FOCUS_LIST' ? 'Focus list' : 'Brief'}</Typography></Td>
                <Td><Pill kind={n.status === 'published' ? 'ok' : 'warn'}>{n.status}</Pill></Td>
                <Td><Typography>{n.reviewedBy ?? '-'}</Typography></Td>
                <Td><Typography>{when(n.updatedAt)}</Typography></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {sel && (
        <Box paddingTop={8}>
          <Typography variant="beta">{sel.title}</Typography>
          {sel.facts.stocks && sel.facts.stocks.length > 0 && (
            <Box paddingTop={3}>
              <Typography variant="pi" textColor="neutral600">The numbers the system computed{sel.facts.asOf ? ` (prices as of ${sel.facts.asOf}${sel.facts.universe ? `, ${sel.facts.universe} liquid stocks screened` : ''})` : ''}. Read them before you write.</Typography>
              <Table colCount={6} rowCount={sel.facts.stocks.length + 1}>
                <Thead><Tr>{['Stock', 'Close', '1 month', '3 months', 'From 60-day high', 'Traded a day'].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
                <Tbody>{sel.facts.stocks.map((s) => (
                  <Tr key={s.ticker}><Td><Typography fontWeight="bold">{s.ticker}</Typography></Td><Td><Typography>{s.price.toFixed(2)}</Typography></Td><Td><Typography>{pct(s.ret1mPct)}</Typography></Td><Td><Typography>{pct(s.ret3mPct)}</Typography></Td><Td><Typography>{s.fromHighPct.toFixed(1)}%</Typography></Td><Td><Typography>KSh {Math.round(s.avgDailyValueKes / 1e6 * 10) / 10}M</Typography></Td></Tr>
                ))}</Tbody>
              </Table>
            </Box>
          )}
          <Box paddingTop={4}><LTextInput label="Title" name="title" value={sel.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSel({ ...sel, title: e.target.value })} /></Box>
          <Box paddingTop={3}><LTextInput label="Summary (shown on the list)" name="summary" value={sel.summary} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSel({ ...sel, summary: e.target.value })} /></Box>
          <Box paddingTop={3}><LTextarea label="Body (replace the [Reviewer commentary ...] line with your analysis)" name="body" value={sel.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSel({ ...sel, body: e.target.value })} style={{ minHeight: 320 }} /></Box>
          <Box paddingTop={3} style={{ maxWidth: 520 }}><LTextInput label="Reviewed by (name and credentials, required to publish)" name="reviewedBy" placeholder="Jane Kamau, CFA, CMA licence no. ..." value={sel.reviewedBy ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSel({ ...sel, reviewedBy: e.target.value })} /></Box>
          <Flex gap={2} paddingTop={5} wrap="wrap">
            <Button loading={busy} onClick={save}>Save</Button>
            {sel.status === 'published' ? <Button variant="secondary" loading={busy} onClick={unpublish}>Unpublish</Button> : <Button variant="secondary" loading={busy} onClick={publish}>Save and publish</Button>}
            <Button variant="danger-light" loading={busy} onClick={remove}>Delete</Button>
            <Button variant="tertiary" onClick={() => setSel(null)}>Close</Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
