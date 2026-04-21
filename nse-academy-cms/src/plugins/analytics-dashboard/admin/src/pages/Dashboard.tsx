import React, { useEffect, useState } from 'react';
import {
  Box,
  Loader,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
} from '@strapi/design-system';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface TierBreakdown {
  free: number;
  intermediary: number;
  premium: number;
}

interface Overview {
  totalUsers: number;
  newUsersThisMonth: number;
  newUsersLastMonth: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  tierBreakdown: TierBreakdown;
  estimatedMRR: number;
}

interface MonthCount {
  month: string;
  count: number;
}

interface MonthTrend {
  month: string;
  active: number;
  cancelled: number;
}

interface LessonProgress {
  totalCompletions: number;
  uniqueLearners: number;
  topLessons: Array<{ lessonId: string; completions: number }>;
}

interface Referrals {
  total: number;
  completed: number;
  pending: number;
  conversionRate: number;
  topReferrers: Array<{ userId: string; name: string; email: string; referralCount: number }>;
}

interface InvestorProfiles {
  total: number;
  byType: Record<string, number>;
  byCapitalRange: Record<string, number>;
  avgRiskScore: number;
}

interface GoogleAnalytics {
  totalActiveUsers: number;
  totalPageViews: number;
  avgBounceRate: number;
  dailyStats: Array<{ date: string; users: number; views: number }>;
}

interface AnalyticsData {
  overview: Overview;
  userGrowth: MonthCount[];
  subscriptionTrend: MonthTrend[];
  lessonProgress: LessonProgress;
  referrals: Referrals;
  investorProfiles: InvestorProfiles;
  googleAnalytics: GoogleAnalytics | null; // Added GA
}

const COLORS = ['#4945FF', '#7B79FF', '#66B7F1', '#0C75AF', '#AC73E5'];
const BAR_COLORS = { active: '#5CB176', cancelled: '#EE5E52' };

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      padding={5}
      background="neutral0"
      borderColor="neutral200"
      hasRadius
      shadow="filterShadow"
      style={{ flex: 1, minWidth: '160px' }}
    >
      <Typography variant="sigma" textColor="neutral600">{label}</Typography>
      <Box paddingTop={2}>
        <Typography variant="alpha" textColor="neutral800">{value}</Typography>
      </Box>
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box paddingTop={6} paddingBottom={3}>
      <Typography variant="beta" textColor="neutral800">{children}</Typography>
    </Box>
  );
}

