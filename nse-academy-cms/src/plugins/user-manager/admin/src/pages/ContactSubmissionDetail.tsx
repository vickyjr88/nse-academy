import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex, Badge } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = { new: 'danger', read: 'warning', replied: 'success' };

export function ContactSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<ContactSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function fetchSubmission() {
    try {
      const res = await fetch(`${NSE_API_URL}/admin/contact-submissions/${id}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmission(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  async function handleStatusAction(action: 'read' | 'replied') {
    setActing(true);
    try {
      const res = await fetch(`${NSE_API_URL}/contact/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSubmission();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading submission…</Loader>
      </Box>
    );
  }

  if (error || !submission) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load submission: {error}</Typography>
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
        <Typography variant="alpha">{submission.subject}</Typography>
        <Badge backgroundColor={`${STATUS_BADGE[submission.status] || 'neutral'}100`} textColor={`${STATUS_BADGE[submission.status] || 'neutral'}600`}>
          {submission.status}
        </Badge>
      </Flex>

      <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ maxWidth: '640px' }}>
        <Box paddingBottom={2}>
          <Typography variant="pi" fontWeight="bold">From:</Typography>{' '}
          <Typography>{submission.name} ({submission.email})</Typography>
        </Box>
        <Box paddingBottom={2}>
          <Typography variant="pi" fontWeight="bold">Received:</Typography>{' '}
          <Typography>{new Date(submission.createdAt).toLocaleString()}</Typography>
        </Box>
        <Box paddingTop={4}>
          <Typography variant="pi" fontWeight="bold">Message:</Typography>
          <Box paddingTop={2}>
            <Typography style={{ whiteSpace: 'pre-wrap' }}>{submission.message}</Typography>
          </Box>
        </Box>
      </Box>

      <Flex gap={2} paddingTop={4}>
        {submission.status === 'new' && (
          <Button size="S" onClick={() => handleStatusAction('read')} loading={acting}>
            Mark as read
          </Button>
        )}
        {submission.status !== 'replied' && (
          <Button size="S" variant="success" onClick={() => handleStatusAction('replied')} loading={acting}>
            Mark as replied
          </Button>
        )}
      </Flex>
    </Box>
  );
}
