import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface StockPriceRow {
  id: string;
  ticker: string;
  name: string;
  price: number;
  volume: string;
  change: string;
  timestamp: string;
}

interface HistoryResponse {
  ticker: string;
  data: StockPriceRow[];
}

export function StockPriceDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [history, setHistory] = useState<StockPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/stock-prices/${ticker}/history`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: HistoryResponse = await res.json();
        setHistory(json.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [ticker]);

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading price history…</Loader>
      </Box>
    );
  }

  if (error || history.length === 0) {
    return (
      <Box padding={8}>
        <Box paddingBottom={4}>
          <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Box>
        <Typography textColor="danger600">
          {error || 'No price history found for this ticker.'}
        </Typography>
      </Box>
    );
  }

  const latest = history[history.length - 1];
  const chartData = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    price: h.price,
  }));

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>

      <Box paddingBottom={4}>
        <Typography variant="alpha">{latest.ticker}</Typography>
        <Box paddingTop={1}>
          <Typography textColor="neutral600">{latest.name}</Typography>
        </Box>
      </Box>

      <Flex gap={4} paddingBottom={6}>
        <StatCard label="Current Price (KES)" value={latest.price} />
        <StatCard
          label="Change"
          value={latest.change}
        />
        <StatCard label="Volume" value={latest.volume} />
        <StatCard label="Data Points (30d)" value={history.length} />
      </Flex>

      <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius>
        <Typography variant="delta">Price over the last 30 days</Typography>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#047857" dot={false} name="Price (KES)" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
