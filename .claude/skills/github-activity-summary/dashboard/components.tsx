'use client';

import React from 'react';
import {
  BarChart as RechartsBar,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Color palette
const COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  gray: '#6b7280',
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

// Icons
const Icons = {
  commit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
      <path strokeWidth="2" d="M12 3v6m0 6v6" />
    </svg>
  ),
  'pr-merged': () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M7 7v10m10-4v4m-10-8a2 2 0 100-4 2 2 0 000 4zm0 10a2 2 0 100 4 2 2 0 000-4zm10 4a2 2 0 100-4 2 2 0 000 4z" />
      <path strokeWidth="2" d="M7 9c0 4 10 4 10 8" />
    </svg>
  ),
  'pr-open': () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M7 7v10m10-10v10M7 5a2 2 0 100-4 2 2 0 000 4zm0 14a2 2 0 100 4 2 2 0 000-4zm10-14a2 2 0 100-4 2 2 0 000 4zm0 14a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  ),
  user: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  repo: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  warning: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

// Dashboard wrapper
export function Dashboard({ title, period, generated, children }: {
  title: string;
  period: string;
  generated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="text-gray-400 mt-1">{period}</p>
        {generated && <p className="text-gray-500 text-sm mt-1">Generated: {generated}</p>}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

// Grid layout
export function Grid({ columns = 4, gap = 4, children }: {
  columns?: number;
  gap?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap * 0.25}rem`,
      }}
    >
      {children}
    </div>
  );
}

// Section
export function Section({ title, collapsible = false, children }: {
  title: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h2
        className={`text-lg font-semibold text-white mb-4 ${collapsible ? 'cursor-pointer flex items-center gap-2' : ''}`}
        onClick={() => collapsible && setOpen(!open)}
      >
        {collapsible && <span className="text-gray-500">{open ? '▼' : '▶'}</span>}
        {title}
      </h2>
      {open && <div>{children}</div>}
    </div>
  );
}

// Metric Card
export function MetricCard({ label, value, trend, trendValue, icon, color = 'blue' }: {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  icon: keyof typeof Icons;
  color?: keyof typeof COLORS;
}) {
  const Icon = Icons[icon] || Icons.commit;
  const trendColors = { up: 'text-green-400', down: 'text-red-400', flat: 'text-gray-400' };
  const trendArrows = { up: '↑', down: '↓', flat: '→' };

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${COLORS[color]}20`, color: COLORS[color] }}>
        <Icon />
      </div>
      <div className="flex-1">
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        {trend && (
          <p className={`text-sm ${trendColors[trend]}`}>
            {trendArrows[trend]} {trendValue}
          </p>
        )}
      </div>
    </div>
  );
}

