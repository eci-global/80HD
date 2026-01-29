'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
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
  componentRegistry,
} from '../components';

// Component lookup for JSON rendering
const Components = componentRegistry;

// JSON Tree Renderer
function RenderNode({ node, data }: { node: any; data?: any }) {
  if (!node) return null;

  const Component = Components[node.type as keyof typeof Components];
  if (!Component) {
    console.warn(`Unknown component type: ${node.type}`);
    return null;
  }

  // Render children if present
  let children = null;
  if (node.children && Array.isArray(node.children)) {
    children = node.children.map((child: any, i: number) => (
      <RenderNode key={child.key || i} node={child} data={data} />
    ));
  }

  return <Component {...node.props}>{children}</Component>;
}

// Generate shareable text from dashboard data
function generateShareableText(d: any, format: 'markdown' | 'plain' = 'markdown'): string {
  const bold = (text: string) => format === 'markdown' ? `**${text}**` : text.toUpperCase();
  const bullet = format === 'markdown' ? '•' : '-';
  const divider = format === 'markdown' ? '---' : '----------------------------------------';

  const lines: string[] = [];

  // Header
  lines.push(bold(`Team Activity Report - ${d.period}`));
  lines.push('');

  // Summary stats
  lines.push(bold('Summary'));
  lines.push(`${bullet} ${d.metrics?.totalCommits || 0} commits`);
  lines.push(`${bullet} ${d.metrics?.prsMerged || 0} PRs merged`);
  lines.push(`${bullet} ${d.metrics?.prsOpen || 0} PRs open`);
  lines.push(`${bullet} ${d.metrics?.contributors || 0} contributors`);
  lines.push('');

  // What's being built
  if (d.workInsights?.teamFocus?.length > 0) {
    lines.push(bold('Focus Areas'));
    for (const focus of d.workInsights.teamFocus.slice(0, 3)) {
      lines.push(`${bullet} ${focus.domain} (${focus.count} changes)`);
    }
    lines.push('');
  }

  // Who's building what
  if (d.workInsights?.contributorWork?.length > 0) {
    lines.push(bold("Who's Building What"));
    lines.push('');
    for (const c of d.workInsights.contributorWork.slice(0, 5)) {
      const domains = c.domains?.slice(0, 2).join(', ') || '';
      lines.push(bold(c.name) + (domains ? ` (${domains})` : ''));
      for (const change of (c.keyChanges || []).slice(0, 2)) {
        lines.push(`  ${bullet} ${change}`);
      }
      lines.push('');
    }
  }

  // Open PRs needing attention
  if (d.openPRs?.length > 0) {
    lines.push(divider);
    lines.push(bold('Open PRs Needing Attention'));
    for (const pr of d.openPRs.slice(0, 5)) {
      lines.push(`${bullet} ${pr.repo} #${pr.number}: ${pr.title} (@${pr.author}, ${pr.age})`);
    }
    lines.push('');
  }

  // Footer
  lines.push(divider);
  lines.push(`Generated: ${d.generated || new Date().toLocaleString()}`);

  return lines.join('\n');
}

