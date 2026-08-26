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
  SingleSelect,
  SingleSelectOption,
  Flex,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface ContactFeatures {
  totalSubmissions: number;
  new: number;
  read: number;
  replied: number;
}

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface ContactSubmissionsResponse {
  data: ContactSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function ContactSubmissionsList() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState<ContactFeatures | null>(null);

  useEffect(() => {
    fetchSubmissions(page);
  }, [page, status]);

  useEffect(() => {
    fetch(`${NSE_API_URL}/admin/analytics`, { headers: { 'x-admin-key': NSE_ADMIN_KEY } })
      .then((r) => r.json())
      .then((json) => setStats(json.contactFeatures))
      .catch(() => {});
  }, []);

  async function fetchSubmissions(p: number) {
    if (!loaded) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (status) params.append('status', status);

      const res = await fetch(`${NSE_API_URL}/admin/contact-submissions?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ContactSubmissionsResponse = await res.json();
      setSubmissions(json.data);
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
        <Loader>Loading contact submissions…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load contact submissions: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Contact Submissions</Typography>
      </Box>

      {stats && (
        <Box paddingBottom={4} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard label="Total Submissions" value={stats.totalSubmissions} />
          <StatCard label="New" value={stats.new} />
          <StatCard label="Read" value={stats.read} />
          <StatCard label="Replied" value={stats.replied} />
        </Box>
      )}

      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '200px' }}>
            <SingleSelect
              label="Status"
              value={status}
              onChange={(v: string) => { setStatus(v); setPage(1); }}
              onClear={() => { setStatus(''); setPage(1); }}
            >
              <SingleSelectOption value="new">New</SingleSelectOption>
              <SingleSelectOption value="in_progress">In Progress</SingleSelectOption>
              <SingleSelectOption value="resolved">Resolved</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={submissions.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Subject</Typography></Th>
            <Th><Typography variant="sigma">Message Preview</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Date</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {submissions.map((sub) => (
            <Tr
              key={sub.id}
              onClick={() => navigate(`/plugins/user-manager/contact-submissions/${sub.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <Td><Typography>{sub.name}</Typography></Td>
              <Td><Typography>{sub.email}</Typography></Td>
              <Td><Typography>{sub.subject}</Typography></Td>
              <Td>
                <Typography>{sub.message.length > 50 ? `${sub.message.substring(0, 50)}...` : sub.message}</Typography>
              </Td>
              <Td>
                <Typography textColor={sub.status === 'new' ? 'danger600' : 'neutral600'}>
                  {sub.status}
                </Typography>
              </Td>
              <Td>
                <Typography>
                  {new Date(sub.createdAt).toLocaleDateString()}
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
