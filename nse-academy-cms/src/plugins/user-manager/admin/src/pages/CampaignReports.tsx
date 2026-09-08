import React, { useEffect, useState } from 'react';
import { Alert, Box, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { StatCard } from '../components/StatCard';

interface Campaign {
  id: string;
  subject: string;
  tier: string | null;
  audienceCount: number;
  failedCount: number;
  createdAt: string;
}

interface CampaignReport {
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  failureRate: number;
  campaigns: Campaign[];
}

export function CampaignReports() {
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/analytics/campaigns`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setReport(await res.json());
      } catch (e: any) {
        setError(e.message || 'Failed to load campaign report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading campaign reports…</Loader>
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box padding={8}>
        <Alert closeLabel="Close" title="Failed to load" variant="danger">
          {error || 'No data'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={6}>
        <Typography variant="alpha">Campaign Reports</Typography>
        <Box paddingTop={2}>
          <Typography textColor="neutral600">
            Every one-shot admin broadcast sent through Compose Email, with reach and delivery-failure totals.
          </Typography>
        </Box>
      </Box>

      <Flex gap={4} paddingBottom={6} wrap="wrap">
        <StatCard label="Campaigns Sent" value={report.totalCampaigns} />
        <StatCard label="Total Reached" value={report.totalSent.toLocaleString()} tone="positive" />
        <StatCard label="Total Failed Syncs" value={report.totalFailed.toLocaleString()} tone={report.totalFailed > 0 ? 'negative' : 'neutral'} />
        <StatCard label="Failure Rate" value={`${(report.failureRate * 100).toFixed(1)}%`} tone={report.failureRate > 0.05 ? 'negative' : 'neutral'} />
      </Flex>

      <Box background="neutral0" padding={5} shadow="filterShadow" hasRadius>
        {report.campaigns.length === 0 ? (
          <Typography textColor="neutral600">No campaigns sent yet.</Typography>
        ) : (
          <Table colCount={4} rowCount={report.campaigns.length}>
            <Thead>
              <Tr>
                <Th><Typography variant="sigma">Subject</Typography></Th>
                <Th><Typography variant="sigma">Audience</Typography></Th>
                <Th><Typography variant="sigma">Reached</Typography></Th>
                <Th><Typography variant="sigma">Sent</Typography></Th>
              </Tr>
            </Thead>
            <Tbody>
              {report.campaigns.map((c) => (
                <Tr key={c.id}>
                  <Td><Typography>{c.subject}</Typography></Td>
                  <Td><Typography>{c.tier ? `${c.tier} tier` : 'All users'}</Typography></Td>
                  <Td>
                    <Typography textColor={c.failedCount > 0 ? 'warning600' : undefined}>
                      {c.audienceCount.toLocaleString()}
                      {c.failedCount > 0 ? ` (${c.failedCount} failed)` : ''}
                    </Typography>
                  </Td>
                  <Td><Typography>{new Date(c.createdAt).toLocaleString()}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
