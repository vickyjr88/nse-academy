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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
} from '@strapi/design-system';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

interface EbookPurchase {
  id: string;
  productId: string;
  amountKes: number;
  purchasedAt: string;
  downloadCount: number;
}

interface OrganizationSummary {
  id: string;
  name: string;
  role: string;
  inviteAccepted: boolean;
  joinedAt: string;
}

interface ReferredBy {
  id: string;
  name: string;
  email: string;
}

interface HoldingRow {
  ticker: string;
  companyName: string | null;
  quantity: number;
  avgCost: number | null;
  costBasisKes: number | null;
  currentPrice: number | null;
  marketValueKes: number | null;
  unrealizedGainKes: number | null;
}

interface Portfolio {
  totalMarketValueKes: number;
  totalCostBasisKes: number;
  totalUnrealizedGainKes: number;
  holdingsCount: number;
  holdings: HoldingRow[];
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  investorProfile: InvestorProfile | null;
  subscription: Subscription | null;
  ebookPurchases: EbookPurchase[];
  organization: OrganizationSummary | null;
  referredBy: ReferredBy | null;
  referralsMadeCount: number;
  lessonsCompleted: number;
  portfolio: Portfolio;
  totalRealizedGainKes: number;
  totalDividendsKes: number;
  notificationsUnread: number;
  priceAlertsActive: number;
}

const CHART_COLORS = ['#4945FF', '#7B79FF', '#66B7F1', '#0C75AF', '#AC73E5', '#5CB176', '#EE5E52', '#FF8F5C'];

function kes(n: number | null | undefined): string {
  if (n == null) return '—';
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const color = tone === 'positive' ? 'success600' : tone === 'negative' ? 'danger600' : 'neutral800';
  return (
    <Box
      padding={5}
      background="neutral0"
      borderColor="neutral200"
      hasRadius
      shadow="filterShadow"
      style={{ flex: 1, minWidth: '180px' }}
    >
      <Typography variant="sigma" textColor="neutral600">{label}</Typography>
      <Box paddingTop={2}>
        <Typography variant="alpha" textColor={color}>{value}</Typography>
      </Box>
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box paddingTop={7} paddingBottom={3}>
      <Typography variant="beta" textColor="neutral800">{children}</Typography>
    </Box>
  );
}

