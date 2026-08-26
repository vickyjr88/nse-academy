import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface InvestorProfile {
  id: string;
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
  quizAnswers: Record<string, unknown>;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box paddingTop={2}>
      <Typography variant="pi" fontWeight="bold">{label}:</Typography> <Typography>{value}</Typography>
    </Box>
  );
}

export function InvestorProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/investor-profiles/${id}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setProfile(await res.json());
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
        <Loader>Loading profile…</Loader>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load profile: {error}</Typography>
      </Box>
    );
  }

  const quizEntries = Object.entries(profile.quizAnswers ?? {});

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>

      <Box paddingBottom={4}>
        <Typography variant="alpha">{profile.user.name}</Typography>
      </Box>

      <Flex gap={4} paddingBottom={8}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Investor</Typography>
          <Field label="Email" value={profile.user.email} />
          <Field label="Type" value={profile.type} />
          <Field label="Risk Score" value={`${profile.riskScore} / 100`} />
          <Field label="Horizon" value={`${profile.horizonYears} years`} />
          <Field label="Capital Range" value={profile.capitalRange} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Public Profile</Typography>
          <Field label="Visible" value={profile.isPublic ? 'Yes' : 'No'} />
          <Field label="Slug" value={profile.publicSlug ?? '—'} />
          <Field label="Created At" value={new Date(profile.createdAt).toLocaleString()} />
        </Box>
      </Flex>

      <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius>
        <Typography variant="beta">Quiz Answers</Typography>
        {quizEntries.length === 0 ? (
          <Box paddingTop={2}>
            <Typography textColor="neutral600">No quiz answers recorded.</Typography>
          </Box>
        ) : (
          quizEntries.map(([key, value]) => (
            <Field key={key} label={key} value={typeof value === 'object' ? JSON.stringify(value) : String(value)} />
          ))
        )}
      </Box>
    </Box>
  );
}
