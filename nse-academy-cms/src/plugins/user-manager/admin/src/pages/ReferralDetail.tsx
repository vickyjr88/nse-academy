import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Referral {
  id: string;
  status: string;
  rewardedAt: string | null;
  createdAt: string;
  referrer: { id: string; name: string; email: string };
  referred: { id: string; name: string; email: string };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box paddingTop={2}>
      <Typography variant="pi" fontWeight="bold">{label}:</Typography> <Typography>{value}</Typography>
    </Box>
  );
}

export function ReferralDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [referral, setReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/referrals/${id}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setReferral(await res.json());
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
        <Loader>Loading referral…</Loader>
      </Box>
    );
  }

  if (error || !referral) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load referral: {error}</Typography>
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

      <Box paddingBottom={4}>
        <Typography variant="alpha">Referral</Typography>
      </Box>

      <Flex gap={4} paddingBottom={4}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Referrer</Typography>
          <Field label="Name" value={referral.referrer.name} />
          <Field label="Email" value={referral.referrer.email} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Referred</Typography>
          <Field label="Name" value={referral.referred.name} />
          <Field label="Email" value={referral.referred.email} />
        </Box>
      </Flex>

      <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius>
        <Typography variant="beta">Status</Typography>
        <Field
          label="Status"
          value={
            <Typography textColor={referral.status === 'completed' ? 'success600' : 'warning600'}>
              {referral.status}
            </Typography>
          }
        />
        <Field label="Created At" value={new Date(referral.createdAt).toLocaleString()} />
        <Field
          label="Rewarded At"
          value={referral.rewardedAt ? new Date(referral.rewardedAt).toLocaleString() : 'Not yet'}
        />
      </Box>
    </Box>
  );
}
