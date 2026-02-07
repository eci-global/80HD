'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
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
  FeedbackSection,
  FeedbackStatusCard,
  TabNavigation,
  RefreshButton,
  componentRegistry,
  Tab,
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

  // Team Health Insights
  if (d.teamHealth?.insights?.length > 0) {
    lines.push(divider);
    lines.push(bold('Team Health Insights'));
    for (const insight of d.teamHealth.insights) {
      lines.push(`${bullet} ${insight}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(divider);
  lines.push(`Generated: ${d.generated || new Date().toLocaleString()}`);

  return lines.join('\n');
}

// Tab configuration
const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'team', label: 'Team' },
];

const TAB_STORAGE_KEY = 'dashboard-active-tab';

// Main Dashboard Page
export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [contributorFilter, setContributorFilter] = useState<string | null>(null);

  // Load saved tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem(TAB_STORAGE_KEY);
    if (savedTab && TABS.some(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save tab selection to localStorage
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem(TAB_STORAGE_KEY, tabId);
    // Clear contributor filter when manually changing tabs (unless going to activity)
    if (tabId !== 'activity') {
      setContributorFilter(null);
    }
  }, []);

  // Filter by contributor and navigate to activity tab
  const handleContributorClick = useCallback((contributorName: string) => {
    setContributorFilter(contributorName);
    setActiveTab('activity');
    localStorage.setItem(TAB_STORAGE_KEY, 'activity');
  }, []);

  // Clear contributor filter
  const clearContributorFilter = useCallback(() => {
    setContributorFilter(null);
  }, []);

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

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const url = isRefresh ? '/api/dashboard?refresh=true' : '/api/dashboard';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setLastRefreshed(new Date());
      } else if (!isRefresh) {
        setDashboardData(getDemoData());
        setLastRefreshed(new Date());
      }
    } catch (e) {
      if (!isRefresh) {
        setDashboardData(getDemoData());
        setLastRefreshed(new Date());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

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

  // Build tabs with badges
  const tabsWithBadges: Tab[] = TABS.map(tab => {
    if (tab.id === 'feedback' && d.feedback?.pendingCount > 0) {
      return { ...tab, badge: d.feedback.pendingCount };
    }
    if (tab.id === 'activity' && d.openPRs?.length > 0) {
      return { ...tab, badge: d.openPRs.length };
    }
    return tab;
  });

  return (
    <Dashboard
      title="Team Activity Dashboard"
      period={d.period || 'Last 7 days'}
      generated={d.generated || new Date().toISOString()}
    >
      {/* Header Actions Row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
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
        <RefreshButton
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          lastRefreshed={lastRefreshed}
        />
      </div>

      {/* Hero Metrics Row - Always Visible */}
      <Grid columns={5} gap={4}>
        <ClickableMetricCard
          label="Total Commits"
          value={d.metrics?.totalCommits || 0}
          icon="commit"
          color="blue"
          trend={d.metrics?.commitTrend}
          trendValue={d.metrics?.commitTrendValue}
          onClick={() => handleTabChange('activity')}
        />
        <ClickableMetricCard
          label="PRs Merged"
          value={d.metrics?.prsMerged || 0}
          icon="pr-merged"
          color="green"
          onClick={() => handleTabChange('activity')}
        />
        <ClickableMetricCard
          label="PRs Open"
          value={d.metrics?.prsOpen || 0}
          icon="pr-open"
          color="orange"
          onClick={() => handleTabChange('activity')}
        />
        <ClickableMetricCard
          label="Contributors"
          value={d.metrics?.contributors || 0}
          icon="user"
          color="purple"
          onClick={() => handleTabChange('team')}
        />
        {d.feedback && (
          <div onClick={() => handleTabChange('feedback')} className="cursor-pointer">
            <FeedbackStatusCard feedback={d.feedback} />
          </div>
        )}
      </Grid>

      {/* Tab Navigation */}
      <div className="my-6">
        <TabNavigation
          tabs={tabsWithBadges}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>

      {/* ============================================ */}
      {/* OVERVIEW TAB */}
      {/* ============================================ */}
      {activeTab === 'overview' && (
        <>
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

          {/* Team Health Section */}
          {d.teamHealth && (
            <Section title="Team Health & Sentiment">
              <div className="space-y-4">
                {/* Sentiment & Burnout Risk Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`rounded-lg p-4 ${
                    d.teamHealth.sentiment === 'positive' ? 'bg-green-500/10 border border-green-500/30' :
                    d.teamHealth.sentiment === 'negative' ? 'bg-red-500/10 border border-red-500/30' :
                    'bg-gray-800 border border-gray-700'
                  }`}>
                    <div className="text-sm text-gray-400">Overall Mood</div>
                    <div className={`text-2xl font-bold ${
                      d.teamHealth.sentiment === 'positive' ? 'text-green-400' :
                      d.teamHealth.sentiment === 'negative' ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {d.teamHealth.sentiment === 'positive' ? '😊 Positive' :
                       d.teamHealth.sentiment === 'negative' ? '😟 Struggling' :
                       '😐 Neutral'}
                    </div>
                  </div>
                  <div className={`rounded-lg p-4 ${
                    d.teamHealth.burnoutRisk === 'high' ? 'bg-red-500/10 border border-red-500/30' :
                    d.teamHealth.burnoutRisk === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                    'bg-gray-800 border border-gray-700'
                  }`}>
                    <div className="text-sm text-gray-400">Work Pattern</div>
                    <div className={`text-2xl font-bold ${
                      d.teamHealth.burnoutRisk === 'high' ? 'text-red-400' :
                      d.teamHealth.burnoutRisk === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {d.teamHealth.burnoutRisk === 'high' ? '🔥 High Load' :
                       d.teamHealth.burnoutRisk === 'medium' ? '⚠️ Moderate' :
                       '✅ Healthy'}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">Off-Hours Work</div>
                    <div className="text-2xl font-bold text-gray-300">
                      🌙 {d.teamHealth.lateNightCommits + d.teamHealth.weekendCommits}
                    </div>
                    <div className="text-xs text-gray-500">
                      {d.teamHealth.lateNightCommits} late night, {d.teamHealth.weekendCommits} weekend
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">Breaking Changes</div>
                    <div className={`text-2xl font-bold ${d.teamHealth.breakingChanges > 0 ? 'text-orange-400' : 'text-gray-300'}`}>
                      {d.teamHealth.breakingChanges > 0 ? '⚠️' : '✓'} {d.teamHealth.breakingChanges}
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {d.teamHealth.insights && d.teamHealth.insights.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-purple-300 mb-2">Key Insights</h4>
                    <ul className="space-y-1">
                      {d.teamHealth.insights.map((insight: string, i: number) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Blockers & Achievements Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Blockers */}
                  {d.teamHealth.blockers && d.teamHealth.blockers.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-red-400 mb-2">Active Blockers</h4>
                      <div className="flex flex-wrap gap-2">
                        {d.teamHealth.blockers.map((b: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-sm">
                            {b.type} ({b.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Achievements */}
                  {d.teamHealth.achievements && d.teamHealth.achievements.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-400 mb-2">Achievements</h4>
                      <div className="flex flex-wrap gap-2">
                        {d.teamHealth.achievements.map((a: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm">
                            {a.type} ({a.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
        </>
      )}

      {/* ============================================ */}
      {/* ACTIVITY TAB */}
      {/* ============================================ */}
      {activeTab === 'activity' && (
        <>
          {/* Contributor Filter Indicator */}
          {contributorFilter && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-sm">Showing activity for:</span>
                <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                  {contributorFilter}
                </span>
              </div>
              <button
                onClick={clearContributorFilter}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
              >
                <span>×</span> Clear filter
              </button>
            </div>
          )}

          {/* Open PRs Section */}
          {d.openPRs && d.openPRs.length > 0 && (
            <Section title={contributorFilter ? `Open PRs by ${contributorFilter}` : "Open PRs Needing Attention"}>
              <PRList prs={contributorFilter
                ? d.openPRs.filter((pr: any) => pr.author === contributorFilter)
                : d.openPRs
              } />
              {contributorFilter && d.openPRs.filter((pr: any) => pr.author === contributorFilter).length === 0 && (
                <p className="text-gray-500 text-sm">No open PRs from {contributorFilter}</p>
              )}
            </Section>
          )}

          {/* Recent Commits Section */}
          {d.recentCommits && d.recentCommits.length > 0 && (
            <Section title={contributorFilter ? `Commits by ${contributorFilter}` : "Recent Commits"} collapsible>
              <CommitList
                commits={contributorFilter
                  ? d.recentCommits.filter((c: any) => c.author === contributorFilter)
                  : d.recentCommits
                }
                limit={contributorFilter ? 50 : 20}
              />
              {contributorFilter && d.recentCommits.filter((c: any) => c.author === contributorFilter).length === 0 && (
                <p className="text-gray-500 text-sm">No commits from {contributorFilter}</p>
              )}
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

          {/* Commit Types Breakdown */}
          {d.teamHealth?.commitTypes && Object.keys(d.teamHealth.commitTypes).length > 0 && (
            <Section title="Commit Types">
              <div className="flex flex-wrap gap-2">
                {Object.entries(d.teamHealth.commitTypes).map(([type, count]: [string, any]) => (
                  <span key={type} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* FEEDBACK TAB */}
      {/* ============================================ */}
      {activeTab === 'feedback' && (
        <>
          {d.feedback ? (
            <>
              {/* Initiative Banner */}
              {d.feedback.initiativeName && (
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-sm font-medium">Monitoring Initiative:</span>
                    <span className="text-white font-semibold">{d.feedback.initiativeName}</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    Feedback from linked Confluence pages, Linear issues, and external resources
                  </p>
                </div>
              )}

              {/* Feedback Summary */}
              <Section title="Feedback Overview">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">Total Comments</div>
                    <div className="text-2xl font-bold text-white">{d.feedback.totalComments}</div>
                  </div>
                  <div className={`rounded-lg p-4 border ${
                    d.feedback.pendingCount > 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-gray-800 border-gray-700'
                  }`}>
                    <div className="text-sm text-gray-400">Pending Questions</div>
                    <div className={`text-2xl font-bold ${d.feedback.pendingCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {d.feedback.pendingCount}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">Contributors</div>
                    <div className="text-2xl font-bold text-white">{d.feedback.byContributor?.length || 0}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">Platforms</div>
                    <div className="text-2xl font-bold text-white">{d.feedback.byPlatform?.length || 0}</div>
                    <div className="text-xs text-gray-500">
                      {d.feedback.byPlatform?.map((p: any) => p.label).join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Feedback Charts */}
              {(d.feedback.byContributor?.length > 0 || d.feedback.byPlatform?.length > 0) && (
                <Grid columns={2} gap={4}>
                  {d.feedback.byContributor && d.feedback.byContributor.length > 0 && (
                    <Section title="Feedback by Contributor">
                      <BarChart data={d.feedback.byContributor} height={200} />
                    </Section>
                  )}
                  {d.feedback.byPlatform && d.feedback.byPlatform.length > 0 && (
                    <Section title="Feedback by Platform">
                      <PieChart data={d.feedback.byPlatform} height={200} />
                    </Section>
                  )}
                </Grid>
              )}

              {/* Cross-Platform Feedback */}
              <Section title="Recent Feedback">
                <FeedbackSection feedback={d.feedback} />
              </Section>
            </>
          ) : (
            <Section title="Feedback">
              <div className="text-gray-400 text-center py-8">
                No feedback data available
              </div>
            </Section>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* TEAM TAB */}
      {/* ============================================ */}
      {activeTab === 'team' && (
        <>
          {/* Contributor Work Details */}
          {d.workInsights?.contributorWork && d.workInsights.contributorWork.length > 0 && (
            <Section title="Who's Building What">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {d.workInsights.contributorWork.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 hover:ring-1 hover:ring-blue-500/30 transition-all"
                    onClick={() => handleContributorClick(c.name)}
                    title={`View ${c.name}'s activity`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-white">{c.name}</p>
                          {c.lastActive && (
                            <span className="text-xs text-gray-500">
                              {new Date(c.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
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
                    {c.activeBranches && c.activeBranches.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-500">
                          Branches: {c.activeBranches.slice(0, 2).join(', ')}
                          {c.activeBranches.length > 2 && ` +${c.activeBranches.length - 2} more`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Contributors Section */}
          {d.contributors && d.contributors.length > 0 && (
            <Section title="Team Activity">
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

          {/* Work Distribution Chart */}
          {d.charts?.commitsByContributor && (
            <Section title="Work Distribution">
              <BarChart data={d.charts.commitsByContributor} height={250} />
            </Section>
          )}
        </>
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
    feedback: {
      totalComments: 3,
      pendingCount: 0,
      comments: [
        {
          id: 'gh-disc-68-1',
          platform: 'github' as const,
          type: 'discussion',
          item: 'Discussion #68',
          itemUrl: 'https://github.com/eci-global/gitops/discussions/68',
          author: 'System',
          body: 'RFC created - GitOps Outcomes Checklist v0.1 ready for CCoE review',
          createdAt: '2026-02-03T12:00:00Z',
          isQuestion: false,
          isPending: false,
        },
        {
          id: 'jira-1749-1',
          platform: 'jira' as const,
          type: 'jira_comment',
          item: 'ITPLAT01-1749',
          itemUrl: 'https://eci-solutions.atlassian.net/browse/ITPLAT01-1749',
          author: 'Travis Edgar',
          body: 'Work Started - PR #67 created, 12 outcomes defined across 4 categories',
          createdAt: '2026-02-02T20:41:07Z',
          isQuestion: false,
          isPending: false,
        },
        {
          id: 'gh-issue-55-1',
          platform: 'github' as const,
          type: 'issue_comment',
          item: 'Issue #55',
          itemUrl: 'https://github.com/eci-global/gitops/issues/55',
          author: 'rustyautopsy',
          body: 'Work Started',
          createdAt: '2026-02-02T20:40:53Z',
          isQuestion: false,
          isPending: false,
        },
      ],
      pending: [],
      quickLinks: {
        github: 'https://github.com/notifications',
        jira: 'https://eci-solutions.atlassian.net/browse/ITPLAT01-1749',
        confluence: 'https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1799323650',
        discussion: 'https://github.com/eci-global/gitops/discussions/68',
      },
    },
    teamHealth: {
      sentiment: 'positive' as const,
      sentimentScore: 0.45,
      burnoutRisk: 'low' as const,
      lateNightCommits: 2,
      weekendCommits: 1,
      breakingChanges: 0,
      blockers: [
        { type: 'wip', count: 1 },
      ],
      achievements: [
        { type: 'implemented', count: 5 },
        { type: 'completed', count: 3 },
        { type: 'integrated', count: 2 },
      ],
      commitTypes: {
        'feat': 8,
        'fix': 5,
        'refactor': 3,
        'docs': 2,
      },
      insights: [
        'Team morale appears positive with 10 achievements this period.',
        'Commit types: 8 features, 5 bug fixs, 3 refactors',
        'Some off-hours work detected: 3 commits outside business hours.',
      ],
    },
  };
}