export function Dashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleSyncMarketData = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${NSE_API_URL}/market-data/sync`, {
        method: 'POST',
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      const data = await res.json();
      if (res.ok) {
        alert('Sync triggered successfully! ' + data.message);
      } else {
        alert('Failed to trigger sync: ' + (data.message || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error triggering sync: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Fetch API analytics
        const res = await fetch(`${NSE_API_URL}/admin/analytics`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const analyticsJson: AnalyticsData = await res.json();
        setData(analyticsJson);

        // Fetch Lesson titles from local Strapi
        try {
          // In Strapi 5, we can use the relative /api/lessons (if we have permissions)
          // or we can just fetch all lessons once to map titles.
          const lessonRes = await fetch('/api/lessons?pagination[limit]=100');
          if (lessonRes.ok) {
            const lessonJson = await lessonRes.json();
            const titles: Record<string, string> = {};
            lessonJson.data.forEach((l: any) => {
              titles[l.documentId || l.id] = l.title || l.attributes?.title || 'Unknown Lesson';
            });
            setLessonTitles(titles);
          }
        } catch (e) {
          console.error('Failed to fetch lesson titles:', e);
        }

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading analytics…</Loader>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load analytics: {error}</Typography>
      </Box>
    );
  }

  const { overview, userGrowth, subscriptionTrend, lessonProgress, referrals, investorProfiles, googleAnalytics } = data;

  const tierPieData = [
    { name: 'Free', value: overview.tierBreakdown.free },
    { name: 'Intermediary', value: overview.tierBreakdown.intermediary },
    { name: 'Premium', value: overview.tierBreakdown.premium },
  ];

  const profileTypeBarData = Object.entries(investorProfiles.byType).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
  }));

  const capitalRangePieData = Object.entries(investorProfiles.byCapitalRange).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <Box padding={8}>
      <Box paddingBottom={6} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="alpha">Analytics Dashboard</Typography>
        <Button 
          variant="secondary" 
          loading={syncing} 
          onClick={handleSyncMarketData}
        >
          🔄 Sync Market Data
        </Button>
      </Box>

      {/* Overview Cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <StatCard label="Total Users" value={overview.totalUsers.toLocaleString()} />
        <StatCard label="New This Month" value={overview.newUsersThisMonth.toLocaleString()} />
        <StatCard label="Active Subscriptions" value={overview.activeSubscriptions.toLocaleString()} />
        <StatCard label="Est. MRR (KSh)" value={`KSh ${overview.estimatedMRR.toLocaleString()}`} />
      </div>

      {/* Google Analytics Section */}
      {googleAnalytics && (
        <>
          <SectionTitle>Web Traffic (Last 30 Days)</SectionTitle>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <StatCard label="Active Users (GA)" value={googleAnalytics.totalActiveUsers.toLocaleString()} />
            <StatCard label="Page Views (GA)" value={googleAnalytics.totalPageViews.toLocaleString()} />
            <StatCard label="Bounce Rate" value={`${googleAnalytics.avgBounceRate}%`} />
          </div>
          <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={googleAnalytics.dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#4945FF" name="Daily Users" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="views" stroke="#7B79FF" name="Daily Views" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}

      {/* User Growth Chart */}
      <SectionTitle>Platform Registration Growth</SectionTitle>
      <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={userGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#4945FF" strokeWidth={2} dot={{ r: 3 }} name="New Users" />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Tier Distribution + Subscription Trend side by side */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <SectionTitle>Tier Distribution</SectionTitle>
          <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={tierPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {tierPieData.map((_entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </div>

        <div style={{ flex: 2, minWidth: '320px' }}>
          <SectionTitle>Subscription Trend (Last 12 Months)</SectionTitle>
          <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={subscriptionTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" fill={BAR_COLORS.active} name="Active" />
                <Bar dataKey="cancelled" fill={BAR_COLORS.cancelled} name="Cancelled" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </div>
      </div>

      {/* Investor Profile Types + Capital Range side by side */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '320px' }}>
          <SectionTitle>Investor Profile Types</SectionTitle>
          <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={profileTypeBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F6F6F9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4945FF" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <SectionTitle>Capital Range Distribution</SectionTitle>
          <Box background="neutral0" padding={4} hasRadius shadow="filterShadow">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={capitalRangePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {capitalRangePieData.map((_entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </div>
      </div>

      {/* Top Lessons Table */}
      <SectionTitle>Top Lessons by Completions</SectionTitle>
      <Box background="neutral0" hasRadius shadow="filterShadow">
        <Table colCount={2} rowCount={lessonProgress.topLessons.length}>
          <Thead>
            <Tr>
              <Th><Typography variant="sigma">Lesson</Typography></Th>
              <Th><Typography variant="sigma">Completions</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>
            {lessonProgress.topLessons.length === 0 ? (
              <Tr>
                <Td colSpan={2}>
                  <Box padding={4}>
                    <Typography textColor="neutral600">No lesson completions yet.</Typography>
                  </Box>
                </Td>
              </Tr>
            ) : (
              lessonProgress.topLessons.map((lesson) => (
                <Tr key={lesson.lessonId}>
                  <Td>
                    <Typography fontWeight="bold">
                      {lessonTitles[lesson.lessonId] || `Lesson ID: ${lesson.lessonId}`}
                    </Typography>
                  </Td>
                  <Td><Typography>{lesson.completions.toLocaleString()}</Typography></Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      <Box paddingTop={2} paddingBottom={2}>
        <Typography textColor="neutral600" variant="pi">
          Total completions: {lessonProgress.totalCompletions.toLocaleString()} · Unique learners: {lessonProgress.uniqueLearners.toLocaleString()}
        </Typography>
      </Box>

      {/* Referrals */}
      <SectionTitle>Referrals</SectionTitle>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatCard label="Total Referrals" value={referrals.total} />
        <StatCard label="Completed" value={referrals.completed} />
        <StatCard label="Pending" value={referrals.pending} />
        <StatCard label="Conversion Rate" value={`${referrals.conversionRate}%`} />
      </div>

      <Box background="neutral0" hasRadius shadow="filterShadow">
        <Box padding={4} paddingBottom={2}>
          <Typography variant="delta">Top Referrers</Typography>
        </Box>
        <Table colCount={3} rowCount={referrals.topReferrers.length}>
          <Thead>
            <Tr>
              <Th><Typography variant="sigma">Name</Typography></Th>
              <Th><Typography variant="sigma">Email</Typography></Th>
              <Th><Typography variant="sigma">Referrals</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>
            {referrals.topReferrers.length === 0 ? (
              <Tr>
                <Td colSpan={3}>
                  <Box padding={4}>
                    <Typography textColor="neutral600">No referrals yet.</Typography>
                  </Box>
                </Td>
              </Tr>
            ) : (
              referrals.topReferrers.map((r) => (
                <Tr key={r.userId}>
                  <Td><Typography>{r.name}</Typography></Td>
                  <Td><Typography>{r.email}</Typography></Td>
                  <Td><Typography>{r.referralCount}</Typography></Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Investor Profile Avg Score */}
      <Box paddingTop={6} paddingBottom={2}>
        <Typography textColor="neutral600" variant="pi">
          Investor Profiles: {investorProfiles.total.toLocaleString()} total · Avg risk score: {investorProfiles.avgRiskScore}/100
        </Typography>
      </Box>
    </Box>
  );
}