const TIER_BADGE: Record<string, string> = { free: 'neutral', intermediary: 'secondary', premium: 'success' };
const STATUS_BADGE: Record<string, string> = { active: 'success', cancelled: 'danger', past_due: 'warning' };

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

  const allocationData = user.portfolio.holdings
    .filter((h) => h.marketValueKes != null && h.marketValueKes > 0)
    .map((h) => ({ name: h.ticker, value: h.marketValueKes as number }));

  const gainTone = user.portfolio.totalUnrealizedGainKes > 0
    ? 'positive'
    : user.portfolio.totalUnrealizedGainKes < 0
      ? 'negative'
      : 'neutral';

  const realizedTone = user.totalRealizedGainKes > 0
    ? 'positive'
    : user.totalRealizedGainKes < 0
      ? 'negative'
      : 'neutral';

  return (
    <Box padding={8}>
      <Box paddingBottom={2} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button variant="tertiary" onClick={() => navigate('/plugins/user-manager')}>
          ← Back
        </Button>
      </Box>

      {/* Header */}
      <Box
        padding={6}
        background="neutral0"
        borderColor="neutral200"
        hasRadius
        shadow="filterShadow"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}
      >
        <Box>
          <Typography variant="alpha">{user.name}</Typography>
          <Box paddingTop={1}>
            <Typography textColor="neutral600">{user.email}{user.phone ? ` · ${user.phone}` : ''}</Typography>
          </Box>
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral500">
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
        <Box style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {user.subscription && (
            <Badge backgroundColor={`${TIER_BADGE[user.subscription.tier] || 'neutral'}100`} textColor={`${TIER_BADGE[user.subscription.tier] || 'neutral'}600`}>
              {user.subscription.tier.toUpperCase()}
            </Badge>
          )}
          {user.subscription && (
            <Badge backgroundColor={`${STATUS_BADGE[user.subscription.status] || 'neutral'}100`} textColor={`${STATUS_BADGE[user.subscription.status] || 'neutral'}600`}>
              {user.subscription.status.replace('_', ' ')}
            </Badge>
          )}
          {user.organization && (
            <Badge backgroundColor="primary100" textColor="primary600">
              {user.organization.name} · {user.organization.role}
            </Badge>
          )}
        </Box>
      </Box>

      {/* Key stats */}
      <Box paddingTop={6} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <StatCard label="Portfolio Value" value={kes(user.portfolio.totalMarketValueKes)} />
        <StatCard label="Unrealized Gain/Loss" value={kes(user.portfolio.totalUnrealizedGainKes)} tone={gainTone} />
        <StatCard label="Realized Gain/Loss" value={kes(user.totalRealizedGainKes)} tone={realizedTone} />
        <StatCard label="Dividends Received" value={kes(user.totalDividendsKes)} />
        <StatCard label="Lessons Completed" value={user.lessonsCompleted} />
        <StatCard label="Referrals Made" value={user.referralsMadeCount} />
      </Box>

      {/* Portfolio */}
      <SectionTitle>Portfolio</SectionTitle>
      {user.portfolio.holdingsCount === 0 ? (
        <Box padding={5} background="neutral0" hasRadius borderColor="neutral200" shadow="filterShadow">
          <Typography textColor="neutral600">No holdings recorded.</Typography>
        </Box>
      ) : (
        <Box style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Box
            padding={5}
            background="neutral0"
            borderColor="neutral200"
            hasRadius
            shadow="filterShadow"
            style={{ flex: '1 1 320px', minHeight: '280px' }}
          >
            <Typography variant="sigma" textColor="neutral600">Allocation by market value</Typography>
            <Box style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => kes(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          <Box style={{ flex: '2 1 480px' }}>
            <Table colCount={6} rowCount={user.portfolio.holdings.length}>
              <Thead>
                <Tr>
                  <Th><Typography variant="sigma">Ticker</Typography></Th>
                  <Th><Typography variant="sigma">Qty</Typography></Th>
                  <Th><Typography variant="sigma">Avg Cost</Typography></Th>
                  <Th><Typography variant="sigma">Market Value</Typography></Th>
                  <Th><Typography variant="sigma">Gain/Loss</Typography></Th>
                </Tr>
              </Thead>
              <Tbody>
                {user.portfolio.holdings.map((h) => (
                  <Tr key={h.ticker}>
                    <Td><Typography fontWeight="semiBold">{h.ticker}</Typography></Td>
                    <Td><Typography>{h.quantity.toLocaleString()}</Typography></Td>
                    <Td><Typography>{h.avgCost != null ? kes(h.avgCost) : '—'}</Typography></Td>
                    <Td><Typography>{kes(h.marketValueKes)}</Typography></Td>
                    <Td>
                      <Typography textColor={h.unrealizedGainKes != null && h.unrealizedGainKes < 0 ? 'danger600' : 'success600'}>
                        {kes(h.unrealizedGainKes)}
                      </Typography>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}

      {/* Investor Profile */}
      {user.investorProfile && (
        <>
          <SectionTitle>Investor Profile</SectionTitle>
          <Box style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <StatCard label="Type" value={user.investorProfile.type} />
            <StatCard label="Risk Score" value={`${user.investorProfile.riskScore} / 100`} />
            <StatCard label="Horizon" value={`${user.investorProfile.horizonYears} yrs`} />
            <StatCard label="Capital Range" value={user.investorProfile.capitalRange} />
          </Box>
        </>
      )}

      {/* Activity */}
      <SectionTitle>Activity & Engagement</SectionTitle>
      <Box style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <StatCard label="Ebooks Purchased" value={user.ebookPurchases.length} />
        <StatCard label="Unread Notifications" value={user.notificationsUnread} />
        <StatCard label="Active Price Alerts" value={user.priceAlertsActive} />
      </Box>

      {user.ebookPurchases.length > 0 && (
        <Box paddingTop={4}>
          <Table colCount={3} rowCount={user.ebookPurchases.length}>
            <Thead>
              <Tr>
                <Th><Typography variant="sigma">Product</Typography></Th>
                <Th><Typography variant="sigma">Amount</Typography></Th>
                <Th><Typography variant="sigma">Purchased</Typography></Th>
              </Tr>
            </Thead>
            <Tbody>
              {user.ebookPurchases.map((p) => (
                <Tr key={p.id}>
                  <Td><Typography>{p.productId}</Typography></Td>
                  <Td><Typography>{kes(p.amountKes)}</Typography></Td>
                  <Td><Typography>{new Date(p.purchasedAt).toLocaleDateString()}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Referral / Org context */}
      {(user.referredBy || user.organization) && (
        <>
          <SectionTitle>Relationships</SectionTitle>
          <Box style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {user.referredBy && (
              <Box padding={5} background="neutral0" borderColor="neutral200" hasRadius shadow="filterShadow" style={{ flex: 1, minWidth: '240px' }}>
                <Typography variant="sigma" textColor="neutral600">Referred by</Typography>
                <Box paddingTop={2}>
                  <Typography fontWeight="semiBold">{user.referredBy.name}</Typography>
                  <Typography variant="pi" textColor="neutral600">{user.referredBy.email}</Typography>
                </Box>
              </Box>
            )}
            {user.organization && (
              <Box padding={5} background="neutral0" borderColor="neutral200" hasRadius shadow="filterShadow" style={{ flex: 1, minWidth: '240px' }}>
                <Typography variant="sigma" textColor="neutral600">Organization</Typography>
                <Box paddingTop={2}>
                  <Typography fontWeight="semiBold">{user.organization.name}</Typography>
                  <Typography variant="pi" textColor="neutral600">
                    {user.organization.role} · {user.organization.inviteAccepted ? 'active member' : 'invite pending'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* Subscription Management */}
      <SectionTitle>Manage Subscription</SectionTitle>
      <Box
        padding={6}
        background="neutral0"
        borderColor="neutral200"
        hasRadius
        shadow="filterShadow"
        style={{ maxWidth: '480px' }}
      >
        <Box paddingBottom={4}>
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

        <Box paddingBottom={4}>
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

        <Box paddingBottom={4}>
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

        <Box paddingBottom={4}>
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
