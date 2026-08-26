import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Typography,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  Flex,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface Referral {
  id: string;
  status: string;
  rewardedAt: string | null;
  createdAt: string;
  referrer: {
    name: string;
    email: string;
  };
  referred: {
    name: string;
    email: string;
  };
}

interface ReferralsResponse {
  data: Referral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ReferralAnalytics {
  total: number;
  completed: number;
  pending: number;
  conversionRate: number;
}

export function ReferralsList() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<ReferralAnalytics | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => fetchReferrals(1), 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  useEffect(() => {
    fetchReferrals(page);
  }, [page]);

  useEffect(() => {
    fetch(`${NSE_API_URL}/admin/analytics`, { headers: { 'x-admin-key': NSE_ADMIN_KEY } })
      .then((r) => r.json())
      .then((json) => setStats(json.referrals))
      .catch(() => {});
  }, []);

  async function fetchReferrals(p: number) {
    if (!loaded) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const res = await fetch(`${NSE_API_URL}/admin/referrals?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ReferralsResponse = await res.json();
      setReferrals(json.data);
      setTotalPages(json.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  if (loading && !loaded) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading referrals…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load referrals: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Referrals</Typography>
      </Box>

      {stats && (
        <Box paddingBottom={4} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard label="Total Referrals" value={stats.total} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
        </Box>
      )}

      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by name or email..."
              label="Search"
              name="search"
              value={search}
              onChange={(e: any) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Box>
          <Box style={{ width: '200px' }}>
            <SingleSelect
              label="Status"
              value={status}
              onChange={(v: string) => { setStatus(v); setPage(1); }}
              onClear={() => { setStatus(''); setPage(1); }}
            >
              <SingleSelectOption value="pending">Pending</SingleSelectOption>
              <SingleSelectOption value="completed">Completed</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      {loading && loaded && (
        <Box paddingBottom={2}>
          <Typography variant="pi" textColor="neutral500">Refreshing…</Typography>
        </Box>
      )}

      <Table colCount={6} rowCount={referrals.length} style={{ opacity: loading && loaded ? 0.5 : 1 }}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Referrer Name</Typography></Th>
            <Th><Typography variant="sigma">Referrer Email</Typography></Th>
            <Th><Typography variant="sigma">Referred Name</Typography></Th>
            <Th><Typography variant="sigma">Referred Email</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Date</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {referrals.map((ref) => (
            <Tr
              key={ref.id}
              onClick={() => navigate(`/plugins/user-manager/referrals/${ref.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <Td><Typography>{ref.referrer?.name}</Typography></Td>
              <Td><Typography>{ref.referrer?.email}</Typography></Td>
              <Td><Typography>{ref.referred?.name}</Typography></Td>
              <Td><Typography>{ref.referred?.email}</Typography></Td>
              <Td>
                <Typography textColor={ref.status === 'completed' ? 'success600' : 'neutral600'}>
                  {ref.status}
                </Typography>
              </Td>
              <Td>
                <Typography>
                  {new Date(ref.createdAt).toLocaleDateString()}
                </Typography>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box paddingTop={4} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button size="S" variant="tertiary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Typography>Page {page} of {totalPages}</Typography>
        <Button size="S" variant="tertiary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </Box>
    </Box>
  );
}
