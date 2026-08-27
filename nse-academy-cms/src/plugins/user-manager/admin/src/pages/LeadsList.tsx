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
  Badge,
} from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface Lead {
  id: string;
  email: string;
  name: string | null;
  magnetSlug: string;
  source: string | null;
  downloadCount: number;
  convertedAt: string | null;
  createdAt: string;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LeadStats {
  total: number;
  downloaded: number;
  converted: number;
  conversionRate: number;
  byMagnet: { magnetSlug: string; count: number }[];
}

export function LeadsList() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [magnetSlug, setMagnetSlug] = useState('');
  const [stats, setStats] = useState<LeadStats | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(1), 300);
    return () => clearTimeout(timer);
  }, [search, magnetSlug]);

  useEffect(() => {
    fetchLeads(page);
  }, [page]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${NSE_API_URL}/leads/stats`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) return;
      setStats(await res.json());
    } catch {
      // Stats are a bonus - the list still works without them.
    }
  }

  async function fetchLeads(p: number) {
    if (!loaded) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (magnetSlug) params.append('magnetSlug', magnetSlug);
      if (search) params.append('search', search);

      const res = await fetch(`${NSE_API_URL}/leads?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LeadsResponse = await res.json();
      setLeads(json.items);
      setTotalPages(json.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  function handleExportCsv() {
    const params = new URLSearchParams({ 'x-admin-key': NSE_ADMIN_KEY });
    if (magnetSlug) params.append('magnetSlug', magnetSlug);
    window.open(`${NSE_API_URL}/leads/export.csv?${params.toString()}`, '_blank');
  }

  if (loading && !loaded) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading leads…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load leads: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
        <Typography variant="alpha">Leads</Typography>
        <Button size="S" variant="secondary" startIcon={<Download />} onClick={handleExportCsv}>
          Export CSV
        </Button>
      </Flex>

      {stats && (
        <Box paddingBottom={4} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard label="Total Leads" value={stats.total} />
          <StatCard label="Downloaded" value={stats.downloaded} />
          <StatCard label="Converted" value={stats.converted} />
          <StatCard label="Conversion Rate" value={`${Math.round(stats.conversionRate * 1000) / 10}%`} />
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
          <Box style={{ width: '240px' }}>
            <SingleSelect
              label="Lead Magnet"
              value={magnetSlug}
              onChange={(v: string) => { setMagnetSlug(v); setPage(1); }}
              onClear={() => { setMagnetSlug(''); setPage(1); }}
            >
              {(stats?.byMagnet ?? []).map((m) => (
                <SingleSelectOption key={m.magnetSlug} value={m.magnetSlug}>
                  {m.magnetSlug} ({m.count})
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      {loading && loaded && (
        <Box paddingBottom={2}>
          <Typography variant="pi" textColor="neutral500">Refreshing…</Typography>
        </Box>
      )}

      <Table colCount={7} rowCount={leads.length} style={{ opacity: loading && loaded ? 0.5 : 1 }}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Magnet</Typography></Th>
            <Th><Typography variant="sigma">Source</Typography></Th>
            <Th><Typography variant="sigma">Downloads</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Captured</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {leads.map((lead) => (
            <Tr
              key={lead.id}
              onClick={() => navigate(`/plugins/user-manager/leads/${lead.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <Td><Typography>{lead.name || '—'}</Typography></Td>
              <Td><Typography>{lead.email}</Typography></Td>
              <Td><Typography>{lead.magnetSlug}</Typography></Td>
              <Td><Typography>{lead.source || '—'}</Typography></Td>
              <Td><Typography>{lead.downloadCount}</Typography></Td>
              <Td>
                {lead.convertedAt ? (
                  <Badge backgroundColor="success100" textColor="success600">Converted</Badge>
                ) : lead.downloadCount > 0 ? (
                  <Badge backgroundColor="primary100" textColor="primary600">Downloaded</Badge>
                ) : (
                  <Badge backgroundColor="neutral150" textColor="neutral600">Captured</Badge>
                )}
              </Td>
              <Td><Typography>{new Date(lead.createdAt).toLocaleDateString()}</Typography></Td>
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