// Main Dashboard Page
export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (format: 'markdown' | 'plain') => {
    if (!dashboardData) return;
    const text = generateShareableText(dashboardData, format);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [dashboardData]);

  useEffect(() => {
    // Try to load dashboard data from the API or local file
    async function loadData() {
      try {
        // First try the API endpoint
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setDashboardData(data);
        } else {
          // Fall back to demo data
          setDashboardData(getDemoData());
        }
      } catch (e) {
        // Use demo data if fetch fails
        setDashboardData(getDemoData());
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <Alert message={error} type="error" />
      </div>
    );
  }

  // If we have a JSON tree structure, render it
  if (dashboardData?.tree) {
    return <RenderNode node={dashboardData.tree} data={dashboardData.data} />;
  }

  // Otherwise render from structured data
  const d = dashboardData;

  return (
    <Dashboard
      title="Team Activity Dashboard"
      period={d.period || 'Last 7 days'}
      generated={d.generated || new Date().toISOString()}
    >
      {/* Share Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => copyToClipboard('markdown')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            copied === 'markdown'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {copied === 'markdown' ? '✓ Copied!' : '📋 Copy for Teams/Slack'}
        </button>
        <button
          onClick={() => copyToClipboard('plain')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            copied === 'plain'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {copied === 'plain' ? '✓ Copied!' : '📧 Copy for Email'}
        </button>
      </div>
      {/* Metrics Row */}
      <Grid columns={4} gap={4}>
        <MetricCard
          label="Total Commits"
          value={d.metrics?.totalCommits || 0}
          icon="commit"
          color="blue"
          trend={d.metrics?.commitTrend}
          trendValue={d.metrics?.commitTrendValue}
        />
        <MetricCard
          label="PRs Merged"
          value={d.metrics?.prsMerged || 0}
          icon="pr-merged"
          color="green"
        />
        <MetricCard
          label="PRs Open"
          value={d.metrics?.prsOpen || 0}
          icon="pr-open"
          color="orange"
        />
        <MetricCard
          label="Contributors"
          value={d.metrics?.contributors || 0}
          icon="user"
          color="purple"
        />
      </Grid>

      {/* What's Being Built - Work Insights */}
      {d.workInsights && (
        <Section title="What's Being Built">
          <div className="space-y-4">
            {/* Summary */}
            {d.workInsights.summary && (
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="prose prose-invert prose-sm max-w-none"
                     dangerouslySetInnerHTML={{ __html: d.workInsights.summary.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '<br/><br/>') }}
                />
              </div>
            )}

            {/* Team Focus Areas */}
            {d.workInsights.teamFocus && d.workInsights.teamFocus.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {d.workInsights.teamFocus.map((focus: any, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: i === 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                      color: i === 0 ? '#60a5fa' : '#9ca3af',
                    }}
                  >
                    {focus.domain} ({focus.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Contributor Work Details */}
      {d.workInsights?.contributorWork && d.workInsights.contributorWork.length > 0 && (
        <Section title="Who's Building What">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {d.workInsights.contributorWork.map((c: any, i: number) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    {c.domains && c.domains.length > 0 && (
                      <p className="text-xs text-gray-400">{c.domains.slice(0, 2).join(' • ')}</p>
                    )}
                  </div>
                </div>
                {c.keyChanges && c.keyChanges.length > 0 && (
                  <ul className="space-y-1">
                    {c.keyChanges.slice(0, 3).map((change: string, j: number) => (
                      <li key={j} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span className="line-clamp-2">{change}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Charts Row */}
      {d.charts && (
        <Grid columns={2} gap={4}>
          {d.charts.commitsByContributor && (
            <Section title="Commits by Contributor">
              <BarChart data={d.charts.commitsByContributor} height={200} />
            </Section>
          )}
          {d.charts.commitsByRepo && (
            <Section title="Commits by Repository">
              <PieChart data={d.charts.commitsByRepo} height={200} />
            </Section>
          )}
        </Grid>
      )}

      {/* Contributors Section */}
      {d.contributors && d.contributors.length > 0 && (
        <Section title="Team Activity" collapsible>
          {d.contributors.length <= 4 ? (
            <Grid columns={4} gap={4}>
              {d.contributors.map((c: any, i: number) => (
                <ContributorCard key={i} {...c} />
              ))}
            </Grid>
          ) : (
            <ContributorTable contributors={d.contributors} />
          )}
        </Section>
      )}

      {/* Repositories Section */}
      {d.repos && d.repos.length > 0 && (
        <Section title="Repository Activity">
          {d.repos.length <= 4 ? (
            <Grid columns={4} gap={4}>
              {d.repos.map((r: any, i: number) => (
                <RepoCard key={i} {...r} />
              ))}
            </Grid>
          ) : (
            <RepoTable repos={d.repos} />
          )}
        </Section>
      )}

      {/* Open PRs Section */}
      {d.openPRs && d.openPRs.length > 0 && (
        <Section title="Open PRs Needing Attention">
          <PRList prs={d.openPRs} />
        </Section>
      )}

      {/* Recent Commits Section */}
      {d.recentCommits && d.recentCommits.length > 0 && (
        <Section title="Recent Commits" collapsible>
          <CommitList commits={d.recentCommits} limit={10} />
        </Section>
      )}

      {/* Warnings */}
      {d.warnings && d.warnings.length > 0 && (
        <div className="space-y-2">
          {d.warnings.map((w: string, i: number) => (
            <Alert key={i} message={w} type="warning" />
          ))}
        </div>
      )}
    </Dashboard>
  );
}

// Demo data for testing
function getDemoData() {
  return {
    period: 'Jan 22-29, 2026',
    generated: new Date().toLocaleString(),
    metrics: {
      totalCommits: 18,
      prsMerged: 7,
      prsOpen: 1,
      contributors: 4,
      commitTrend: 'up' as const,
      commitTrendValue: '+23% from last week',
    },
    charts: {
      commitsByContributor: [
        { label: 'Travis', value: 15 },
        { label: 'Sean', value: 2 },
        { label: 'Blaze', value: 1 },
      ],
      commitsByRepo: [
        { label: 'firehydrant', value: 18 },
        { label: 'one-cloud-sla', value: 0 },
        { label: 'coralogix', value: 0 },
      ],
    },
    contributors: [
      { name: 'Travis Edgar', username: 'rustyautopsy', commits: 15, prsMerged: 4, prsOpen: 0, topRepos: ['firehydrant'] },
      { name: 'Sean Wilson', username: 'sewilson-eci', commits: 2, prsMerged: 2, prsOpen: 0, topRepos: ['firehydrant'] },
      { name: 'Blaze Lewis', username: 'GIT-BlazeLewis', commits: 1, prsMerged: 2, prsOpen: 0, topRepos: ['firehydrant'] },
      { name: 'R Clemens', username: 'rclemens-eci', commits: 0, prsMerged: 1, prsOpen: 1, topRepos: ['firehydrant'] },
    ],
    repos: [
      { name: 'firehydrant', platform: 'github' as const, commits: 18, prsMerged: 7, prsOpen: 1, status: 'active' as const },
      { name: 'one-cloud-sla-dashboard', platform: 'github' as const, commits: 0, prsMerged: 0, prsOpen: 0, status: 'inactive' as const },
      { name: 'coralogix', platform: 'github' as const, commits: 0, prsMerged: 0, prsOpen: 0, status: 'inactive' as const },
      { name: 'spruce', platform: 'ado' as const, commits: 0, prsMerged: 0, prsOpen: 0, status: 'inactive' as const },
    ],
    openPRs: [
      { repo: 'firehydrant', number: 135, title: 'Update rotation and escalation timeouts', author: 'rclemens-eci', age: '1d', status: 'needs-review' as const },
    ],
    recentCommits: [
      { sha: '79bd9ca', author: 'Travis Edgar', message: 'Fix validation system: streaming output, parallel fetching', repo: 'firehydrant', date: 'Jan 29' },
      { sha: '5d5f749', author: 'Travis Edgar', message: 'Onboard Spruce.Next product with TFC workspace automation', repo: 'firehydrant', date: 'Jan 28' },
      { sha: '3019ed1', author: 'Travis Edgar', message: 'Update signal rule expressions for brit and rock-cls products', repo: 'firehydrant', date: 'Jan 27' },
      { sha: '705e828', author: 'bllewis', message: 'ITSREDL-6333: Update Distro LBMH roster', repo: 'firehydrant', date: 'Jan 23' },
      { sha: '7153cd4', author: 'Sean Wilson', message: 'Update Applications alert trigger rule', repo: 'firehydrant', date: 'Jan 23' },
    ],
    warnings: [],
  };
}