// Contributor Card
export function ContributorCard({ name, username, commits, prsMerged, prsOpen, topRepos }: {
  name: string;
  username?: string;
  commits: number;
  prsMerged: number;
  prsOpen: number;
  topRepos?: string[];
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-white">{name}</p>
          {username && <p className="text-gray-400 text-sm">@{username}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-bold text-white">{commits}</p>
          <p className="text-xs text-gray-400">commits</p>
        </div>
        <div>
          <p className="text-xl font-bold text-green-400">{prsMerged}</p>
          <p className="text-xs text-gray-400">merged</p>
        </div>
        <div>
          <p className="text-xl font-bold text-orange-400">{prsOpen}</p>
          <p className="text-xs text-gray-400">open</p>
        </div>
      </div>
      {topRepos && topRepos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-500">Active in: {topRepos.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

// Contributor Table
export function ContributorTable({ contributors }: {
  contributors: Array<{
    name: string;
    username?: string;
    commits: number;
    prsMerged: number;
    prsOpen: number;
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
            <th className="pb-3">Contributor</th>
            <th className="pb-3 text-right">Commits</th>
            <th className="pb-3 text-right">PRs Merged</th>
            <th className="pb-3 text-right">PRs Open</th>
          </tr>
        </thead>
        <tbody>
          {contributors.map((c, i) => (
            <tr key={i} className="border-b border-gray-800">
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <span className="text-white">{c.name}</span>
                </div>
              </td>
              <td className="py-3 text-right text-white">{c.commits}</td>
              <td className="py-3 text-right text-green-400">{c.prsMerged}</td>
              <td className="py-3 text-right text-orange-400">{c.prsOpen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Repo Card
export function RepoCard({ name, platform, commits, prsMerged, prsOpen, status = 'active' }: {
  name: string;
  platform: 'github' | 'ado';
  commits: number;
  prsMerged: number;
  prsOpen: number;
  status?: 'active' | 'low' | 'inactive';
}) {
  const statusColors = { active: 'bg-green-500', low: 'bg-yellow-500', inactive: 'bg-gray-500' };
  const platformLabels = { github: 'GitHub', ado: 'Azure DevOps' };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="font-semibold text-white">{name}</span>
        </div>
        <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{platformLabels[platform]}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <p className="font-bold text-white">{commits}</p>
          <p className="text-xs text-gray-400">commits</p>
        </div>
        <div>
          <p className="font-bold text-green-400">{prsMerged}</p>
          <p className="text-xs text-gray-400">merged</p>
        </div>
        <div>
          <p className="font-bold text-orange-400">{prsOpen}</p>
          <p className="text-xs text-gray-400">open</p>
        </div>
      </div>
    </div>
  );
}

// Repo Table
export function RepoTable({ repos }: {
  repos: Array<{
    name: string;
    platform: 'github' | 'ado';
    commits: number;
    prsMerged: number;
    prsOpen: number;
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
            <th className="pb-3">Repository</th>
            <th className="pb-3">Platform</th>
            <th className="pb-3 text-right">Commits</th>
            <th className="pb-3 text-right">PRs Merged</th>
            <th className="pb-3 text-right">PRs Open</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((r, i) => (
            <tr key={i} className="border-b border-gray-800">
              <td className="py-3 text-white">{r.name}</td>
              <td className="py-3">
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                  {r.platform === 'github' ? 'GitHub' : 'ADO'}
                </span>
              </td>
              <td className="py-3 text-right text-white">{r.commits}</td>
              <td className="py-3 text-right text-green-400">{r.prsMerged}</td>
              <td className="py-3 text-right text-orange-400">{r.prsOpen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// PR Alert
export function PRAlert({ repo, number, title, author, age, status, url }: {
  repo: string;
  number: number;
  title: string;
  author: string;
  age: string;
  status: 'stale' | 'needs-review' | 'in-review' | 'approved';
  url?: string;
}) {
  const statusConfig = {
    stale: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Stale' },
    'needs-review': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Needs Review' },
    'in-review': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'In Review' },
    approved: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'Approved' },
  };

  const config = statusConfig[status];

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{title}</p>
          <p className="text-gray-400 text-sm">
            {repo} #{number} • @{author} • {age}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

// PR List
export function PRList({ prs }: {
  prs: Array<{
    repo: string;
    number: number;
    title: string;
    author: string;
    age: string;
    status: 'stale' | 'needs-review' | 'in-review' | 'approved';
  }>;
}) {
  return (
    <div className="space-y-2">
      {prs.map((pr, i) => (
        <PRAlert key={i} {...pr} />
      ))}
    </div>
  );
}

// Bar Chart
export function BarChart({ title, data, height = 200 }: {
  title?: string;
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  return (
    <div>
      {title && <h3 className="text-gray-300 text-sm mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar data={data}>
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}

// Pie Chart
export function PieChart({ title, data, height = 200 }: {
  title?: string;
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  return (
    <div>
      {title && <h3 className="text-gray-300 text-sm mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPie data={data}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
          />
        </RechartsPie>
      </ResponsiveContainer>
    </div>
  );
}

// Activity Timeline
export function ActivityTimeline({ data, height = 150 }: {
  data: Array<{ date: string; commits: number; prs: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#fff' }}
        />
        <Line type="monotone" dataKey="commits" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="prs" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Commit List
export function CommitList({ commits, limit = 10 }: {
  commits: Array<{
    sha: string;
    author: string;
    message: string;
    repo: string;
    date?: string;
  }>;
  limit?: number;
}) {
  return (
    <div className="space-y-2">
      {commits.slice(0, limit).map((c, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800">
          <code className="text-blue-400 text-sm font-mono">{c.sha}</code>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{c.message}</p>
            <p className="text-gray-500 text-xs">
              {c.author} in {c.repo} {c.date && `• ${c.date}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Text
export function Text({ content, variant = 'body' }: {
  content: string;
  variant?: 'body' | 'heading' | 'subheading' | 'caption' | 'warning';
}) {
  const styles = {
    body: 'text-gray-300',
    heading: 'text-2xl font-bold text-white',
    subheading: 'text-lg font-semibold text-gray-200',
    caption: 'text-sm text-gray-500',
    warning: 'text-orange-400',
  };

  return <p className={styles[variant]}>{content}</p>;
}

// Alert
export function Alert({ message, type }: {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
  };

  return (
    <div className={`border rounded-lg p-3 ${styles[type]}`}>
      {message}
    </div>
  );
}

// Component registry for json-render
export const componentRegistry = {
  Dashboard,
  Grid,
  Section,
  MetricCard,
  ContributorCard,
  ContributorTable,
  RepoCard,
  RepoTable,
  PRAlert,
  PRList,
  BarChart,
  PieChart,
  ActivityTimeline,
  CommitList,
  Text,
  Alert,
};
