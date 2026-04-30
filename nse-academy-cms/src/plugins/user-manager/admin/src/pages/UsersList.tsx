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
  Td,
  Typography,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  Flex,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Subscription {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  subscription: Subscription | null;
}

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(1), 300);
    return () => clearTimeout(timer);
  }, [search, tier, status]);

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  async function fetchUsers(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (tier) params.append('tier', tier);
      if (status) params.append('status', status);

      const res = await fetch(`${NSE_API_URL}/admin/users?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: UsersResponse = await res.json();
      setUsers(json.data);
      setTotalPages(json.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading users…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load users: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Users</Typography>
      </Box>

      {/* Filters */}
      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by name, email, or phone..."
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
              label="Tier"
              value={tier}
              onChange={(v: string) => { setTier(v); setPage(1); }}
              onClear={() => { setTier(''); setPage(1); }}
            >
              <SingleSelectOption value="free">Free</SingleSelectOption>
              <SingleSelectOption value="intermediary">Intermediary</SingleSelectOption>
              <SingleSelectOption value="premium">Premium</SingleSelectOption>
            </SingleSelect>
          </Box>
          <Box style={{ width: '200px' }}>
            <SingleSelect
              label="Status"
              value={status}
              onChange={(v: string) => { setStatus(v); setPage(1); }}
              onClear={() => { setStatus(''); setPage(1); }}
            >
              <SingleSelectOption value="active">Active</SingleSelectOption>
              <SingleSelectOption value="cancelled">Cancelled</SingleSelectOption>
              <SingleSelectOption value="past_due">Past Due</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={7} rowCount={users.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Phone</Typography></Th>
            <Th><Typography variant="sigma">Tier</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Period End</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => (
            <Tr key={user.id}>
              <Td><Typography>{user.name}</Typography></Td>
              <Td><Typography>{user.email}</Typography></Td>
              <Td><Typography>{user.phone ?? '—'}</Typography></Td>
              <Td><Typography>{user.subscription?.tier ?? '—'}</Typography></Td>
              <Td><Typography>{user.subscription?.status ?? '—'}</Typography></Td>
              <Td>
                <Typography>
                  {user.subscription?.currentPeriodEnd
                    ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString()
                    : '—'}
                </Typography>
              </Td>
              <Td>
                <Button
                  size="S"
                  variant="secondary"
                  onClick={() => navigate(`/plugins/user-manager/${user.id}`)}
                >
                  View
                </Button>
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
