import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Textarea,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

type Tier = 'free' | 'intermediary' | 'premium' | '';

interface Campaign {
  id: string;
  subject: string;
  tier: string | null;
  audienceCount: number;
  failedCount: number;
  createdAt: string;
}

export function ComposeEmail() {
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [tier, setTier] = useState<Tier>('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    campaignId: number;
    audienceCount: number;
    failedCount: number;
    failedEmails: string[];
  } | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  async function fetchCampaigns() {
    try {
      const res = await fetch(`${NSE_API_URL}/admin/broadcast/campaigns?limit=20`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCampaigns(data.data);
    } catch {
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    setAudienceLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (tier) params.append('tier', tier);
        const res = await fetch(`${NSE_API_URL}/admin/broadcast/audience?${params.toString()}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAudienceCount(data.count);
      } catch {
        setAudienceCount(null);
      } finally {
        setAudienceLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tier]);

  // Any change to the message invalidates a previous confirmation, so a
  // stale checkbox can't carry over into an edited message.
  useEffect(() => {
    setConfirmed(false);
    setSuccess(null);
  }, [subject, htmlContent, tier]);

  const canSend =
    subject.trim().length > 0 &&
    htmlContent.trim().length >= 10 &&
    confirmed &&
    !sending &&
    (audienceCount ?? 0) > 0;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/broadcast/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': NSE_ADMIN_KEY },
        body: JSON.stringify({ subject, htmlContent, tier: tier || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setSuccess(data);
      setConfirmed(false);
      fetchCampaigns();
    } catch (e: any) {
      setError(e.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  }

  return (
    <Box padding={8} style={{ maxWidth: '760px' }}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Compose Email</Typography>
        <Box paddingTop={2}>
          <Typography textColor="neutral600">
            Send an announcement to all users, or filter by subscription tier. This goes out
            immediately as a real Brevo campaign to real users - there is no undo.
          </Typography>
        </Box>
      </Box>

      {success && (
        <Box paddingBottom={4}>
          <Alert
            closeLabel="Close"
            title="Sent"
            variant={success.failedCount > 0 ? 'warning' : 'success'}
            onClose={() => setSuccess(null)}
          >
            Campaign #{success.campaignId} sent to {success.audienceCount.toLocaleString()} users.
            {success.failedCount > 0 && (
              <>
                {' '}
                {success.failedCount.toLocaleString()} user{success.failedCount === 1 ? '' : 's'} could not
                be synced to Brevo and did NOT receive this email:
                <Box
                  paddingTop={2}
                  style={{ maxHeight: '160px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}
                >
                  {success.failedEmails.map((email) => (
                    <div key={email}>{email}</div>
                  ))}
                </Box>
              </>
            )}
          </Alert>
        </Box>
      )}

      {error && (
        <Box paddingBottom={4}>
          <Alert closeLabel="Close" title="Failed to send" variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <Flex direction="column" alignItems="stretch" gap={4}>
        <TextInput
          label="Subject"
          name="subject"
          placeholder="New: Trade Journal, Price Alerts & Dividend Tracking"
          value={subject}
          onChange={(e: any) => setSubject(e.target.value)}
        />

        <Textarea
          label="Message (HTML)"
          name="htmlContent"
          placeholder="<p>We just shipped a trade journal...</p>"
          value={htmlContent}
          onChange={(e: any) => setHtmlContent(e.target.value)}
          style={{ minHeight: '260px', fontFamily: 'monospace' }}
        />

        <Box style={{ width: '260px' }}>
          <SingleSelect
            label="Audience"
            placeholder="All users"
            value={tier}
            onChange={(v: string) => setTier(v as Tier)}
            onClear={() => setTier('')}
          >
            <SingleSelectOption value="free">Free tier only</SingleSelectOption>
            <SingleSelectOption value="intermediary">Intermediary tier only</SingleSelectOption>
            <SingleSelectOption value="premium">Premium tier only</SingleSelectOption>
          </SingleSelect>
        </Box>

        <Typography variant="pi" textColor="neutral600">
          {audienceLoading
            ? 'Calculating audience...'
            : audienceCount != null
              ? `This will reach ${audienceCount.toLocaleString()} user${audienceCount === 1 ? '' : 's'}.`
              : 'Could not load audience count.'}
        </Typography>

        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked: boolean) => setConfirmed(checked)}
          disabled={!subject.trim() || htmlContent.trim().length < 10}
        >
          I understand this sends immediately to {audienceCount ?? 0} real users and cannot be undone.
        </Checkbox>

        <Box>
          <Button onClick={handleSend} disabled={!canSend} loading={sending}>
            Send Announcement
          </Button>
        </Box>
      </Flex>

      <Box paddingTop={8}>
        <Divider />
      </Box>

      <Box paddingTop={8} paddingBottom={4}>
        <Typography variant="beta">Past Campaigns</Typography>
      </Box>

      {campaignsLoading ? (
        <Box style={{ display: 'flex', justifyContent: 'center' }} padding={4}>
          <Loader>Loading campaign history…</Loader>
        </Box>
      ) : campaigns.length === 0 ? (
        <Typography textColor="neutral600">No campaigns sent yet.</Typography>
      ) : (
        <Table colCount={4} rowCount={campaigns.length}>
          <Thead>
            <Tr>
              <Th><Typography variant="sigma">Subject</Typography></Th>
              <Th><Typography variant="sigma">Audience</Typography></Th>
              <Th><Typography variant="sigma">Reached</Typography></Th>
              <Th><Typography variant="sigma">Sent</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>
            {campaigns.map((c) => (
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
  );
}
