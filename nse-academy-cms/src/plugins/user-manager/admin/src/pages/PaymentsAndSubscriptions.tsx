import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Flex, Loader, SingleSelect, SingleSelectOption, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, Stat, adminFetch, day, kes, when } from './_ops';

interface Payment { reference: string; userId: string; name: string | null; email: string | null; plan: string; months: number; amountKes: number; appliedAt: string }
interface Payments { data: Payment[]; total: number; page: number; totalPages: number; totalRevenueKes: number }
interface Sub { userId: string; name: string; email: string; tier: string; status: string; currentPeriodEnd: string | null; daysLeft: number | null; freeMonths: number }
interface Subs { data: Sub[]; total: number; page: number; totalPages: number; summary: { tier: string; status: string; count: number }[] }

export function PaymentsAndSubscriptions() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payments | null>(null);
  const [subs, setSubs] = useState<Subs | null>(null);
  const [renewals, setRenewals] = useState<Subs | null>(null);
  const [pPage, setPPage] = useState(1);
  const [sPage, setSPage] = useState(1);
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [window, setWindow] = useState('14');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(sPage), limit: '15' });
      if (tier) q.set('tier', tier);
      if (status) q.set('status', status);
      const [p, s, r] = await Promise.all([
        adminFetch<Payments>(`/admin/payments?page=${pPage}&limit=15`),
        adminFetch<Subs>(`/admin/subscriptions?${q}`),
        adminFetch<Subs>(`/admin/subscriptions?expiringWithinDays=${window}&limit=50`),
      ]);
      setPayments(p); setSubs(s); setRenewals(r); setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [pPage, sPage, tier, status, window]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading payments…</Loader></Box>;
  if (error || !payments || !subs || !renewals) return <Box padding={8}><Typography textColor="danger600">Failed to load: {error}</Typography></Box>;

  const active = subs.summary.filter((g) => g.status === 'active' && g.tier !== 'free');
  const count = (t: string) => active.filter((g) => g.tier === t).reduce((n, g) => n + g.count, 0);
  const mrr = count('premium') * 500 + count('intermediary') * 300;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Payments &amp; Subscriptions</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">Every subscription payment recorded by the system, who is paying, and who needs a renewal nudge. The ledger starts when it was introduced; earlier payments are in Paystack.</Typography></Box>
      </Box>

      <Flex gap={3} wrap="wrap" paddingBottom={6}>
        <Stat label="Recorded revenue" value={kes(payments.totalRevenueKes)} note={`${payments.total} payment${payments.total === 1 ? '' : 's'}`} />
        <Stat label="Paying members" value={count('premium') + count('intermediary')} note={`${count('premium')} premium, ${count('intermediary')} intermediary`} />
        <Stat label="MRR (list price)" value={kes(mrr)} note={`${kes(mrr * 12)} a year`} />
        <Stat label={`Renewing in ${window} days`} value={renewals.total} />
      </Flex>

      <Box paddingBottom={6}>
        <Flex justifyContent="space-between" alignItems="center">
          <Typography variant="beta">Renewals due</Typography>
          <SingleSelect value={window} onChange={(v: string | number) => setWindow(String(v))} size="S">
            <SingleSelectOption value="7">Next 7 days</SingleSelectOption>
            <SingleSelectOption value="14">Next 14 days</SingleSelectOption>
            <SingleSelectOption value="30">Next 30 days</SingleSelectOption>
          </SingleSelect>
        </Flex>
        <Box paddingTop={3}>
          {renewals.data.length === 0 ? <Typography textColor="neutral600">No paid subscriptions end in this window.</Typography> : (
            <Table colCount={4} rowCount={renewals.data.length + 1}>
              <Thead><Tr><Th><Typography variant="sigma">Member</Typography></Th><Th><Typography variant="sigma">Plan</Typography></Th><Th><Typography variant="sigma">Ends</Typography></Th><Th><Typography variant="sigma">Days left</Typography></Th></Tr></Thead>
              <Tbody>
                {renewals.data.map((s) => (
                  <Tr key={s.userId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/plugins/user-manager/${s.userId}`)}>
                    <Td><Typography fontWeight="bold">{s.name}</Typography><br /><Typography variant="pi" textColor="neutral600">{s.email}</Typography></Td>
                    <Td><Pill kind={s.tier === 'premium' ? 'good' : 'neutral'}>{s.tier}</Pill></Td>
                    <Td><Typography>{day(s.currentPeriodEnd)}</Typography></Td>
                    <Td><Typography textColor={(s.daysLeft ?? 99) <= 3 ? 'danger600' : 'neutral800'}>{s.daysLeft}</Typography></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </Box>

      <Box paddingBottom={6}>
        <Typography variant="beta">Payment ledger</Typography>
        <Box paddingTop={3}>
          {payments.data.length === 0 ? <Typography textColor="neutral600">No payments recorded yet.</Typography> : (
            <Table colCount={5} rowCount={payments.data.length + 1}>
              <Thead><Tr><Th><Typography variant="sigma">When</Typography></Th><Th><Typography variant="sigma">Member</Typography></Th><Th><Typography variant="sigma">Plan</Typography></Th><Th><Typography variant="sigma">Amount</Typography></Th><Th><Typography variant="sigma">Reference</Typography></Th></Tr></Thead>
              <Tbody>
                {payments.data.map((p) => (
                  <Tr key={p.reference} style={{ cursor: 'pointer' }} onClick={() => navigate(`/plugins/user-manager/${p.userId}`)}>
                    <Td><Typography>{when(p.appliedAt)}</Typography></Td>
                    <Td><Typography fontWeight="bold">{p.name ?? 'Unknown'}</Typography><br /><Typography variant="pi" textColor="neutral600">{p.email}</Typography></Td>
                    <Td><Typography>{p.plan}, {p.months} month{p.months === 1 ? '' : 's'}</Typography></Td>
                    <Td><Typography fontWeight="bold">{kes(p.amountKes)}</Typography></Td>
                    <Td><Typography variant="pi" textColor="neutral600">{p.reference}</Typography></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
        <Flex gap={2} paddingTop={3}>
          <Button variant="tertiary" disabled={pPage <= 1} onClick={() => setPPage(pPage - 1)}>Previous</Button>
          <Typography>Page {payments.page} of {Math.max(payments.totalPages, 1)}</Typography>
          <Button variant="tertiary" disabled={pPage >= payments.totalPages} onClick={() => setPPage(pPage + 1)}>Next</Button>
        </Flex>
      </Box>

      <Box>
        <Flex justifyContent="space-between" alignItems="center">
          <Typography variant="beta">All subscriptions</Typography>
          <Flex gap={2}>
            <SingleSelect placeholder="Any plan" value={tier} onChange={(v: string | number) => { setTier(String(v)); setSPage(1); }} onClear={() => setTier('')} size="S">
              <SingleSelectOption value="free">Free</SingleSelectOption><SingleSelectOption value="intermediary">Intermediary</SingleSelectOption><SingleSelectOption value="premium">Premium</SingleSelectOption>
            </SingleSelect>
            <SingleSelect placeholder="Any status" value={status} onChange={(v: string | number) => { setStatus(String(v)); setSPage(1); }} onClear={() => setStatus('')} size="S">
              <SingleSelectOption value="active">Active</SingleSelectOption><SingleSelectOption value="cancelled">Cancelled</SingleSelectOption><SingleSelectOption value="past_due">Past due</SingleSelectOption>
            </SingleSelect>
          </Flex>
        </Flex>
        <Box paddingTop={3}>
          <Table colCount={5} rowCount={subs.data.length + 1}>
            <Thead><Tr><Th><Typography variant="sigma">Member</Typography></Th><Th><Typography variant="sigma">Plan</Typography></Th><Th><Typography variant="sigma">Status</Typography></Th><Th><Typography variant="sigma">Ends</Typography></Th><Th><Typography variant="sigma">Free months</Typography></Th></Tr></Thead>
            <Tbody>
              {subs.data.map((s) => (
                <Tr key={s.userId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/plugins/user-manager/${s.userId}`)}>
                  <Td><Typography fontWeight="bold">{s.name}</Typography><br /><Typography variant="pi" textColor="neutral600">{s.email}</Typography></Td>
                  <Td><Pill kind={s.tier === 'premium' ? 'good' : 'neutral'}>{s.tier}</Pill></Td>
                  <Td><Pill kind={s.status === 'active' ? 'ok' : 'warn'}>{s.status}</Pill></Td>
                  <Td><Typography>{day(s.currentPeriodEnd)}</Typography></Td>
                  <Td><Typography>{s.freeMonths}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Flex gap={2} paddingTop={3}>
          <Button variant="tertiary" disabled={sPage <= 1} onClick={() => setSPage(sPage - 1)}>Previous</Button>
          <Typography>Page {subs.page} of {Math.max(subs.totalPages, 1)}</Typography>
          <Button variant="tertiary" disabled={sPage >= subs.totalPages} onClick={() => setSPage(sPage + 1)}>Next</Button>
        </Flex>
      </Box>
    </Box>
  );
}
