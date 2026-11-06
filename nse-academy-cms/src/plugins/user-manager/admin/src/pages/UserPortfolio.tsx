import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Flex, Loader, SingleSelectOption, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, day, when, LTextInput, LSingleSelect } from './_ops';

interface Portfolio {
  user: { id: string; name: string; email: string; portfolioWatchEnabled: boolean };
  holdings: { id: string; ticker: string; brokerId: string; broker: string; quantity: number; avgCost: number | null; costSource: string | null; tradeCount: number }[];
  trades: { id: string; ticker: string; side: string; quantity: number; pricePerShare: number; broker: string; tradeDate: string; source: string }[];
  dividends: { id: string; ticker: string; amountKes: number; paymentDate: string; source: string }[];
  statementImports: { id: string; filename: string; status: string; error: string | null; createdAt: string }[];
  priceAlerts: { id: string; ticker: string; direction: string; targetPrice: number; status: string; createdAt: string }[];
  notifications: { id: string; type: string; title: string; read: boolean; createdAt: string }[];
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <Box paddingBottom={6}>
      <Typography variant="beta">{title}</Typography>
      <Box paddingTop={3}>{count === 0 ? <Typography textColor="neutral600">{empty}</Typography> : children}</Box>
    </Box>
  );
}

export function UserPortfolio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ brokerId: '', ticker: '', quantity: '', avgCost: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(() => adminFetch<Portfolio>(`/admin/users/${id}/portfolio`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminFetch<{ id: string; name: string }[]>('/admin/brokers').then(setBrokers).catch(() => undefined); }, []);

  async function change(done: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try { await fn(); setMessage({ text: done }); setEditing(null); setAdding(false); await load(); } catch (e: any) { setMessage({ text: e.message, bad: true }); } finally { setBusy(false); }
  }
  const saveEdit = (h: Portfolio['holdings'][number]) => change(`${h.ticker} updated.`, () =>
    adminFetch(`/admin/users/${id}/holdings/${h.id}`, { method: 'PUT', body: JSON.stringify({ quantity: parseInt(qty, 10), avgCost: cost.trim() === '' ? null : Number(cost) }) }));
  const removeHolding = (h: Portfolio['holdings'][number]) => window.confirm(`Remove ${h.ticker} at ${h.broker} from this member's portfolio?`) && change(`${h.ticker} removed.`, () => adminFetch(`/admin/users/${id}/holdings/${h.id}`, { method: 'DELETE' }));
  const removeTrade = (t: Portfolio['trades'][number]) => window.confirm(`Delete this ${t.side} of ${t.quantity.toLocaleString('en-KE')} ${t.ticker}? The member's holding is recalculated from the remaining trades.`) && change('Trade deleted.', () => adminFetch(`/admin/users/${id}/trades/${t.id}`, { method: 'DELETE' }));
  const createHolding = () => change(`${add.ticker.toUpperCase()} added.`, () =>
    adminFetch(`/admin/users/${id}/holdings`, { method: 'POST', body: JSON.stringify({ brokerId: add.brokerId, ticker: add.ticker.trim().toUpperCase(), quantity: parseInt(add.quantity, 10), ...(add.avgCost.trim() ? { avgCost: Number(add.avgCost) } : {}) }) }));

  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load: {error}</Typography></Box>;
  if (!data) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading portfolio…</Loader></Box>;

  const th = (labels: string[]) => <Thead><Tr>{labels.map((l) => <Th key={l}><Typography variant="sigma">{l}</Typography></Th>)}</Tr></Thead>;
  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={4}>
        <Box>
          <Typography variant="alpha">Portfolio &amp; activity</Typography>
          <Box paddingTop={2}><Typography textColor="neutral600">{data.user.name} ({data.user.email}). Portfolio Watch email: {data.user.portfolioWatchEnabled ? 'on' : 'off'}. For support: what they hold, where the cost came from, and what failed.</Typography></Box>
        </Box>
        <Button variant="tertiary" onClick={() => navigate(`/plugins/user-manager/${id}`)}>Back to user</Button>
      </Flex>

      {message && <Box paddingBottom={4}><Typography textColor={message.bad ? 'danger600' : 'success600'}>{message.text}</Typography></Box>}
      <Section title="Holdings" count={data.holdings.length} empty="No holdings.">
        <Box paddingBottom={3}><Typography variant="pi" textColor="neutral600">Holdings made from logged trades are calculated and cannot be edited here: change or delete the trades instead. Imported or hand-entered holdings can be corrected. Every change is recorded in the Audit Log.</Typography></Box>
        <Table colCount={6} rowCount={data.holdings.length + 1}>
          {th(['Stock', 'Broker', 'Shares', 'Cost / share', 'Cost source', ''])}
          <Tbody>{data.holdings.map((h) => {
            const derived = h.tradeCount > 0;
            const isEditing = editing === h.id;
            return (
              <Tr key={h.id}>
                <Td><Typography fontWeight="bold">{h.ticker}</Typography></Td>
                <Td><Typography>{h.broker}</Typography></Td>
                <Td>{isEditing ? <Box style={{ width: 120 }}><LTextInput label="Shares" name="qty" aria-label="Shares" value={qty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)} /></Box> : <Typography>{h.quantity.toLocaleString('en-KE')}</Typography>}</Td>
                <Td>{isEditing ? <Box style={{ width: 120 }}><LTextInput label="Cost" name="cost" aria-label="Cost per share" placeholder="blank = none" value={cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCost(e.target.value)} /></Box> : <Typography>{h.avgCost != null ? h.avgCost.toFixed(2) : '-'}</Typography>}</Td>
                <Td>{derived ? <Pill kind="ok">from {h.tradeCount} trade{h.tradeCount === 1 ? '' : 's'}</Pill> : h.costSource ? <Pill kind={h.costSource === 'IMPORT_PRICE' ? 'warn' : 'ok'}>{h.costSource === 'IMPORT_PRICE' ? 'estimated at import' : h.costSource.toLowerCase()}</Pill> : <Typography textColor="neutral600">none</Typography>}</Td>
                <Td>
                  {derived ? <Typography variant="pi" textColor="neutral600">edit the trades</Typography> : isEditing ? (
                    <Flex gap={2}><Button size="S" loading={busy} disabled={!/^\d+$/.test(qty) || (cost.trim() !== '' && !(Number(cost) > 0))} onClick={() => saveEdit(h)}>Save</Button><Button size="S" variant="tertiary" onClick={() => setEditing(null)}>Cancel</Button></Flex>
                  ) : (
                    <Flex gap={2}><Button size="S" variant="secondary" onClick={() => { setEditing(h.id); setQty(String(h.quantity)); setCost(h.avgCost != null ? String(h.avgCost) : ''); }}>Edit</Button><Button size="S" variant="danger-light" disabled={busy} onClick={() => removeHolding(h)}>Remove</Button></Flex>
                  )}
                </Td>
              </Tr>
            );
          })}</Tbody>
        </Table>
      </Section>

      <Box paddingBottom={6}>
        {!adding ? <Button variant="secondary" onClick={() => setAdding(true)}>Add a holding</Button> : (
          <Box padding={4} background="neutral100" hasRadius>
            <Typography variant="delta">Add a holding</Typography>
            <Flex gap={3} wrap="wrap" alignItems="flex-end" paddingTop={3}>
              <Box style={{ width: 220 }}>
                <LSingleSelect label="Broker" placeholder="Choose" value={add.brokerId} onChange={(v: string | number) => setAdd({ ...add, brokerId: String(v) })}>
                  {brokers.map((b) => <SingleSelectOption key={b.id} value={b.id}>{b.name}</SingleSelectOption>)}
                </LSingleSelect>
              </Box>
              <Box style={{ width: 120 }}><LTextInput label="Ticker" name="ticker" placeholder="SCOM" value={add.ticker} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdd({ ...add, ticker: e.target.value })} /></Box>
              <Box style={{ width: 120 }}><LTextInput label="Shares" name="addqty" value={add.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdd({ ...add, quantity: e.target.value })} /></Box>
              <Box style={{ width: 140 }}><LTextInput label="Cost / share (optional)" name="addcost" value={add.avgCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdd({ ...add, avgCost: e.target.value })} /></Box>
              <Button loading={busy} disabled={!add.brokerId || !/^[A-Za-z0-9.]{1,12}$/.test(add.ticker.trim()) || !/^\d+$/.test(add.quantity) || (add.avgCost.trim() !== '' && !(Number(add.avgCost) > 0))} onClick={createHolding}>Add</Button>
              <Button variant="tertiary" onClick={() => setAdding(false)}>Cancel</Button>
            </Flex>
          </Box>
        )}
      </Box>

      <Section title="CDSC statement imports" count={data.statementImports.length} empty="No imports.">
        <Table colCount={4} rowCount={data.statementImports.length + 1}>
          {th(['When', 'File', 'Result', 'Error'])}
          <Tbody>{data.statementImports.map((i) => (
            <Tr key={i.id}><Td><Typography>{when(i.createdAt)}</Typography></Td><Td><Typography>{i.filename}</Typography></Td><Td><Pill kind={i.status === 'completed' ? 'ok' : 'failing'}>{i.status}</Pill></Td><Td><Typography textColor="danger600">{i.error ?? ''}</Typography></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="Recent trades" count={data.trades.length} empty="No trades logged.">
        <Table colCount={7} rowCount={data.trades.length + 1}>
          {th(['Date', 'Stock', 'Side', 'Shares', 'Price', 'Broker', ''])}
          <Tbody>{data.trades.map((t) => (
            <Tr key={t.id}><Td><Typography>{day(t.tradeDate)}</Typography></Td><Td><Typography fontWeight="bold">{t.ticker}</Typography></Td><Td><Pill kind={t.side === 'BUY' ? 'ok' : 'warn'}>{t.side}</Pill></Td><Td><Typography>{t.quantity.toLocaleString('en-KE')}</Typography></Td><Td><Typography>{t.pricePerShare.toFixed(2)}</Typography></Td><Td><Typography>{t.broker}</Typography></Td><Td><Button size="S" variant="danger-light" disabled={busy} onClick={() => removeTrade(t)}>Delete</Button></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="Price alerts" count={data.priceAlerts.length} empty="No price alerts.">
        <Table colCount={4} rowCount={data.priceAlerts.length + 1}>
          {th(['Stock', 'Condition', 'Status', 'Created'])}
          <Tbody>{data.priceAlerts.map((a) => (
            <Tr key={a.id}><Td><Typography fontWeight="bold">{a.ticker}</Typography></Td><Td><Typography>{a.direction === 'ABOVE' ? 'rises above' : 'falls below'} {a.targetPrice}</Typography></Td><Td><Pill kind={a.status === 'triggered' ? 'good' : 'neutral'}>{a.status}</Pill></Td><Td><Typography>{day(a.createdAt)}</Typography></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="Dividends" count={data.dividends.length} empty="No dividends recorded.">
        <Table colCount={3} rowCount={data.dividends.length + 1}>
          {th(['Paid', 'Stock', 'Amount (KSh)'])}
          <Tbody>{data.dividends.map((d) => (
            <Tr key={d.id}><Td><Typography>{day(d.paymentDate)}</Typography></Td><Td><Typography fontWeight="bold">{d.ticker}</Typography></Td><Td><Typography>{d.amountKes.toLocaleString('en-KE')}</Typography></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="Notifications" count={data.notifications.length} empty="No notifications.">
        <Table colCount={3} rowCount={data.notifications.length + 1}>
          {th(['When', 'Type', 'Title'])}
          <Tbody>{data.notifications.map((n) => (
            <Tr key={n.id}><Td><Typography>{when(n.createdAt)}</Typography></Td><Td><Typography>{n.type}</Typography></Td><Td><Typography textColor={n.read ? 'neutral600' : 'neutral800'}>{n.title}</Typography></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>
    </Box>
  );
}
