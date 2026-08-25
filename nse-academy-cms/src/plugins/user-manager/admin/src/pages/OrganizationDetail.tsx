import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Loader,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Divider,
  SingleSelect,
  SingleSelectOption,
  TextInput,
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface License {
  tier: string;
  seats: number;
  seatsUsed: number;
  status: string;
  currentPeriodEnd: string;
  paymentMethod: string;
  paystackReference: string | null;
  offlineReference: string | null;
  amountKes: number;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  email: string;
  licenseKey: string;
  createdAt: string;
  license?: License;
  members: Array<{
    id: string;
    role: string;
    inviteAccepted: boolean;
    joinedAt: string;
    user: {
      name: string;
      email: string;
    };
  }>;
}

export function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingLicense, setEditingLicense] = useState(false);
  const [seats, setSeats] = useState('');
  const [amountKes, setAmountKes] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'offline' | 'paystack'>('offline');
  const [offlineReference, setOfflineReference] = useState('');
  const [status, setStatus] = useState('active');
  const [savingLicense, setSavingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  async function fetchOrg() {
    try {
      const res = await fetch(`${NSE_API_URL}/admin/organizations/${id}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrg(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrg();
  }, [id]);

  function openEditLicense() {
    const license = org?.license;
    setSeats(license ? String(license.seats) : '');
    setAmountKes(license ? String(license.amountKes) : '');
    setCurrentPeriodEnd(license ? license.currentPeriodEnd.slice(0, 10) : '');
    setPaymentMethod((license?.paymentMethod as 'offline' | 'paystack') || 'offline');
    setOfflineReference(license?.offlineReference || '');
    setStatus(license?.status || 'active');
    setLicenseError(null);
    setEditingLicense(true);
  }

  async function handleSaveLicense() {
    setSavingLicense(true);
    setLicenseError(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/organizations/${id}/license`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': NSE_ADMIN_KEY },
        body: JSON.stringify({
          seats: Number(seats),
          amountKes: Number(amountKes),
          currentPeriodEnd: new Date(currentPeriodEnd).toISOString(),
          paymentMethod,
          offlineReference: paymentMethod === 'offline' ? offlineReference || undefined : undefined,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      await fetchOrg();
      setEditingLicense(false);
    } catch (e: any) {
      setLicenseError(e.message || 'Failed to update license');
    } finally {
      setSavingLicense(false);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading organization…</Loader>
      </Box>
    );
  }

  if (error || !org) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load organization: {error}</Typography>
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
        <Typography variant="alpha">{org.name}</Typography>
      </Box>

      <Flex gap={4} paddingBottom={8}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Details</Typography>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Type:</Typography> <Typography>{org.type}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Email:</Typography> <Typography>{org.email}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">License Key:</Typography> <Typography>{org.licenseKey}</Typography>
          </Box>
          <Box paddingTop={2}>
            <Typography variant="pi" fontWeight="bold">Created At:</Typography> <Typography>{new Date(org.createdAt).toLocaleDateString()}</Typography>
          </Box>
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Flex justifyContent="space-between" alignItems="center">
            <Typography variant="beta">Corporate License</Typography>
            <Button size="S" variant="secondary" onClick={openEditLicense}>
              {org.license ? 'Edit License' : 'Add License'}
            </Button>
          </Flex>
          {org.license ? (
            <>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Tier:</Typography> <Typography>{org.license.tier}</Typography>
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Status:</Typography> <Typography>{org.license.status}</Typography>
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Seats:</Typography> <Typography>{org.license.seatsUsed} / {org.license.seats}</Typography>
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Valid Until:</Typography> <Typography>{new Date(org.license.currentPeriodEnd).toLocaleDateString()}</Typography>
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Payment:</Typography>{' '}
                <Typography>
                  {org.license.paymentMethod === 'offline'
                    ? `Offline${org.license.offlineReference ? ` (${org.license.offlineReference})` : ''}`
                    : `Paystack${org.license.paystackReference ? ` (${org.license.paystackReference})` : ''}`}
                </Typography>
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" fontWeight="bold">Amount:</Typography> <Typography>KES {org.license.amountKes.toLocaleString()}</Typography>
              </Box>
            </>
          ) : (
            <Box paddingTop={2}>
              <Typography textColor="neutral600">No active license found.</Typography>
            </Box>
          )}

          {editingLicense && (
            <Box paddingTop={4}>
              <Divider />
              <Box paddingTop={4}>
                {licenseError && (
                  <Box paddingBottom={4}>
                    <Alert closeLabel="Close" title="Failed to save" variant="danger" onClose={() => setLicenseError(null)}>
                      {licenseError}
                    </Alert>
                  </Box>
                )}
                <Flex direction="column" alignItems="stretch" gap={3}>
                  <Flex gap={3}>
                    <Box style={{ flex: 1 }}>
                      <TextInput
                        label="Seats"
                        name="editSeats"
                        type="number"
                        value={seats}
                        onChange={(e: any) => setSeats(e.target.value)}
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <TextInput
                        label="Amount (KES)"
                        name="editAmountKes"
                        type="number"
                        value={amountKes}
                        onChange={(e: any) => setAmountKes(e.target.value)}
                      />
                    </Box>
                  </Flex>

                  <TextInput
                    label="Valid until"
                    name="editCurrentPeriodEnd"
                    type="date"
                    value={currentPeriodEnd}
                    onChange={(e: any) => setCurrentPeriodEnd(e.target.value)}
                  />

                  <SingleSelect
                    label="Payment method"
                    value={paymentMethod}
                    onChange={(v: string) => setPaymentMethod(v as 'offline' | 'paystack')}
                  >
                    <SingleSelectOption value="offline">Offline (bank transfer / invoice)</SingleSelectOption>
                    <SingleSelectOption value="paystack">Paystack</SingleSelectOption>
                  </SingleSelect>

                  {paymentMethod === 'offline' && (
                    <TextInput
                      label="Bank transfer ref / invoice number"
                      name="editOfflineReference"
                      value={offlineReference}
                      onChange={(e: any) => setOfflineReference(e.target.value)}
                    />
                  )}

                  <SingleSelect label="Status" value={status} onChange={(v: string) => setStatus(v)}>
                    <SingleSelectOption value="active">Active</SingleSelectOption>
                    <SingleSelectOption value="past_due">Past due</SingleSelectOption>
                    <SingleSelectOption value="cancelled">Cancelled</SingleSelectOption>
                  </SingleSelect>

                  <Flex gap={2}>
                    <Button
                      onClick={handleSaveLicense}
                      loading={savingLicense}
                      disabled={!seats || !amountKes || !currentPeriodEnd}
                    >
                      Save License
                    </Button>
                    <Button variant="tertiary" onClick={() => setEditingLicense(false)}>
                      Cancel
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Box>
          )}
        </Box>
      </Flex>

      <Divider />

      <Box paddingTop={8} paddingBottom={4}>
        <Typography variant="beta">Members ({org.members.length})</Typography>
      </Box>

      <Table colCount={5} rowCount={org.members.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Role</Typography></Th>
            <Th><Typography variant="sigma">Accepted Invite</Typography></Th>
            <Th><Typography variant="sigma">Joined At</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {org.members.map((member) => (
            <Tr key={member.id}>
              <Td><Typography>{member.user?.name}</Typography></Td>
              <Td><Typography>{member.user?.email}</Typography></Td>
              <Td><Typography>{member.role}</Typography></Td>
              <Td>
                <Typography textColor={member.inviteAccepted ? 'success600' : 'warning600'}>
                  {member.inviteAccepted ? 'Yes' : 'Pending'}
                </Typography>
              </Td>
              <Td><Typography>{new Date(member.joinedAt).toLocaleDateString()}</Typography></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
