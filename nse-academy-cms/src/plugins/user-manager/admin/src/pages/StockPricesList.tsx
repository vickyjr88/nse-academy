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

interface StockPrice {
  id: string;
  ticker: string;
  name: string;
  price: number;
  volume: string;
  change: string;
  timestamp: string;
}

interface StockPricesResponse {
  data: StockPrice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function StockPricesList() {
  const [prices, setPrices] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ticker, setTicker] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchPrices(1), 300);
    return () => clearTimeout(timer);
  }, [ticker]);

  useEffect(() => {
    fetchPrices(page);
  }, [page]);

  async function fetchPrices(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (ticker) params.append('ticker', ticker);

      const res = await fetch(`${NSE_API_URL}/admin/stock-prices?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: StockPricesResponse = await res.json();
      setPrices(json.data);
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
        <Loader>Loading stock prices…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load stock prices: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Stock Prices</Typography>
      </Box>

      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '250px' }}>
            <TextInput
              placeholder="Search by Ticker..."
              label="Ticker Search"
              name="ticker"
              value={ticker}
              onChange={(e: any) => {
                setTicker(e.target.value);
                setPage(1);
              }}
            />
          </Box>
        </Flex>
      </Box>

      <Table colCount={6} rowCount={prices.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Ticker</Typography></Th>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Price (KES)</Typography></Th>
            <Th><Typography variant="sigma">Volume</Typography></Th>
            <Th><Typography variant="sigma">Change</Typography></Th>
            <Th><Typography variant="sigma">Timestamp</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {prices.map((price) => (
            <Tr key={price.id}>
              <Td><Typography fontWeight="bold">{price.ticker}</Typography></Td>
              <Td><Typography>{price.name}</Typography></Td>
              <Td><Typography>{price.price}</Typography></Td>
              <Td><Typography>{price.volume}</Typography></Td>
              <Td>
                <Typography textColor={price.change.startsWith('-') ? 'danger600' : 'success600'}>
                  {price.change}
                </Typography>
              </Td>
              <Td>
                <Typography>
                  {new Date(price.timestamp).toLocaleString()}
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
