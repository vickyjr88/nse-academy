'use client';

import Link from 'next/link';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

interface InvestorCardProps {
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  conservative: {
    label: 'Conservative Investor',
    color: '#16a34a',
    badgeClass: 'bg-green-100 text-green-800',
  },
  moderate: {
    label: 'Moderate Investor',
    color: '#2563eb',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  aggressive: {
    label: 'Aggressive Investor',
    color: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-800',
  },
  growth: {
    label: 'Growth Investor',
    color: '#7c3aed',
    badgeClass: 'bg-purple-100 text-purple-800',
  },
  dividend: {
    label: 'Dividend Seeker',
    color: '#ca8a04',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
};

function computeRadarData(riskScore: number) {
  return [
    { subject: 'Safety', value: Math.round(100 - riskScore) },
    { subject: 'Income', value: Math.max(10, Math.round(80 - riskScore * 0.6)) },
    { subject: 'Growth', value: riskScore },
    { subject: 'Liquidity', value: Math.min(100, Math.round(50 + riskScore * 0.2)) },
    { subject: 'Experience', value: Math.round(riskScore * 0.9) },
  ];
}

export default function InvestorCard({ type, riskScore, horizonYears, capitalRange }: InvestorCardProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.moderate;
  const radarData = computeRadarData(riskScore);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">Your investor type</p>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${config.badgeClass}`}
          >
            {config.label}
          </span>
        </div>
        <div className="text-right text-sm text-gray-500 space-y-0.5">
          <div>
            Risk score:{' '}
            <strong className="text-gray-800">{riskScore}/100</strong>
          </div>
          <div>
            Horizon:{' '}
            <strong className="text-gray-800">
              {horizonYears} yr{horizonYears !== 1 ? 's' : ''}
            </strong>
          </div>
          <div>
            Capital: <strong className="text-gray-800">{capitalRange}</strong>
          </div>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Profile"
              dataKey="value"
              stroke={config.color}
              fill={config.color}
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          href="/learn"
          className="flex-1 text-center bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
        >
          Start Learning →
        </Link>
        <Link
          href="/stocks"
          className="flex-1 text-center border border-emerald-700 text-emerald-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
        >
          See your stock picks →
        </Link>
      </div>
    </div>
  );
}
