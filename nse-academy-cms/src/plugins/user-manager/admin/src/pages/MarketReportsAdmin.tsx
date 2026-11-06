import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, when } from './_ops';

interface Report { sessionDate: string; status: string; aiGenerated: boolean; aiModel: string | null; headline: string; publishedAt: string | null }

const SITE = 'https://nseacademy.vitaldigitalmedia.net';

export function MarketReportsAdmin() {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await adminFetch<Report[]>('/admin/market-reports')); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(ymd: string, action: 'publish' | 'unpublish' | 'regenerate') {
    if (action === 'regenerate' && !window.confirm(`Regenerate the ${ymd} report? The AI story is rewritten from the stored prices and the page changes immediately. No email is sent.`)) return;
    if (action === 'unpublish' && !window.confirm(`Take the ${ymd} report off the public site?`)) return;
    setBusy(`${ymd}:${action}`);
    setMessage(null);
    try {
      if (action === 'regenerate') {
        const r = await adminFetch<{ aiGenerated: boolean; note?: string }>('/admin/market-reports/generate', { method: 'POST', body: JSON.stringify({ date: ymd, force: true, notify: false }) });
        setMessage(`${ymd} regenerated${r.aiGenerated ? ' with an AI-written story' : ` with the template story${r.note ? ` (${r.note})` : ''}`}.`);
      } else {
        await adminFetch(`/admin/market-reports/${ymd}/${action}`, { method: 'POST' });
        setMessage(`${ymd} ${action === 'publish' ? 'published' : 'unpublished'}.`);
      }
      await load();
    } catch (e: any) { setMessage(`Could not ${action} ${ymd}: ${e.message}`); } finally { setBusy(null); }
  }

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading market reports…</Loader></Box>;
  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load market reports: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Market Reports</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">The public daily report at /market-report. Published at 21:00 Nairobi on trading days. Unpublish one that is wrong, or regenerate it (a fresh AI story from the stored prices).</Typography></Box>
      </Box>
      {message && <Box paddingBottom={4}><Typography textColor={message.startsWith('Could not') ? 'danger600' : 'success600'}>{message}</Typography></Box>}
      <Table colCount={5} rowCount={rows.length + 1}>
        <Thead><Tr><Th><Typography variant="sigma">Session</Typography></Th><Th><Typography variant="sigma">Headline</Typography></Th><Th><Typography variant="sigma">Status</Typography></Th><Th><Typography variant="sigma">Written by</Typography></Th><Th><Typography variant="sigma">Actions</Typography></Th></Tr></Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.sessionDate}>
              <Td><Typography fontWeight="bold">{r.sessionDate}</Typography><br /><Typography variant="pi" textColor="neutral600">{when(r.publishedAt)}</Typography></Td>
              <Td><Typography>{r.headline || '-'}</Typography></Td>
              <Td><Pill kind={r.status === 'published' ? 'ok' : 'warn'}>{r.status}</Pill></Td>
              <Td><Typography>{r.aiGenerated ? r.aiModel ?? 'AI' : 'template'}</Typography></Td>
              <Td>
                <Flex gap={2} wrap="wrap">
                  {r.status === 'published' ? <Button size="S" variant="tertiary" loading={busy === `${r.sessionDate}:unpublish`} onClick={() => act(r.sessionDate, 'unpublish')}>Unpublish</Button> : <Button size="S" loading={busy === `${r.sessionDate}:publish`} onClick={() => act(r.sessionDate, 'publish')}>Publish</Button>}
                  <Button size="S" variant="secondary" loading={busy === `${r.sessionDate}:regenerate`} onClick={() => act(r.sessionDate, 'regenerate')}>Regenerate</Button>
                  {r.status === 'published' && <a href={`${SITE}/market-report/${r.sessionDate}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>View page</a>}
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {rows.length === 0 && <Box paddingTop={4}><Typography textColor="neutral600">No reports yet.</Typography></Box>}
    </Box>
  );
}
