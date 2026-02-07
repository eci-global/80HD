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

// Feedback Status Hero Card
export function FeedbackStatusCard({ feedback }: {
  feedback: {
    totalComments: number;
    pendingCount: number;
    comments: Array<{ createdAt: string }>;
    lastChecked?: string;
  };
}) {
  // Calculate time since last feedback
  const getTimeSinceLastFeedback = () => {
    if (!feedback.comments || feedback.comments.length === 0) {
      return { text: 'No feedback yet', days: Infinity, status: 'neutral' as const };
    }

    const latestComment = feedback.comments.reduce((latest, c) => {
      const date = new Date(c.createdAt);
      return date > new Date(latest.createdAt) ? c : latest;
    });

    const now = new Date();
    const lastDate = new Date(latestComment.createdAt);
    const diffMs = now.getTime() - lastDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return { text: 'Just now', days: 0, status: 'good' as const };
    if (diffHours < 24) return { text: `${diffHours}h ago`, days: 0, status: 'good' as const };
    if (diffDays === 1) return { text: '1 day ago', days: 1, status: 'good' as const };
    if (diffDays <= 3) return { text: `${diffDays} days ago`, days: diffDays, status: 'warning' as const };
    return { text: `${diffDays} days ago`, days: diffDays, status: 'alert' as const };
  };

  const lastFeedback = getTimeSinceLastFeedback();
  const hasPending = feedback.pendingCount > 0;

  // Determine overall status and styling
  const getStatusConfig = () => {
    if (hasPending) {
      return {
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        iconColor: 'text-amber-400',
        label: 'Needs Response',
        value: feedback.pendingCount,
        sublabel: `${feedback.pendingCount} pending question${feedback.pendingCount > 1 ? 's' : ''}`,
      };
    }
    if (lastFeedback.status === 'alert') {
      return {
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        iconColor: 'text-red-400',
        label: 'Feedback Gap',
        value: lastFeedback.days,
        sublabel: `No feedback in ${lastFeedback.days} days`,
      };
    }
    if (lastFeedback.status === 'warning') {
      return {
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        iconColor: 'text-yellow-400',
        label: 'Getting Quiet',
        value: feedback.totalComments,
        sublabel: `Last feedback ${lastFeedback.text}`,
      };
    }
    return {
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400',
      label: 'Feedback Active',
      value: feedback.totalComments,
      sublabel: `Last feedback ${lastFeedback.text}`,
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`rounded-lg p-4 border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-black/20 ${config.iconColor}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm">{config.label}</p>
          <p className="text-2xl font-bold text-white">{config.value}</p>
          <p className={`text-sm ${config.iconColor}`}>{config.sublabel}</p>
        </div>
      </div>
    </div>
  );
}

// Feedback Comment Card
export interface FeedbackComment {
  id: string;
  platform: 'github' | 'jira' | 'confluence' | 'linear';
  type: string;
  item: string;
  itemUrl: string;
  author: string;
  body: string;
  createdAt: string;
  isQuestion: boolean;
  isPending: boolean;
}

const platformConfig: Record<string, { color: string; icon: string; label: string }> = {
  github: { color: 'purple', icon: 'GH', label: 'GitHub' },
  jira: { color: 'blue', icon: 'JR', label: 'JIRA' },
  confluence: { color: 'cyan', icon: 'CF', label: 'Confluence' },
  linear: { color: 'indigo', icon: 'LN', label: 'Linear' },
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

export function FeedbackCard({ comment }: { comment: FeedbackComment }) {
  const config = platformConfig[comment.platform] || platformConfig.github;
  const colorStyles: Record<string, string> = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorStyles[config.color as keyof typeof colorStyles]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/30 px-2 py-0.5 text-xs font-mono">
            {config.icon}
          </span>
          <a
            href={comment.itemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline"
          >
            {comment.item}
          </a>
          {comment.isPending ? (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
              Awaiting Reply
            </span>
          ) : comment.isQuestion ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              Question
            </span>
          ) : null}
        </div>
        <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm text-gray-300">
        <span className="font-medium text-white">{comment.author}:</span>{' '}
        {comment.body.length > 120 ? `${comment.body.slice(0, 120)}...` : comment.body}
      </p>
    </div>
  );
}

// Feedback List
export function FeedbackList({ comments }: { comments: FeedbackComment[] }) {
  if (comments.length === 0) {
    return <p className="text-gray-400">No feedback yet</p>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {comments.map((comment) => (
        <FeedbackCard key={comment.id} comment={comment} />
      ))}
    </div>
  );
}

// Feedback Section with tabs
export function FeedbackSection({ feedback }: {
  feedback: {
    totalComments: number;
    pendingCount: number;
    comments: FeedbackComment[];
    pending: FeedbackComment[];
    quickLinks?: {
      github?: string;
      jira?: string;
      confluence?: string;
      linear?: string;
      discussion?: string;
      [key: string]: string | undefined;
    };
  };
}) {
  const [activeTab, setActiveTab] = React.useState<'recent' | 'pending' | 'github' | 'jira' | 'confluence' | 'linear'>('recent');

  const filteredComments = feedback.comments.filter((c) => {
    if (activeTab === 'pending') return c.isPending;
    if (activeTab === 'recent') return true;
    return c.platform === activeTab;
  });

  const tabs = ['recent', 'pending', 'github', 'jira', 'confluence', 'linear'] as const;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {feedback.totalComments} comments across platforms
          {feedback.pendingCount > 0 && (
            <span className="ml-2 text-amber-400">• {feedback.pendingCount} pending</span>
          )}
        </div>
        {feedback.quickLinks?.discussion && (
          <a
            href={feedback.quickLinks.discussion}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline"
          >
            View Discussion →
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {tab === 'pending' && feedback.pendingCount > 0
              ? `${tab} (${feedback.pendingCount})`
              : tab}
          </button>
        ))}
      </div>

      {/* Comments */}
      <FeedbackList comments={filteredComments} />

      {/* Quick Links */}
      {feedback.quickLinks && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-2 border-t border-gray-800">
          {feedback.quickLinks.linear && (
            <a href={feedback.quickLinks.linear} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300">
              Linear Initiative
            </a>
          )}
          {feedback.quickLinks.github && (
            <a href={feedback.quickLinks.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
              GitHub
            </a>
          )}
          {feedback.quickLinks.jira && (
            <a href={feedback.quickLinks.jira} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
              JIRA
            </a>
          )}
          {feedback.quickLinks.confluence && (
            <a href={feedback.quickLinks.confluence} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
              Confluence
            </a>
          )}
          {feedback.quickLinks.ccoe && (
            <a href={feedback.quickLinks.ccoe} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300">
              CCOE
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Tab Navigation Component
export interface Tab {
  id: string;
  label: string;
  badge?: number;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-900 p-1 rounded-lg" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(e) => {
            const currentIndex = tabs.findIndex(t => t.id === activeTab);
            if (e.key === 'ArrowRight') {
              const nextIndex = (currentIndex + 1) % tabs.length;
              onTabChange(tabs[nextIndex].id);
            } else if (e.key === 'ArrowLeft') {
              const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
              onTabChange(tabs[prevIndex].id);
            }
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.id
                ? 'bg-white/20 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Refresh Button Component
export function RefreshButton({ onRefresh, isRefreshing, lastRefreshed }: {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed?: Date | null;
}) {
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  return (
    <div className="flex items-center gap-3">
      {lastRefreshed && (
        <span className="text-xs text-gray-500">
          Updated {getTimeAgo(lastRefreshed)}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
          isRefreshing
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <svg
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}

// Clickable Metric Card (extends MetricCard with navigation)
export function ClickableMetricCard({ label, value, trend, trendValue, icon, color = 'blue', onClick }: {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  icon: keyof typeof Icons;
  color?: keyof typeof COLORS;
  onClick?: () => void;
}) {
  const Icon = Icons[icon] || Icons.commit;
  const trendColors = { up: 'text-green-400', down: 'text-red-400', flat: 'text-gray-400' };
  const trendArrows = { up: '↑', down: '↓', flat: '→' };

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-lg p-4 flex items-start gap-4 ${
        onClick ? 'cursor-pointer hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 transition-all' : ''
      }`}
    >
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

// Component registry for json-render
export const componentRegistry = {
  Dashboard,
  Grid,
  Section,
  MetricCard,
  ClickableMetricCard,
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
  FeedbackCard,
  FeedbackList,
  FeedbackSection,
  FeedbackStatusCard,
  TabNavigation,
  RefreshButton,
};
