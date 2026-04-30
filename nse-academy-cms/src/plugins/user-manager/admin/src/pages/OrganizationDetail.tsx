import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
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
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface Organization {
  id: string;
  name: string;
  type: string;
  email: string;
  licenseKey: string;
  createdAt: string;
  license?: {
    tier: string;
    seats: number;
    seatsUsed: number;
    status: string;
    currentPeriodEnd: string;
  };
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

  useEffect(() => {
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
    fetchOrg();
  }, [id]);

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
          <Typography variant="beta">Corporate License</Typography>
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
            </>
          ) : (
            <Box paddingTop={2}>
              <Typography textColor="neutral600">No active license found.</Typography>
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
