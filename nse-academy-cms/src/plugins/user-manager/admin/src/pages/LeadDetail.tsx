import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex, Badge } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Lead {
  id: string;
  email: string;
  name: string | null;
  magnetSlug: string;
  source: string | null;
  referralCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  downloadCount: number;
  downloadedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box paddingTop={2}>
      <Typography variant="pi" fontWeight="bold">{label}:</Typography>{' '}
      <Typography>{value || value === 0 ? value : '—'}</Typography>
    </Box>
  );
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/leads/${id}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setLead(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading lead…</Loader>
      </Box>
    );
  }

  if (error || !lead) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load lead: {error}</Typography>
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
        <Typography variant="alpha">{lead.name || lead.email}</Typography>
        {lead.convertedAt ? (
          <Badge backgroundColor="success100" textColor="success600">Converted</Badge>
        ) : lead.downloadCount > 0 ? (
          <Badge backgroundColor="primary100" textColor="primary600">Downloaded</Badge>
        ) : (
          <Badge backgroundColor="neutral150" textColor="neutral600">Captured</Badge>
        )}
      </Flex>

      <Flex gap={4} paddingBottom={4}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Lead Details</Typography>
          <Field label="Email" value={lead.email} />
          <Field label="Name" value={lead.name} />
          <Field label="Magnet" value={lead.magnetSlug} />
          <Field label="Source" value={lead.source} />
          <Field label="Referral Code" value={lead.referralCode} />
          <Field label="Captured At" value={new Date(lead.createdAt).toLocaleString()} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Engagement</Typography>
          <Field label="Downloads" value={lead.downloadCount} />
          <Field label="Last Downloaded" value={lead.downloadedAt ? new Date(lead.downloadedAt).toLocaleString() : null} />
          <Field label="Converted At" value={lead.convertedAt ? new Date(lead.convertedAt).toLocaleString() : null} />
        </Box>
      </Flex>

      <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius>
        <Typography variant="beta">UTM Attribution</Typography>
        <Field label="Source" value={lead.utmSource} />
        <Field label="Medium" value={lead.utmMedium} />
        <Field label="Campaign" value={lead.utmCampaign} />
        <Field label="Term" value={lead.utmTerm} />
        <Field label="Content" value={lead.utmContent} />
      </Box>
    </Box>
  );
}
