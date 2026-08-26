import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Typography,
  TextInput,
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

export function StockPricesList() {
  const navigate = useNavigate();
  const [prices, setPrices] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/stock-prices`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { data: StockPrice[] } = await res.json();
        setPrices(json.data.sort((a, b) => a.ticker.localeCompare(b.ticker)));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const visible = search
    ? prices.filter(
        (p) =>
          p.ticker.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : prices;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Stock Prices</Typography>
        <Box paddingTop={2}>
          <Typography textColor="neutral600">
            Latest price for every counter ({prices.length} tickers). Click a row for price history.
          </Typography>
        </Box>
      </Box>

      <Box paddingBottom={4} style={{ width: '280px' }}>
        <TextInput
          placeholder="Search by ticker or name..."
          label="Search"
          name="search"
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
        />
      </Box>

      <Table colCount={5} rowCount={visible.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Ticker</Typography></Th>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Price (KES)</Typography></Th>
            <Th><Typography variant="sigma">Change</Typography></Th>
            <Th><Typography variant="sigma">Last Updated</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {visible.map((price) => (
            <Tr
              key={price.ticker}
              onClick={() => navigate(`/plugins/user-manager/stock-prices/${price.ticker}`)}
              style={{ cursor: 'pointer' }}
            >
              <Td><Typography fontWeight="bold">{price.ticker}</Typography></Td>
              <Td><Typography>{price.name}</Typography></Td>
              <Td><Typography>{price.price}</Typography></Td>
              <Td>
                <Typography textColor={price.change.startsWith('-') ? 'danger600' : 'success600'}>
                  {price.change}
                </Typography>
              </Td>
              <Td>
                <Typography>{new Date(price.timestamp).toLocaleString()}</Typography>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
