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
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface InvestorProfile {
  id: string;
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface InvestorProfilesResponse {
  data: InvestorProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function InvestorProfilesList() {
  const [profiles, setProfiles] = useState<InvestorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [capitalRange, setCapitalRange] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchProfiles(1), 300);
    return () => clearTimeout(timer);
  }, [search, type, capitalRange]);

  useEffect(() => {
    fetchProfiles(page);
  }, [page]);

  async function fetchProfiles(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (type) params.append('type', type);
      if (capitalRange) params.append('capitalRange', capitalRange);

      const res = await fetch(`${NSE_API_URL}/admin/investor-profiles?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: InvestorProfilesResponse = await res.json();
      setProfiles(json.data);
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
        <Loader>Loading investor profiles…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load investor profiles: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Investor Profiles</Typography>
      </Box>

      {/* Filters */}
      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by user name or email..."
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
              label="Investor Type"
              value={type}
              onChange={(v: string) => { setType(v); setPage(1); }}
              onClear={() => { setType(''); setPage(1); }}
            >
              <SingleSelectOption value="conservative">Conservative</SingleSelectOption>
              <SingleSelectOption value="moderate">Moderate</SingleSelectOption>
              <SingleSelectOption value="aggressive">Aggressive</SingleSelectOption>
              <SingleSelectOption value="dividend">Dividend</SingleSelectOption>
              <SingleSelectOption value="growth">Growth</SingleSelectOption>
            </SingleSelect>
          </Box>
          <Box style={{ width: '200px' }}>
            <SingleSelect
              label="Capital Range"
              value={capitalRange}
              onChange={(v: string) => { setCapitalRange(v); setPage(1); }}
              onClear={() => { setCapitalRange(''); setPage(1); }}
            >
              <SingleSelectOption value="<100k">&lt;100k</SingleSelectOption>
              <SingleSelectOption value="100k-500k">100k-500k</SingleSelectOption>
              <SingleSelectOption value="500k-2M">500k-2M</SingleSelectOption>
              <SingleSelectOption value=">2M">&gt;2M</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={profiles.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">User</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Type</Typography></Th>
            <Th><Typography variant="sigma">Risk Score</Typography></Th>
            <Th><Typography variant="sigma">Capital Range</Typography></Th>
            <Th><Typography variant="sigma">Horizon (Years)</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {profiles.map((profile) => (
            <Tr key={profile.id}>
              <Td><Typography>{profile.user?.name}</Typography></Td>
              <Td><Typography>{profile.user?.email}</Typography></Td>
              <Td><Typography>{profile.type}</Typography></Td>
              <Td><Typography>{profile.riskScore}</Typography></Td>
              <Td><Typography>{profile.capitalRange}</Typography></Td>
              <Td><Typography>{profile.horizonYears}</Typography></Td>
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
