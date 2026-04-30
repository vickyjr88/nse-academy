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

interface Organization {
  id: string;
  name: string;
  type: string;
  email: string;
  licenseKey: string;
  createdAt: string;
  _count?: {
    members: number;
  };
}

interface OrganizationsResponse {
  data: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function OrganizationsList() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => fetchOrganizations(1), 300);
    return () => clearTimeout(timer);
  }, [search, type]);

  useEffect(() => {
    fetchOrganizations(page);
  }, [page]);

  async function fetchOrganizations(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (type) params.append('type', type);

      const res = await fetch(`${NSE_API_URL}/admin/organizations?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: OrganizationsResponse = await res.json();
      setOrganizations(json.data);
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
        <Loader>Loading organizations…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load organizations: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Organizations</Typography>
      </Box>

      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by name, email, or license..."
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
              label="Organization Type"
              value={type}
              onChange={(v: string) => { setType(v); setPage(1); }}
              onClear={() => { setType(''); setPage(1); }}
            >
              <SingleSelectOption value="company">Company</SingleSelectOption>
              <SingleSelectOption value="school">School / University</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={organizations.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Type</Typography></Th>
            <Th><Typography variant="sigma">Admin Email</Typography></Th>
            <Th><Typography variant="sigma">License Key</Typography></Th>
            <Th><Typography variant="sigma">Members Count</Typography></Th>
            <Th><Typography variant="sigma">Created At</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {organizations.map((org) => (
            <Tr key={org.id}>
              <Td><Typography>{org.name}</Typography></Td>
              <Td><Typography>{org.type}</Typography></Td>
              <Td><Typography>{org.email}</Typography></Td>
              <Td><Typography>{org.licenseKey}</Typography></Td>
              <Td><Typography>{org._count?.members ?? 0}</Typography></Td>
              <Td>
                <Typography>
                  {new Date(org.createdAt).toLocaleDateString()}
                </Typography>
              </Td>
              <Td>
                <Button size="S" variant="secondary" onClick={() => navigate(`/plugins/user-manager/organizations/${org.id}`)}>
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
