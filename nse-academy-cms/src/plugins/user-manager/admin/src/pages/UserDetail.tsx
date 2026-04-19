import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Loader,
  Typography,
  TextInput,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface InvestorProfile {
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  investorProfile: InvestorProfile | null;
  subscription: Subscription | null;
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [tier, setTier] = useState('free');
  const [status, setStatus] = useState('active');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (id) fetchUser(id);
  }, [id]);

  async function fetchUser(userId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/users/${userId}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserDetail = await res.json();
      setUser(data);
      if (data.subscription) {
        setTier(data.subscription.tier);
        setStatus(data.subscription.status);
        setCurrentPeriodEnd(
          data.subscription.currentPeriodEnd
            ? data.subscription.currentPeriodEnd.substring(0, 10)
            : '',
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/users/${id}/subscription`, {
        method: 'POST',
        headers: {
          'x-admin-key': NSE_ADMIN_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier,
          status,
          currentPeriodEnd: currentPeriodEnd || undefined,
          note: note || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveSuccess(true);
      await fetchUser(id);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!id || !window.confirm('Cancel this subscription?')) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/users/${id}/subscription`, {
        method: 'DELETE',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveSuccess(true);
      await fetchUser(id);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading user…</Loader>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load user: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button variant="tertiary" onClick={() => navigate('/plugins/user-manager')}>
          ← Back
        </Button>
        <Typography variant="alpha">User Detail</Typography>
      </Box>

      {/* User Info */}
      <Box paddingBottom={6}>
        <Typography variant="beta" paddingBottom={2}>User Info</Typography>
        <Box paddingBottom={2}>
          <Typography fontWeight="bold">Name: </Typography>
          <Typography>{user.name}</Typography>
        </Box>
        <Box paddingBottom={2}>
          <Typography fontWeight="bold">Email: </Typography>
          <Typography>{user.email}</Typography>
        </Box>
        <Box paddingBottom={2}>
          <Typography fontWeight="bold">Created: </Typography>
          <Typography>{new Date(user.createdAt).toLocaleString()}</Typography>
        </Box>
      </Box>

      {/* Investor Profile */}
      {user.investorProfile && (
        <Box paddingBottom={6}>
          <Typography variant="beta" paddingBottom={2}>Investor Profile</Typography>
          <Box paddingBottom={2}>
            <Typography fontWeight="bold">Type: </Typography>
            <Typography>{user.investorProfile.type}</Typography>
          </Box>
          <Box paddingBottom={2}>
            <Typography fontWeight="bold">Risk Score: </Typography>
            <Typography>{user.investorProfile.riskScore}</Typography>
          </Box>
          <Box paddingBottom={2}>
            <Typography fontWeight="bold">Horizon: </Typography>
            <Typography>{user.investorProfile.horizonYears} years</Typography>
          </Box>
          <Box paddingBottom={2}>
            <Typography fontWeight="bold">Capital Range: </Typography>
            <Typography>{user.investorProfile.capitalRange}</Typography>
          </Box>
        </Box>
      )}

      {/* Subscription Management */}
      <Box paddingBottom={4}>
        <Typography variant="beta" paddingBottom={4}>Subscription</Typography>

        <Box paddingBottom={4} style={{ maxWidth: '400px' }}>
          <SingleSelect
            label="Tier"
            value={tier}
            onChange={(val: string) => setTier(val)}
          >
            <SingleSelectOption value="free">Free</SingleSelectOption>
            <SingleSelectOption value="intermediary">Intermediary</SingleSelectOption>
            <SingleSelectOption value="premium">Premium</SingleSelectOption>
          </SingleSelect>
        </Box>

        <Box paddingBottom={4} style={{ maxWidth: '400px' }}>
          <SingleSelect
            label="Status"
            value={status}
            onChange={(val: string) => setStatus(val)}
          >
            <SingleSelectOption value="active">Active</SingleSelectOption>
            <SingleSelectOption value="cancelled">Cancelled</SingleSelectOption>
            <SingleSelectOption value="past_due">Past Due</SingleSelectOption>
          </SingleSelect>
        </Box>

        <Box paddingBottom={4} style={{ maxWidth: '400px' }}>
          <TextInput
            label="Period End (YYYY-MM-DD)"
            name="currentPeriodEnd"
            value={currentPeriodEnd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCurrentPeriodEnd(e.target.value)
            }
            placeholder="2025-12-31"
          />
        </Box>

        <Box paddingBottom={4} style={{ maxWidth: '400px' }}>
          <TextInput
            label="Note (optional)"
            name="note"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
            placeholder="Reason for manual change…"
          />
        </Box>

        {saveError && (
          <Box paddingBottom={3}>
            <Typography textColor="danger600">Error: {saveError}</Typography>
          </Box>
        )}
        {saveSuccess && (
          <Box paddingBottom={3}>
            <Typography textColor="success600">Saved successfully.</Typography>
          </Box>
        )}

        <Box style={{ display: 'flex', gap: '12px' }}>
          <Button onClick={handleSave} loading={saving}>
            Save Subscription
          </Button>
          {user.subscription && user.subscription.status !== 'cancelled' && (
            <Button variant="danger" onClick={handleCancel} loading={saving}>
              Cancel Subscription
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
