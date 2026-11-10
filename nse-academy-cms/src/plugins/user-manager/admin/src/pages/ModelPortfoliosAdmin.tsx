import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { LSingleSelect, LTextInput, LTextarea, Pill, adminFetch } from './_ops';
import { SingleSelectOption } from '@strapi/design-system';

interface Holding { ticker: string; weightPct: number; rationale: string | null }
interface Perf { sincePct: number; asOf: string }
interface Model {
  id: string; slug: string; name: string; summary: string; description: string; riskProfile: string | null; status: string;
  reviewedBy: string | null; inceptionDate: string; holdings: Holding[]; performance: Perf | null;
}
interface Draft {
  id: string | null; slug: string; name: string; summary: string; description: string; riskProfile: string; inceptionDate: string; reviewedBy: string;
  holdings: { ticker: string; weightPct: string; rationale: string }[];
}

const RISKS = ['conservative', 'moderate', 'aggressive', 'dividend', 'growth'];
const today = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const blank = (): Draft => ({ id: null, slug: '', name: '', summary: '', description: '', riskProfile: '', inceptionDate: today(), reviewedBy: '', holdings: [{ ticker: '', weightPct: '', rationale: '' }, { ticker: '', weightPct: '', rationale: '' }] });
const toDraft = (m: Model): Draft => ({
  id: m.id, slug: m.slug, name: m.name, summary: m.summary, description: m.description, riskProfile: m.riskProfile ?? '', inceptionDate: m.inceptionDate, reviewedBy: m.reviewedBy ?? '',
  holdings: m.holdings.map((h) => ({ ticker: h.ticker, weightPct: String(h.weightPct), rationale: h.rationale ?? '' })),
});

