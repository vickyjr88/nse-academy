import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Loader,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Divider,
  Badge,
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Advisor {
  id: string;
  headline: string;
  bio: string;
  specialties: string[];
  credentials: string | null;
  isPublic: boolean;
  isActive: boolean;
  approvalStatus: 'pending' | 'approved' | 'suspended';
  approvedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  org: { id: string; name: string } | null;
  _count: { clients: number; queries: number; insights: number; alerts: number };
  clients: Array<{
    id: string;
    status: string;
    source: string;
    requestedAt: string;
    user: { id: string; name: string; email: string };
  }>;
  queries: Array<{
    id: string;
    subject: string;
    status: string;
    updatedAt: string;
    user: { id: string; name: string; email: string };
  }>;
  insights: Array<{
    id: string;
    title: string;
    tickers: string[];
    createdAt: string;
  }>;
}

const STATUS_BADGE: Record<string, string> = { pending: 'warning', approved: 'success', suspended: 'danger' };

export function AdvisorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<Advisor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function fetchAdvisor() {
    try {
      const res = await fetch(`${NSE_API_URL}/admin/advisors/${id}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdvisor(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdvisor();
  }, [id]);

  async function handleAction(action: 'approve' | 'suspend') {
    if (!advisor) return;
    setActingId(advisor.id);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/advisors/${advisor.id}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAdvisor();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading advisor…</Loader>
      </Box>
    );
  }

  if (error || !advisor) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load advisor: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>

      <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
        <Box>
          <Typography variant="alpha">{advisor.user.name}</Typography>
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral600">{advisor.user.email}</Typography>
          </Box>
        </Box>
        <Flex gap={2} alignItems="center">
          <Badge backgroundColor={`${STATUS_BADGE[advisor.approvalStatus]}100`} textColor={`${STATUS_BADGE[advisor.approvalStatus]}600`}>
            {advisor.approvalStatus}
          </Badge>
          {advisor.approvalStatus !== 'approved' && (
            <Button size="S" onClick={() => handleAction('approve')} loading={actingId === advisor.id}>
              Approve
            </Button>
          )}
          {advisor.approvalStatus !== 'suspended' && (
            <Button size="S" variant="danger-light" onClick={() => handleAction('suspend')} loading={actingId === advisor.id}>
              Suspend
            </Button>
          )}
        </Flex>
      </Flex>

      <Flex gap={4} paddingBottom={8}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Profile</Typography>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Headline:</Typography> <Typography>{advisor.headline}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Bio:</Typography> <Typography>{advisor.bio}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Specialties:</Typography> <Typography>{advisor.specialties.join(', ') || '—'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Credentials:</Typography> <Typography>{advisor.credentials || '—'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Organization:</Typography> <Typography>{advisor.org?.name || '—'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Public:</Typography> <Typography>{advisor.isPublic ? 'Yes' : 'No'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Active:</Typography> <Typography>{advisor.isActive ? 'Yes' : 'No'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Approved At:</Typography>{' '}
            <Typography>{advisor.approvedAt ? new Date(advisor.approvedAt).toLocaleDateString() : '—'}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Created At:</Typography> <Typography>{new Date(advisor.createdAt).toLocaleDateString()}</Typography>
          </Box>
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Activity</Typography>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Clients:</Typography> <Typography>{advisor._count.clients}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Queries:</Typography> <Typography>{advisor._count.queries}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Insights Published:</Typography> <Typography>{advisor._count.insights}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Price Alerts:</Typography> <Typography>{advisor._count.alerts}</Typography>
          </Box>
        </Box>
      </Flex>

      <Divider />

      <Box paddingTop={8} paddingBottom={4}>
        <Typography variant="beta">Recent Clients ({advisor.clients.length} of {advisor._count.clients})</Typography>
      </Box>
      <Table colCount={4} rowCount={advisor.clients.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Requested At</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {advisor.clients.map((c) => (
            <Tr key={c.id}>
              <Td><Typography>{c.user.name}</Typography></Td>
              <Td><Typography>{c.user.email}</Typography></Td>
              <Td><Typography>{c.status}</Typography></Td>
              <Td><Typography>{new Date(c.requestedAt).toLocaleDateString()}</Typography></Td>
            </Tr>
          ))}
          {advisor.clients.length === 0 && (
            <Tr>
              <Td colSpan={4}><Typography textColor="neutral600">No clients yet.</Typography></Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      <Box paddingTop={8} paddingBottom={4}>
        <Typography variant="beta">Recent Queries ({advisor.queries.length} of {advisor._count.queries})</Typography>
      </Box>
      <Table colCount={4} rowCount={advisor.queries.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">From</Typography></Th>
            <Th><Typography variant="sigma">Subject</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Updated At</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {advisor.queries.map((q) => (
            <Tr key={q.id}>
              <Td><Typography>{q.user.name}</Typography></Td>
              <Td><Typography>{q.subject}</Typography></Td>
              <Td><Typography>{q.status}</Typography></Td>
              <Td><Typography>{new Date(q.updatedAt).toLocaleDateString()}</Typography></Td>
            </Tr>
          ))}
          {advisor.queries.length === 0 && (
            <Tr>
              <Td colSpan={4}><Typography textColor="neutral600">No queries yet.</Typography></Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      <Box paddingTop={8} paddingBottom={4}>
        <Typography variant="beta">Recent Insights ({advisor.insights.length} of {advisor._count.insights})</Typography>
      </Box>
      <Table colCount={3} rowCount={advisor.insights.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Title</Typography></Th>
            <Th><Typography variant="sigma">Tickers</Typography></Th>
            <Th><Typography variant="sigma">Published At</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {advisor.insights.map((i) => (
            <Tr key={i.id}>
              <Td><Typography>{i.title}</Typography></Td>
              <Td><Typography>{i.tickers.join(', ') || '—'}</Typography></Td>
              <Td><Typography>{new Date(i.createdAt).toLocaleDateString()}</Typography></Td>
            </Tr>
          ))}
          {advisor.insights.length === 0 && (
            <Tr>
              <Td colSpan={3}><Typography textColor="neutral600">No insights published yet.</Typography></Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </Box>
  );
}
