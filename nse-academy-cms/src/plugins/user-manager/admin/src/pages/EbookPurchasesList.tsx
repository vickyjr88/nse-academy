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
  Flex,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface EbookPurchase {
  id: string;
  reference: string;
  amountKes: number;
  purchasedAt: string;
  productId: string;
  user: {
    name: string;
    email: string;
  };
}

interface EbookPurchasesResponse {
  data: EbookPurchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function EbookPurchasesList() {
  const [purchases, setPurchases] = useState<EbookPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchPurchases(1), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPurchases(page);
  }, [page]);

  async function fetchPurchases(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (search) params.append('search', search);

      const res = await fetch(`${NSE_API_URL}/admin/ebook-purchases?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: EbookPurchasesResponse = await res.json();
      setPurchases(json.data);
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
        <Loader>Loading ebook purchases…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load ebook purchases: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Ebook Purchases</Typography>
      </Box>

      {/* Filters */}
      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by user, ref, product ID..."
              label="Search"
              name="search"
              value={search}
              onChange={(e: any) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={purchases.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">User</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Amount (KES)</Typography></Th>
            <Th><Typography variant="sigma">Product ID</Typography></Th>
            <Th><Typography variant="sigma">Reference</Typography></Th>
            <Th><Typography variant="sigma">Date</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {purchases.map((purchase) => (
            <Tr key={purchase.id}>
              <Td><Typography>{purchase.user?.name}</Typography></Td>
              <Td><Typography>{purchase.user?.email}</Typography></Td>
              <Td><Typography>{purchase.amountKes.toLocaleString()}</Typography></Td>
              <Td><Typography>{purchase.productId}</Typography></Td>
              <Td><Typography>{purchase.reference}</Typography></Td>
              <Td>
                <Typography>
                  {new Date(purchase.purchasedAt).toLocaleString()}
                </Typography>
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
