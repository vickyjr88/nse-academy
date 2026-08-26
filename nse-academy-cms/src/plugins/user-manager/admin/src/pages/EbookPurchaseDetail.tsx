import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface EbookPurchase {
  id: string;
  productId: string;
  email: string;
  reference: string;
  amountKes: number;
  guestToken: string;
  downloadCount: number;
  downloadedAt: string | null;
  emailedAt: string | null;
  purchasedAt: string;
  user: { id: string; name: string; email: string } | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box paddingTop={2}>
      <Typography variant="pi" fontWeight="bold">{label}:</Typography> <Typography>{value}</Typography>
    </Box>
  );
}

export function EbookPurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<EbookPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/ebook-purchases/${id}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setPurchase(await res.json());
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
        <Loader>Loading purchase…</Loader>
      </Box>
    );
  }

  if (error || !purchase) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load purchase: {error}</Typography>
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
        <Typography variant="alpha">{purchase.productId}</Typography>
      </Box>

      <Flex gap={4}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Buyer</Typography>
          <Field label="Name" value={purchase.user?.name ?? '—'} />
          <Field label="Email" value={purchase.email} />
          <Field label="Account" value={purchase.user ? 'Registered user' : 'Guest checkout'} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Purchase</Typography>
          <Field label="Amount" value={`KES ${purchase.amountKes.toLocaleString()}`} />
          <Field label="Reference" value={purchase.reference} />
          <Field label="Purchased At" value={new Date(purchase.purchasedAt).toLocaleString()} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Delivery</Typography>
          <Field label="Downloads" value={purchase.downloadCount} />
          <Field
            label="Last Downloaded"
            value={purchase.downloadedAt ? new Date(purchase.downloadedAt).toLocaleString() : 'Never'}
          />
          <Field
            label="Emailed"
            value={purchase.emailedAt ? new Date(purchase.emailedAt).toLocaleString() : 'Not yet'}
          />
        </Box>
      </Flex>
    </Box>
  );
}
