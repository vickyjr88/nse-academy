import React, { useEffect, useState } from 'react';
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
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Advisor {
  id: string;
  headline: string;
  specialties: string[];
  approvalStatus: 'pending' | 'approved' | 'suspended';
  createdAt: string;
  user: { id: string; name: string; email: string };
  _count?: { clients: number; queries: number; insights: number; alerts: number };
}

interface AdvisorsResponse {
  data: Advisor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, string> = { pending: 'warning', approved: 'success', suspended: 'danger' };

export function AdvisorApprovals() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => fetchAdvisors(1), 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  useEffect(() => {
    fetchAdvisors(page);
  }, [page]);

  async function fetchAdvisors(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.append('search', search);
      if (status) params.append('status', status);

      const res = await fetch(`${NSE_API_URL}/admin/advisors?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AdvisorsResponse = await res.json();
      setAdvisors(json.data);
      setTotalPages(json.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(advisorId: string, action: 'approve' | 'suspend') {
    setActingId(advisorId);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/advisors/${advisorId}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setAdvisors((prev) => prev.map((a) => (a.id === advisorId ? { ...a, approvalStatus: updated.approvalStatus } : a)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading advisors…</Loader>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
        <Typography variant="alpha">Advisor Approvals</Typography>
      </Flex>

      {error && (
        <Box paddingBottom={4}>
          <Typography textColor="danger600">{error}</Typography>
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
              <SingleSelectOption value="approved">Approved</SingleSelectOption>
              <SingleSelectOption value="suspended">Suspended</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={advisors.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Headline</Typography></Th>
            <Th><Typography variant="sigma">Specialties</Typography></Th>
            <Th><Typography variant="sigma">Clients</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {advisors.map((a) => (
            <Tr key={a.id}>
              <Td>
                <Typography fontWeight="semiBold">{a.user.name}</Typography>
                <Typography variant="pi" textColor="neutral600">{a.user.email}</Typography>
              </Td>
              <Td><Typography>{a.headline}</Typography></Td>
              <Td><Typography>{a.specialties.join(', ') || '—'}</Typography></Td>
              <Td><Typography>{a._count?.clients ?? 0}</Typography></Td>
              <Td>
                <Badge backgroundColor={`${STATUS_BADGE[a.approvalStatus]}100`} textColor={`${STATUS_BADGE[a.approvalStatus]}600`}>
                  {a.approvalStatus}
                </Badge>
              </Td>
              <Td>
                <Flex gap={2}>
                  {a.approvalStatus !== 'approved' && (
                    <Button size="S" onClick={() => handleAction(a.id, 'approve')} loading={actingId === a.id}>
                      Approve
                    </Button>
                  )}
                  {a.approvalStatus !== 'suspended' && (
                    <Button size="S" variant="danger-light" onClick={() => handleAction(a.id, 'suspend')} loading={actingId === a.id}>
                      Suspend
                    </Button>
                  )}
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box paddingTop={4} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button
          size="S"
          variant="tertiary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Typography>Page {page} of {totalPages}</Typography>
        <Button
          size="S"
          variant="tertiary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
