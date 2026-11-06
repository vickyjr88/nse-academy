import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Table, Tbody, Td, TextInput, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch } from './_ops';

interface Broker { id: string; name: string; cdaCode: string | null; feePercent: number; cdsRequired: boolean; isActive: boolean }

export function BrokersAdmin() {
  const [rows, setRows] = useState<Broker[]>([]);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await adminFetch<Broker[]>('/admin/brokers');
      setRows(list);
      setFees(Object.fromEntries(list.map((b) => [b.id, String(b.feePercent)])));
      setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(b: Broker, patch: Partial<Pick<Broker, 'feePercent' | 'isActive' | 'cdsRequired'>>, label: string) {
    setBusy(b.id);
    setMessage(null);
    try {
      await adminFetch(`/admin/brokers/${b.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      setMessage(`${b.name}: ${label}.`);
      await load();
    } catch (e: any) { setMessage(`Could not update ${b.name}: ${e.message}`); } finally { setBusy(null); }
  }

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading brokers…</Loader></Box>;
  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load brokers: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Brokers</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">The brokers members can log trades against and see in the fee comparison. The fee is the all-in percentage (commission plus levies) used for cost estimates; keep it current when a broker changes its rates.</Typography></Box>
      </Box>
      {message && <Box paddingBottom={4}><Typography textColor={message.startsWith('Could not') ? 'danger600' : 'success600'}>{message}</Typography></Box>}
      <Table colCount={5} rowCount={rows.length + 1}>
        <Thead><Tr><Th><Typography variant="sigma">Broker</Typography></Th><Th><Typography variant="sigma">CDS agent code</Typography></Th><Th><Typography variant="sigma">All-in fee %</Typography></Th><Th><Typography variant="sigma">Status</Typography></Th><Th><Typography variant="sigma">Actions</Typography></Th></Tr></Thead>
        <Tbody>
          {rows.map((b) => {
            const next = Number(fees[b.id]);
            const changed = fees[b.id] !== String(b.feePercent);
            const valid = Number.isFinite(next) && next > 0 && next <= 10;
            return (
              <Tr key={b.id}>
                <Td><Typography fontWeight="bold">{b.name}</Typography>{!b.cdsRequired && <><br /><Typography variant="pi" textColor="neutral600">no CDS account needed</Typography></>}</Td>
                <Td><Typography>{b.cdaCode ?? '-'}</Typography></Td>
                <Td>
                  <Flex gap={2}>
                    <Box style={{ width: 90 }}><TextInput aria-label={`Fee for ${b.name}`} type="number" value={fees[b.id]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFees({ ...fees, [b.id]: e.target.value })} /></Box>
                    <Button size="S" disabled={!changed || !valid} loading={busy === b.id} onClick={() => save(b, { feePercent: next }, `fee set to ${next}%`)}>Save</Button>
                  </Flex>
                  {changed && !valid && <Typography variant="pi" textColor="danger600">Enter a fee above 0 and up to 10.</Typography>}
                </Td>
                <Td><Pill kind={b.isActive ? 'ok' : 'warn'}>{b.isActive ? 'active' : 'hidden'}</Pill></Td>
                <Td><Button size="S" variant="tertiary" loading={busy === b.id} onClick={() => save(b, { isActive: !b.isActive }, b.isActive ? 'hidden from members' : 'shown to members')}>{b.isActive ? 'Hide' : 'Show'}</Button></Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Box>
  );
}
