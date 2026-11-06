import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, day, when } from './_ops';

interface Portfolio {
  user: { id: string; name: string; email: string; portfolioWatchEnabled: boolean };
  holdings: { id: string; ticker: string; broker: string; quantity: number; avgCost: number | null; costSource: string | null }[];
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

  useEffect(() => { adminFetch<Portfolio>(`/admin/users/${id}/portfolio`).then(setData).catch((e) => setError(e.message)); }, [id]);

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

      <Section title="Holdings" count={data.holdings.length} empty="No holdings.">
        <Table colCount={5} rowCount={data.holdings.length + 1}>
          {th(['Stock', 'Broker', 'Shares', 'Cost / share', 'Cost source'])}
          <Tbody>{data.holdings.map((h) => (
            <Tr key={h.id}><Td><Typography fontWeight="bold">{h.ticker}</Typography></Td><Td><Typography>{h.broker}</Typography></Td><Td><Typography>{h.quantity.toLocaleString('en-KE')}</Typography></Td><Td><Typography>{h.avgCost != null ? h.avgCost.toFixed(2) : '-'}</Typography></Td><Td>{h.costSource ? <Pill kind={h.costSource === 'IMPORT_PRICE' ? 'warn' : 'ok'}>{h.costSource === 'IMPORT_PRICE' ? 'estimated at import' : h.costSource.toLowerCase()}</Pill> : <Typography textColor="neutral600">none</Typography>}</Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="CDSC statement imports" count={data.statementImports.length} empty="No imports.">
        <Table colCount={4} rowCount={data.statementImports.length + 1}>
          {th(['When', 'File', 'Result', 'Error'])}
          <Tbody>{data.statementImports.map((i) => (
            <Tr key={i.id}><Td><Typography>{when(i.createdAt)}</Typography></Td><Td><Typography>{i.filename}</Typography></Td><Td><Pill kind={i.status === 'completed' ? 'ok' : 'failing'}>{i.status}</Pill></Td><Td><Typography textColor="danger600">{i.error ?? ''}</Typography></Td></Tr>
          ))}</Tbody>
        </Table>
      </Section>

      <Section title="Recent trades" count={data.trades.length} empty="No trades logged.">
        <Table colCount={6} rowCount={data.trades.length + 1}>
          {th(['Date', 'Stock', 'Side', 'Shares', 'Price', 'Broker'])}
          <Tbody>{data.trades.map((t) => (
            <Tr key={t.id}><Td><Typography>{day(t.tradeDate)}</Typography></Td><Td><Typography fontWeight="bold">{t.ticker}</Typography></Td><Td><Pill kind={t.side === 'BUY' ? 'ok' : 'warn'}>{t.side}</Pill></Td><Td><Typography>{t.quantity.toLocaleString('en-KE')}</Typography></Td><Td><Typography>{t.pricePerShare.toFixed(2)}</Typography></Td><Td><Typography>{t.broker}</Typography></Td></Tr>
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
