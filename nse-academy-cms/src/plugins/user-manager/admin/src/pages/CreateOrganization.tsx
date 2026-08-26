import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Flex,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function CreateOrganization() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [orgEmail, setOrgEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [seats, setSeats] = useState('');
  const [amountKes, setAmountKes] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [offlineReference, setOfflineReference] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; name: string } | null>(null);

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [pickedExisting, setPickedExisting] = useState(false);
  const adminEmailFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pickedExisting || adminEmail.trim().length < 2) {
      setUserOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', limit: '8', search: adminEmail.trim() });
        const res = await fetch(`${NSE_API_URL}/admin/users?${params.toString()}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) return;
        const json = await res.json();
        setUserOptions(json.data || []);
        setShowOptions(true);
      } catch {
        // Autocomplete is a convenience - silently skip on failure, the
        // admin can still type a fresh email to create a new account.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [adminEmail, pickedExisting]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (adminEmailFieldRef.current && !adminEmailFieldRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectExistingUser(user: UserOption) {
    setAdminEmail(user.email);
    setAdminName(user.name);
    setPickedExisting(true);
    setShowOptions(false);
  }

  const canSubmit =
    name.trim().length > 0 &&
    orgEmail.trim().length > 0 &&
    adminName.trim().length > 0 &&
    adminEmail.trim().length > 0 &&
    Number(seats) > 0 &&
    Number(amountKes) >= 0 &&
    currentPeriodEnd.length > 0 &&
    !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': NSE_ADMIN_KEY },
        body: JSON.stringify({
          name,
          type,
          orgEmail,
          adminName,
          adminEmail,
          license: {
            seats: Number(seats),
            amountKes: Number(amountKes),
            currentPeriodEnd: new Date(currentPeriodEnd).toISOString(),
            paymentMethod: 'offline',
            offlineReference: offlineReference || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setSuccess({ id: data.id, name: data.name });
    } catch (e: any) {
      setError(e.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box padding={8} style={{ maxWidth: '640px' }}>
      <Box paddingBottom={4}>
        <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>

      <Box paddingBottom={4}>
        <Typography variant="alpha">Create Organization</Typography>
        <Box paddingTop={2}>
          <Typography textColor="neutral600">
            Set up a corporate/SACCO organization for a client paying offline (bank transfer or
            invoice) with any number of seats. If the admin email doesn't match an existing
            account, a new one is created and sent a password-setup email.
          </Typography>
        </Box>
      </Box>

      {success && (
        <Box paddingBottom={4}>
          <Alert closeLabel="Close" title="Organization created" variant="success" onClose={() => setSuccess(null)}>
            {success.name} was created.{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/plugins/user-manager/organizations/${success.id}`); }}>
              View organization
            </a>
          </Alert>
        </Box>
      )}

      {error && (
        <Box paddingBottom={4}>
          <Alert closeLabel="Close" title="Failed to create organization" variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <Flex direction="column" alignItems="stretch" gap={4}>
        <Typography variant="beta">Organization</Typography>

        <TextInput
          label="Organization name"
          name="name"
          placeholder="Acme Sacco"
          value={name}
          onChange={(e: any) => setName(e.target.value)}
        />

        <Box style={{ width: '260px' }}>
          <SingleSelect label="Type" value={type} onChange={(v: string) => setType(v)}>
            <SingleSelectOption value="company">Company</SingleSelectOption>
            <SingleSelectOption value="school">School / University</SingleSelectOption>
          </SingleSelect>
        </Box>

        <TextInput
          label="Organization contact email"
          name="orgEmail"
          placeholder="contact@acmesacco.com"
          value={orgEmail}
          onChange={(e: any) => setOrgEmail(e.target.value)}
        />

        <Typography variant="beta">Org admin</Typography>

        <TextInput
          label="Admin name"
          name="adminName"
          placeholder="Jane Wanjiru"
          value={adminName}
          onChange={(e: any) => setAdminName(e.target.value)}
        />

        <Box ref={adminEmailFieldRef} style={{ position: 'relative' }}>
          <TextInput
            label="Admin email"
            hint={pickedExisting ? 'Existing user selected' : 'Start typing to search existing users, or enter a new email'}
            name="adminEmail"
            placeholder="jane@acmesacco.com"
            value={adminEmail}
            onFocus={() => userOptions.length > 0 && setShowOptions(true)}
            onChange={(e: any) => {
              setAdminEmail(e.target.value);
              setPickedExisting(false);
            }}
          />
          {showOptions && userOptions.length > 0 && (
            <Box
              background="neutral0"
              shadow="tableShadow"
              hasRadius
              padding={1}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 4,
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {userOptions.map((u) => (
                <Box
                  key={u.id}
                  padding={2}
                  hasRadius
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectExistingUser(u)}
                >
                  <Typography fontWeight="semiBold">{u.name}</Typography>
                  <Typography variant="pi" textColor="neutral600">{u.email}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Typography variant="beta">License</Typography>

        <Flex gap={4}>
          <Box style={{ flex: 1 }}>
            <TextInput
              label="Seats"
              name="seats"
              type="number"
              placeholder="37"
              value={seats}
              onChange={(e: any) => setSeats(e.target.value)}
            />
          </Box>
          <Box style={{ flex: 1 }}>
            <TextInput
              label="Amount (KES)"
              name="amountKes"
              type="number"
              placeholder="42000"
              value={amountKes}
              onChange={(e: any) => setAmountKes(e.target.value)}
            />
          </Box>
        </Flex>

        <TextInput
          label="License valid until"
          name="currentPeriodEnd"
          type="date"
          value={currentPeriodEnd}
          onChange={(e: any) => setCurrentPeriodEnd(e.target.value)}
        />

        <TextInput
          label="Bank transfer ref / invoice number"
          name="offlineReference"
          placeholder="INV-2026-0042"
          value={offlineReference}
          onChange={(e: any) => setOfflineReference(e.target.value)}
        />

        <Box>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
            Create Organization
          </Button>
        </Box>
      </Flex>
    </Box>
  );
}
