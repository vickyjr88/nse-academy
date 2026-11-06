import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, SingleSelectOption, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, when, LTextInput, LSingleSelect } from './_ops';

interface Entry { id: string; at: string; actor: string | null; method: string; path: string; action: string; entityType: string | null; entityId: string | null; statusCode: number; ok: boolean; detail: any; ip: string | null }
interface Page { data: Entry[]; total: number; page: number; totalPages: number }

export function AuditLog() {
  const [data, setData] = useState<Page | null>(null);
  const [actors, setActors] = useState<string[]>([]);
  const [actor, setActor] = useState('');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => { setQuery(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { adminFetch<string[]>('/admin/audit/actors').then(setActors).catch(() => undefined); }, []);

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), limit: '30' });
      if (actor) p.set('actor', actor);
      if (method) p.set('method', method);
      if (query) p.set('q', query);
      if (failed) p.set('failed', 'true');
      setData(await adminFetch<Page>(`/admin/audit?${p}`));
      setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [page, actor, method, query, failed]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading audit log…</Loader></Box>;
  if (error || !data) return <Box padding={8}><Typography textColor="danger600">Failed to load the audit log: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Audit Log</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">Every change made through the admin, newest first: who, what, and whether it worked. "Who" is the Strapi admin user the panel reports; the API itself is protected by one shared key. Click a row for the details, including before and after values for edits.</Typography></Box>
      </Box>

      <Flex gap={3} wrap="wrap" alignItems="flex-end" paddingBottom={4}>
        <Box style={{ width: 240 }}><LTextInput label="Search" name="q" placeholder="subscription, holding, tag…" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} /></Box>
        <Box style={{ width: 220 }}>
          <LSingleSelect label="Who" placeholder="Anyone" value={actor} onChange={(v: string | number) => { setActor(String(v)); setPage(1); }} onClear={() => { setActor(''); setPage(1); }}>
            {actors.map((a) => <SingleSelectOption key={a} value={a}>{a}</SingleSelectOption>)}
          </LSingleSelect>
        </Box>
        <Box style={{ width: 160 }}>
          <LSingleSelect label="Type" placeholder="Any" value={method} onChange={(v: string | number) => { setMethod(String(v)); setPage(1); }} onClear={() => { setMethod(''); setPage(1); }}>
            <SingleSelectOption value="POST">Create / action</SingleSelectOption><SingleSelectOption value="PUT">Edit</SingleSelectOption><SingleSelectOption value="DELETE">Delete</SingleSelectOption>
          </LSingleSelect>
        </Box>
        <Button variant={failed ? 'danger' : 'tertiary'} onClick={() => { setFailed(!failed); setPage(1); }}>{failed ? 'Showing failed only' : 'Failed only'}</Button>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </Flex>

      {data.data.length === 0 ? <Typography textColor="neutral600">No matching changes.</Typography> : (
        <Table colCount={4} rowCount={data.data.length + 1}>
          <Thead><Tr><Th><Typography variant="sigma">When</Typography></Th><Th><Typography variant="sigma">Who</Typography></Th><Th><Typography variant="sigma">What</Typography></Th><Th><Typography variant="sigma">Result</Typography></Th></Tr></Thead>
          <Tbody>
            {data.data.map((e) => (
              <React.Fragment key={e.id}>
                <Tr style={{ cursor: 'pointer' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <Td><Typography>{when(e.at)}</Typography></Td>
                  <Td><Typography>{e.actor ?? 'unknown'}</Typography></Td>
                  <Td><Typography fontWeight="bold">{e.action}</Typography></Td>
                  <Td><Pill kind={e.ok ? 'ok' : 'failing'}>{e.ok ? 'done' : `failed ${e.statusCode}`}</Pill></Td>
                </Tr>
                {open === e.id && (
                  <Tr>
                    <Td colSpan={4}>
                      <Box padding={3} background="neutral100" hasRadius>
                        <Typography variant="pi" textColor="neutral600">{e.method} {e.path}{e.ip ? ` from ${e.ip}` : ''}</Typography>
                        <pre style={{ margin: '8px 0 0', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(e.detail, null, 2)}</pre>
                      </Box>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            ))}
          </Tbody>
        </Table>
      )}
      <Flex gap={2} paddingTop={3}>
        <Button variant="tertiary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <Typography>Page {data.page} of {Math.max(data.totalPages, 1)} ({data.total} entr{data.total === 1 ? 'y' : 'ies'})</Typography>
        <Button variant="tertiary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
      </Flex>
    </Box>
  );
}