export function ModelPortfoliosAdmin() {
  const [models, setModels] = useState<Model[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    try { setModels(await adminFetch<Model[]>('/admin/model-portfolios')); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(done: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try { await fn(); setMessage({ text: done }); await load(); } catch (e: any) { setMessage({ text: e.message, bad: true }); } finally { setBusy(false); }
  }

  const total = draft ? draft.holdings.reduce((s, h) => s + (Number(h.weightPct) || 0), 0) : 0;
  const body = (d: Draft) => ({
    slug: d.slug, name: d.name, summary: d.summary, description: d.description, riskProfile: d.riskProfile || undefined, inceptionDate: d.inceptionDate, reviewedBy: d.reviewedBy || undefined,
    holdings: d.holdings.filter((h) => h.ticker.trim()).map((h) => ({ ticker: h.ticker.trim().toUpperCase(), weightPct: Number(h.weightPct), rationale: h.rationale.trim() || undefined })),
  });

  const save = () => draft && act(draft.id ? 'Saved.' : 'Created as a draft.', async () => {
    const r = draft.id
      ? await adminFetch<Model & { backToDraft?: boolean }>(`/admin/model-portfolios/${draft.id}`, { method: 'PUT', body: JSON.stringify(body(draft)) })
      : await adminFetch<Model>('/admin/model-portfolios', { method: 'POST', body: JSON.stringify(body(draft)) });
    setDraft(toDraft(r));
    if ((r as any).backToDraft) setMessage({ text: 'Saved. Because the weights changed, this model went back to draft: publish it again after it has been reviewed.' });
  });
  const publish = (m: Model) => window.confirm(`Publish "${m.name}"? It becomes public and members can copy its weights. Reviewed by: ${m.reviewedBy || '(nobody yet)'}.`) && act('Published.', () => adminFetch(`/admin/model-portfolios/${m.id}/publish`, { method: 'POST' }));
  const unpublish = (m: Model) => act('Back to draft.', () => adminFetch(`/admin/model-portfolios/${m.id}/unpublish`, { method: 'POST' }));
  const remove = (m: Model) => window.confirm(`Delete "${m.name}" permanently? Members who copied its weights keep their own targets.`) && act('Deleted.', async () => { await adminFetch(`/admin/model-portfolios/${m.id}`, { method: 'DELETE' }); if (draft?.id === m.id) setDraft(null); });

  const setHolding = (i: number, patch: Partial<Draft['holdings'][number]>) => draft && setDraft({ ...draft, holdings: draft.holdings.map((h, k) => (k === i ? { ...h, ...patch } : h)) });

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading model portfolios…</Loader></Box>;
  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={4}>
        <Box>
          <Typography variant="alpha">Model Portfolios</Typography>
          <Box paddingTop={2}><Typography textColor="neutral600">Illustrative NSE portfolios shown on the website, where members can compare them with their holdings and copy the weights. A model is published only when someone qualified has reviewed it and is named on it. Performance is worked out from stored closing prices from the inception date, never typed in. Editing the weights of a published model sends it back to draft.</Typography></Box>
        </Box>
        <Button onClick={() => { setDraft(blank()); setMessage(null); }}>New model</Button>
      </Flex>
      {message && <Box paddingBottom={4}><Typography textColor={message.bad ? 'danger600' : 'success600'}>{message.text}</Typography></Box>}

      {models.length === 0 ? <Typography textColor="neutral600">No models yet.</Typography> : (
        <Table colCount={6} rowCount={models.length + 1}>
          <Thead><Tr>{['Model', 'Status', 'Risk profile', 'Stocks', 'Since inception', 'Reviewed by'].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
          <Tbody>
            {models.map((m) => (
              <Tr key={m.id} style={{ cursor: 'pointer', background: draft?.id === m.id ? '#f0f0ff' : undefined }} onClick={() => { setDraft(toDraft(m)); setMessage(null); }}>
                <Td><Typography fontWeight="bold">{m.name}</Typography><br /><Typography variant="pi" textColor="neutral600">/{m.slug}</Typography></Td>
                <Td><Pill kind={m.status === 'published' ? 'ok' : 'warn'}>{m.status}</Pill></Td>
                <Td><Typography>{m.riskProfile ?? '-'}</Typography></Td>
                <Td><Typography>{m.holdings.length}</Typography></Td>
                <Td><Typography>{m.performance ? `${m.performance.sincePct >= 0 ? '+' : ''}${m.performance.sincePct.toFixed(1)}%` : 'incomplete history'}</Typography></Td>
                <Td><Typography>{m.reviewedBy ?? '-'}</Typography></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {draft && (
        <Box paddingTop={8}>
          <Typography variant="beta">{draft.id ? `Edit: ${draft.name || 'untitled'}` : 'New model'}</Typography>
          <Flex gap={3} wrap="wrap" paddingTop={4} alignItems="flex-start">
            <Box style={{ width: 280 }}><LTextInput label="Name" name="name" value={draft.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.target.value })} /></Box>
            <Box style={{ width: 240 }}><LTextInput label="Address (slug)" name="slug" placeholder="steady-blue-chips" value={draft.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, slug: e.target.value })} /></Box>
            <Box style={{ width: 200 }}>
              <LSingleSelect label="Risk profile" placeholder="Not set" value={draft.riskProfile} onChange={(v: string | number) => setDraft({ ...draft, riskProfile: String(v) })} onClear={() => setDraft({ ...draft, riskProfile: '' })}>
                {RISKS.map((r) => <SingleSelectOption key={r} value={r}>{r}</SingleSelectOption>)}
              </LSingleSelect>
            </Box>
            <Box style={{ width: 180 }}><LTextInput label="Inception date" name="inception" placeholder="YYYY-MM-DD" value={draft.inceptionDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, inceptionDate: e.target.value })} /></Box>
          </Flex>
          <Box paddingTop={3}><LTextInput label="Summary (one sentence, shown on the list)" name="summary" value={draft.summary} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, summary: e.target.value })} /></Box>
          <Box paddingTop={3}><LTextarea label="How it is built and who it is for" name="description" value={draft.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, description: e.target.value })} /></Box>
          <Box paddingTop={3} style={{ maxWidth: 520 }}><LTextInput label="Reviewed by (name and credentials, required to publish)" name="reviewedBy" placeholder="Jane Kamau, CFA, CMA licence no. ..." value={draft.reviewedBy} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, reviewedBy: e.target.value })} /></Box>

          <Box paddingTop={5}>
            <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
              <Typography variant="delta">Holdings</Typography>
              <Typography textColor={Math.abs(total - 100) < 0.01 ? 'success600' : 'danger600'}>Weights add up to {Math.round(total * 100) / 100}% (must be exactly 100)</Typography>
            </Flex>
            {draft.holdings.map((h, i) => (
              <Flex key={i} gap={2} paddingBottom={2} alignItems="flex-end">
                <Box style={{ width: 110 }}><LTextInput label={i === 0 ? 'Stock' : `Stock ${i + 1}`} name={`t${i}`} placeholder="SCOM" value={h.ticker} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHolding(i, { ticker: e.target.value })} /></Box>
                <Box style={{ width: 90 }}><LTextInput label="Weight %" name={`w${i}`} value={h.weightPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHolding(i, { weightPct: e.target.value })} /></Box>
                <Box style={{ flex: 1 }}><LTextInput label="Why it is here (shown publicly)" name={`r${i}`} value={h.rationale} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHolding(i, { rationale: e.target.value })} /></Box>
                <Button size="S" variant="tertiary" disabled={draft.holdings.length <= 2} onClick={() => setDraft({ ...draft, holdings: draft.holdings.filter((_, k) => k !== i) })}>Remove</Button>
              </Flex>
            ))}
            <Button size="S" variant="secondary" disabled={draft.holdings.length >= 15} onClick={() => setDraft({ ...draft, holdings: [...draft.holdings, { ticker: '', weightPct: '', rationale: '' }] })}>Add a stock</Button>
          </Box>

          <Flex gap={2} paddingTop={6} wrap="wrap">
            <Button loading={busy} onClick={save}>{draft.id ? 'Save changes' : 'Create draft'}</Button>
            {draft.id && (() => {
              const m = models.find((x) => x.id === draft.id);
              if (!m) return null;
              return (
                <>
                  {m.status === 'published' ? <Button variant="secondary" loading={busy} onClick={() => unpublish(m)}>Unpublish</Button> : <Button variant="secondary" loading={busy} onClick={() => publish(m)}>Publish</Button>}
                  <Button variant="danger-light" loading={busy} onClick={() => remove(m)}>Delete</Button>
                </>
              );
            })()}
            <Button variant="tertiary" onClick={() => setDraft(null)}>Close</Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
