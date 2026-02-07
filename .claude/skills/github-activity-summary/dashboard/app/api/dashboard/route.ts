import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (try multiple locations)
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../../../.env'),
  resolve(process.cwd(), '../../../../.env'),
  resolve(process.cwd(), '../../../../../.env'),
  resolve(process.cwd(), '../../../../../../.env'),
  '/Users/tedgar/Projects/80HD/.env',
];

for (const envPath of envPaths) {
  config({ path: envPath });
  if (process.env.AZURE_DEVOPS_PAT) break;
}

const execAsync = promisify(exec);

// Get Azure DevOps PAT from environment
const AZURE_DEVOPS_PAT = process.env.AZURE_DEVOPS_PAT || '';

// Linear API configuration
const LINEAR_API_TOKEN = process.env.LINEAR_API_TOKEN || '';
const LINEAR_INITIATIVE_ID = process.env.LINEAR_INITIATIVE_ID || '3617f995-d28f-487e-85e4-c1ccd2d03360'; // GitOps initiative

// Atlassian API configuration - try to load from MCP config
let ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL || '';
let ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || '';
const ATLASSIAN_BASE_URL = 'https://eci-solutions.atlassian.net';

// Try to load from MCP config if not set
if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  try {
    const mcpConfigPaths = [
      resolve(process.cwd(), '../../../../../../.mcp.json'),
      '/Users/tedgar/Projects/80HD/.mcp.json',
    ];
    for (const mcpPath of mcpConfigPaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(mcpPath)) {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
          const atlassianEnv = mcpConfig?.mcpServers?.atlassian?.env;
          if (atlassianEnv) {
            ATLASSIAN_EMAIL = atlassianEnv.CONFLUENCE_USERNAME || atlassianEnv.JIRA_USERNAME || '';
            ATLASSIAN_API_TOKEN = atlassianEnv.CONFLUENCE_API_TOKEN || atlassianEnv.JIRA_API_TOKEN || '';
            break;
          }
        }
      } catch (e) {
        // Continue to next path
      }
    }
  } catch (e) {
    console.warn('Could not load MCP config:', e);
  }
}

// Current user configuration - used to determine "needs reply" status
// Comments FROM the current user that are questions = awaiting reply from others
const CURRENT_USER_NAMES = ['Travis Edgar', 'tedgar', 'rustyautopsy'];

// Contributor configuration - maps usernames to canonical names and timezones
// Timezone offsets are hours from UTC (e.g., -4 for Atlantic, -8 for Pacific)
interface ContributorConfig {
  name: string;
  timezone: number; // UTC offset in hours
  tzName?: string;  // Human-readable timezone name
}

const CONTRIBUTOR_CONFIG: Record<string, ContributorConfig> = {
  // Travis Edgar - Atlantic Time (UTC-4 / UTC-3 DST)
  'rustyautopsy': { name: 'Travis Edgar', timezone: -4, tzName: 'Atlantic' },
  'travis edgar': { name: 'Travis Edgar', timezone: -4, tzName: 'Atlantic' },
  'tedgar': { name: 'Travis Edgar', timezone: -4, tzName: 'Atlantic' },

  // Mahyar - Pacific Time (UTC-8 / UTC-7 DST)
  'mahyar': { name: 'Mahyar', timezone: -8, tzName: 'Pacific' },

  // Jeff Harris - London UK (UTC+0 / UTC+1 DST)
  'jeharris-eci': { name: 'Jeff Harris', timezone: 0, tzName: 'London' },
  'jeharris': { name: 'Jeff Harris', timezone: 0, tzName: 'London' },
  'jeff harris': { name: 'Jeff Harris', timezone: 0, tzName: 'London' },

  // Rick Clemens - default to Eastern (UTC-5)
  'rclemens-eci': { name: 'Rick Clemens', timezone: -5, tzName: 'Eastern' },
  'rclemens': { name: 'Rick Clemens', timezone: -5, tzName: 'Eastern' },
  'r clemens': { name: 'Rick Clemens', timezone: -5, tzName: 'Eastern' },
  'rick clemens': { name: 'Rick Clemens', timezone: -5, tzName: 'Eastern' },

  // Blaze Lewis - default to Eastern (UTC-5)
  'git-blazelewis': { name: 'Blaze Lewis', timezone: -5, tzName: 'Eastern' },
  'blazelewis': { name: 'Blaze Lewis', timezone: -5, tzName: 'Eastern' },
  'bllewis': { name: 'Blaze Lewis', timezone: -5, tzName: 'Eastern' },
  'blewis': { name: 'Blaze Lewis', timezone: -5, tzName: 'Eastern' },
  'blaze lewis': { name: 'Blaze Lewis', timezone: -5, tzName: 'Eastern' },

  // Sean Wilson - default to Eastern (UTC-5)
  'sewilson-eci': { name: 'Sean Wilson', timezone: -5, tzName: 'Eastern' },
  'sewilson': { name: 'Sean Wilson', timezone: -5, tzName: 'Eastern' },
  'swilson-eci': { name: 'Sean Wilson', timezone: -5, tzName: 'Eastern' },
  'swilson': { name: 'Sean Wilson', timezone: -5, tzName: 'Eastern' },
  'sean wilson': { name: 'Sean Wilson', timezone: -5, tzName: 'Eastern' },

  // Michael Ezzell - default to Eastern (UTC-5)
  'michael ezzell': { name: 'Michael Ezzell', timezone: -5, tzName: 'Eastern' },
  'mezzell': { name: 'Michael Ezzell', timezone: -5, tzName: 'Eastern' },

  // Mike Petersen - default to Eastern (UTC-5)
  'mipetersen-eci': { name: 'Mike Petersen', timezone: -5, tzName: 'Eastern' },
  'mipetersen': { name: 'Mike Petersen', timezone: -5, tzName: 'Eastern' },
  'mike petersen': { name: 'Mike Petersen', timezone: -5, tzName: 'Eastern' },
};

// Default timezone for unknown contributors (Eastern Time)
const DEFAULT_TIMEZONE = -5;

// Legacy alias map for backward compatibility
const CONTRIBUTOR_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(CONTRIBUTOR_CONFIG).map(([key, config]) => [key, config.name])
);

// Get contributor config (name and timezone)
function getContributorConfig(name: string): ContributorConfig {
  if (!name) return { name: 'Unknown', timezone: DEFAULT_TIMEZONE };

  const lowerName = name.toLowerCase().trim();

  // Direct match
  if (CONTRIBUTOR_CONFIG[lowerName]) {
    return CONTRIBUTOR_CONFIG[lowerName];
  }

  // Partial match - check if any alias pattern is contained in the name
  for (const [pattern, config] of Object.entries(CONTRIBUTOR_CONFIG)) {
    if (lowerName.includes(pattern) || pattern.includes(lowerName)) {
      return config;
    }
  }

  // No match - return original name with default timezone
  return { name, timezone: DEFAULT_TIMEZONE };
}

// Normalize a contributor name using the alias map
function normalizeContributor(name: string): string {
  return getContributorConfig(name).name;
}

// Get timezone offset for a contributor
function getContributorTimezone(name: string): number {
  return getContributorConfig(name).timezone;
}

// Work intent extraction - understanding WHAT is being built

// Patterns to extract meaningful work descriptions
const ACTION_PATTERNS = [
  { pattern: /^add(?:ed|ing|s)?\s+(.+)/i, action: 'Adding' },
  { pattern: /^implement(?:ed|ing|s)?\s+(.+)/i, action: 'Implementing' },
  { pattern: /^creat(?:e|ed|ing|es)?\s+(.+)/i, action: 'Creating' },
  { pattern: /^build(?:ing|s)?\s+(.+)/i, action: 'Building' },
  { pattern: /^fix(?:ed|ing|es)?\s+(.+)/i, action: 'Fixing' },
  { pattern: /^updat(?:e|ed|ing|es)?\s+(.+)/i, action: 'Updating' },
  { pattern: /^refactor(?:ed|ing|s)?\s+(.+)/i, action: 'Refactoring' },
  { pattern: /^migrat(?:e|ed|ing|es)?\s+(.+)/i, action: 'Migrating' },
  { pattern: /^enabl(?:e|ed|ing|es)?\s+(.+)/i, action: 'Enabling' },
  { pattern: /^integrat(?:e|ed|ing|es)?\s+(.+)/i, action: 'Integrating' },
  { pattern: /^optimiz(?:e|ed|ing|es)?\s+(.+)/i, action: 'Optimizing' },
  { pattern: /^enhanc(?:e|ed|ing|es)?\s+(.+)/i, action: 'Enhancing' },
];

// Technical domain patterns to understand what area of the system
const DOMAIN_PATTERNS: Record<string, RegExp> = {
  'API & Webhooks': /\b(api|endpoint|webhook|rest|graphql|request|response)\b/i,
  'Authentication & Security': /\b(auth|login|permission|credential|token|secret|security)\b/i,
  'Database & Data': /\b(database|db|query|schema|migration|data|model)\b/i,
  'Infrastructure & DevOps': /\b(terraform|infra|deploy|pipeline|ci|cd|docker|kubernetes|aws|azure|gcp)\b/i,
  'Monitoring & Alerting': /\b(alert|monitor|metric|log|trace|observ|signal|escalation|oncall)\b/i,
  'UI & Frontend': /\b(ui|frontend|component|react|css|style|dashboard|page|view)\b/i,
  'Testing & Validation': /\b(test|spec|validate|verify|check|assert)\b/i,
  'Configuration & Settings': /\b(config|setting|env|variable|flag|option|parameter)\b/i,
  'Integration & Sync': /\b(integrat|sync|connect|link|bridge|import|export)\b/i,
  'Automation & Workflows': /\b(automat|workflow|script|bot|schedule|trigger|hook)\b/i,
};

// ============================================================================
// COMMIT MESSAGE ANALYSIS - Sentiment, Blockers, Achievements
// ============================================================================

// Conventional commit type patterns
const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const COMMIT_TYPES: Record<string, { label: string; sentiment: number }> = {
  'feat': { label: 'Feature', sentiment: 1 },
  'fix': { label: 'Bug Fix', sentiment: 0.5 },
  'docs': { label: 'Documentation', sentiment: 0 },
  'style': { label: 'Style', sentiment: 0 },
  'refactor': { label: 'Refactor', sentiment: 0.3 },
  'perf': { label: 'Performance', sentiment: 0.7 },
  'test': { label: 'Testing', sentiment: 0.2 },
  'build': { label: 'Build', sentiment: 0 },
  'ci': { label: 'CI/CD', sentiment: 0 },
  'chore': { label: 'Chore', sentiment: 0 },
  'revert': { label: 'Revert', sentiment: -0.3 },
};

// Sentiment analysis keywords
const POSITIVE_PATTERNS = [
  /\b(complet(e|ed|ing)|finish(ed|ing)?|done|ship(ped|ping)?|launch(ed|ing)?)\b/i,
  /\b(success(ful(ly)?)?|accomplish(ed)?|achiev(e|ed|ing)?|resolved?)\b/i,
  /\b(improve(d|ment|s)?|enhanc(e|ed|ement)|optimi(ze|zed|zation))\b/i,
  /\b(implement(ed|ing)?|add(ed|ing)?|creat(e|ed|ing)?|built?)\b/i,
  /\b(finally|yay|woohoo|awesome|great)\b/i,
  /\b(clean(ed)?( ?up)?|simplif(y|ied)|streamlin(e|ed))\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(block(ed|er|ing)?|stuck|wait(ing)?|pend(ing)?|delay(ed)?)\b/i,
  /\b(broken?|fail(ed|ing|ure)?|error|bug|issue|problem)\b/i,
  /\b(revert(ed|ing)?|rollback|undo|redo)\b/i,
  /\b(hack(y)?|workaround|temporary|temp|todo|fixme|xxx)\b/i,
  /\b(wip|work.in.progress|incomplete|partial)\b/i,
  /\b(frustrat(ed|ing)?|struggle|difficult|hard|pain)\b/i,
];

const NEUTRAL_PATTERNS = [
  /\b(update(d|s)?|chang(e|ed|es)|modif(y|ied))\b/i,
  /\b(refactor(ed|ing)?|restructur(e|ed))\b/i,
  /\b(move(d)?|renam(e|ed)|reorganiz(e|ed))\b/i,
];

// Blocker detection patterns
const BLOCKER_PATTERNS = [
  { pattern: /\bblock(ed|er|ing)?\b/i, type: 'blocked' },
  { pattern: /\bwait(ing)?\s+(for|on)\b/i, type: 'waiting' },
  { pattern: /\bpend(ing)?\b/i, type: 'pending' },
  { pattern: /\bwip\b|\bwork.in.progress\b/i, type: 'wip' },
  { pattern: /\bneed(s)?\s+(review|approval|input|help)\b/i, type: 'needs-input' },
  { pattern: /\btodo\b|\bfixme\b|\bxxx\b/i, type: 'todo' },
  { pattern: /\btemporary\b|\btemp\b|\bworkaround\b/i, type: 'workaround' },
];

// Achievement detection patterns
const ACHIEVEMENT_PATTERNS = [
  { pattern: /\bcomplet(e|ed|ing)\b/i, type: 'completed' },
  { pattern: /\bfinish(ed|ing)?\b/i, type: 'finished' },
  { pattern: /\bship(ped|ping)?\b/i, type: 'shipped' },
  { pattern: /\blaunch(ed|ing)?\b/i, type: 'launched' },
  { pattern: /\bresolv(e|ed|ing)\b/i, type: 'resolved' },
  { pattern: /\bfix(ed|es)?\b.*\bbug\b/i, type: 'bug-fixed' },
  { pattern: /\bimplement(ed|ing)?\b/i, type: 'implemented' },
  { pattern: /\bintegrat(e|ed|ing)\b/i, type: 'integrated' },
];

interface CommitAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  conventionalType?: string;
  scope?: string;
  isBreakingChange: boolean;
  blockers: string[];
  achievements: string[];
  isLateNight: boolean;
  isWeekend: boolean;
}

function parseConventionalCommit(message: string): { type?: string; scope?: string; breaking: boolean; description: string } {
  const match = message.match(CONVENTIONAL_COMMIT_REGEX);
  if (match) {
    return {
      type: match[1].toLowerCase(),
      scope: match[2] || undefined,
      breaking: !!match[3],
      description: match[4],
    };
  }
  return { breaking: false, description: message };
}

function calculateSentiment(fullMessage: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
  let score = 0;

  // Check positive patterns
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(fullMessage)) {
      score += 1;
    }
  }

  // Check negative patterns
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(fullMessage)) {
      score -= 1;
    }
  }

  // Conventional commit type bonus
  const parsed = parseConventionalCommit(fullMessage.split('\n')[0]);
  if (parsed.type && COMMIT_TYPES[parsed.type]) {
    score += COMMIT_TYPES[parsed.type].sentiment;
  }

  // Breaking change penalty
  if (parsed.breaking || /BREAKING.CHANGE/i.test(fullMessage)) {
    score -= 0.5;
  }

  // Determine sentiment category
  if (score >= 0.5) return { sentiment: 'positive', score };
  if (score <= -0.5) return { sentiment: 'negative', score };
  return { sentiment: 'neutral', score };
}

function detectBlockers(fullMessage: string): string[] {
  const blockers: string[] = [];
  for (const { pattern, type } of BLOCKER_PATTERNS) {
    if (pattern.test(fullMessage)) {
      blockers.push(type);
    }
  }
  return blockers;
}

function detectAchievements(fullMessage: string): string[] {
  const achievements: string[] = [];
  for (const { pattern, type } of ACHIEVEMENT_PATTERNS) {
    if (pattern.test(fullMessage)) {
      achievements.push(type);
    }
  }
  return achievements;
}

function analyzeWorkPattern(dateStr: string, timezoneOffset: number = DEFAULT_TIMEZONE): { isLateNight: boolean; isWeekend: boolean; localHour: number } {
  const date = new Date(dateStr);

  // Convert UTC to contributor's local time
  // dateStr is in UTC, so we add the timezone offset (which is negative for west of UTC)
  const utcHour = date.getUTCHours();
  const utcDay = date.getUTCDay();

  // Calculate local hour (timezone offset is in hours, e.g., -4 for Atlantic)
  let localHour = utcHour + timezoneOffset;
  let dayAdjustment = 0;

  if (localHour < 0) {
    localHour += 24;
    dayAdjustment = -1;
  } else if (localHour >= 24) {
    localHour -= 24;
    dayAdjustment = 1;
  }

  // Adjust day of week if we crossed a day boundary
  let localDay = (utcDay + dayAdjustment + 7) % 7;

  return {
    isLateNight: localHour >= 21 || localHour < 6, // 9pm to 6am local time
    isWeekend: localDay === 0 || localDay === 6, // Sunday or Saturday local time
    localHour,
  };
}

function analyzeCommitMessage(fullMessage: string, dateStr: string, authorTimezone: number = DEFAULT_TIMEZONE): CommitAnalysis {
  const parsed = parseConventionalCommit(fullMessage.split('\n')[0]);
  const { sentiment, score } = calculateSentiment(fullMessage);
  const workPattern = analyzeWorkPattern(dateStr, authorTimezone);

  return {
    sentiment,
    sentimentScore: score,
    conventionalType: parsed.type,
    scope: parsed.scope,
    isBreakingChange: parsed.breaking || /BREAKING.CHANGE/i.test(fullMessage),
    blockers: detectBlockers(fullMessage),
    achievements: detectAchievements(fullMessage),
    isLateNight: workPattern.isLateNight,
    isWeekend: workPattern.isWeekend,
  };
}

interface TeamHealthMetrics {
  overallSentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  lateNightCommits: number;
  weekendCommits: number;
  blockersCount: number;
  achievementsCount: number;
  breakingChanges: number;
  commitTypeBreakdown: Record<string, number>;
  topBlockers: { type: string; count: number }[];
  topAchievements: { type: string; count: number }[];
  burnoutRisk: 'low' | 'medium' | 'high';
}

interface CommitWithAnalysis {
  sha: string;
  author: string;
  date: string;
  message: string;
  summary: string;
  repo: string;
  analysis: CommitAnalysis;
}

function aggregateTeamHealth(analyzedCommits: CommitWithAnalysis[]): TeamHealthMetrics {
  let totalSentimentScore = 0;
  let lateNightCommits = 0;
  let weekendCommits = 0;
  let breakingChanges = 0;
  const blockerCounts: Record<string, number> = {};
  const achievementCounts: Record<string, number> = {};
  const commitTypeCounts: Record<string, number> = {};

  for (const commit of analyzedCommits) {
    const analysis = commit.analysis;

    totalSentimentScore += analysis.sentimentScore;

    if (analysis.isLateNight) lateNightCommits++;
    if (analysis.isWeekend) weekendCommits++;
    if (analysis.isBreakingChange) breakingChanges++;

    if (analysis.conventionalType) {
      commitTypeCounts[analysis.conventionalType] = (commitTypeCounts[analysis.conventionalType] || 0) + 1;
    }

    for (const blocker of analysis.blockers) {
      blockerCounts[blocker] = (blockerCounts[blocker] || 0) + 1;
    }

    for (const achievement of analysis.achievements) {
      achievementCounts[achievement] = (achievementCounts[achievement] || 0) + 1;
    }
  }

  const avgSentiment = analyzedCommits.length > 0 ? totalSentimentScore / analyzedCommits.length : 0;
  const blockersCount = Object.values(blockerCounts).reduce((a, b) => a + b, 0);
  const achievementsCount = Object.values(achievementCounts).reduce((a, b) => a + b, 0);

  // Calculate burnout risk based on late night/weekend work patterns
  const totalCommits = analyzedCommits.length;
  const offHoursRatio = totalCommits > 0 ? (lateNightCommits + weekendCommits) / totalCommits : 0;
  let burnoutRisk: 'low' | 'medium' | 'high' = 'low';
  if (offHoursRatio > 0.4) burnoutRisk = 'high';
  else if (offHoursRatio > 0.2) burnoutRisk = 'medium';

  // Sort blockers and achievements by count
  const topBlockers = Object.entries(blockerCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topAchievements = Object.entries(achievementCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    overallSentiment: avgSentiment >= 0.3 ? 'positive' : avgSentiment <= -0.3 ? 'negative' : 'neutral',
    sentimentScore: Math.round(avgSentiment * 100) / 100,
    lateNightCommits,
    weekendCommits,
    blockersCount,
    achievementsCount,
    breakingChanges,
    commitTypeBreakdown: commitTypeCounts,
    topBlockers,
    topAchievements,
    burnoutRisk,
  };
}

// Generate human-readable insights from commit analysis
function generateCommitInsights(analyzedCommits: CommitWithAnalysis[], health: TeamHealthMetrics): string[] {
  const insights: string[] = [];

  // Overall sentiment
  if (health.overallSentiment === 'positive') {
    insights.push(`Team morale appears positive with ${health.achievementsCount} achievements this period.`);
  } else if (health.overallSentiment === 'negative') {
    insights.push(`Team may be facing challenges - detected ${health.blockersCount} blockers in commit messages.`);
  }

  // Breaking changes
  if (health.breakingChanges > 0) {
    insights.push(`${health.breakingChanges} breaking change${health.breakingChanges > 1 ? 's' : ''} introduced.`);
  }

  // Work patterns
  if (health.burnoutRisk === 'high') {
    insights.push(`High off-hours activity: ${health.lateNightCommits} late-night and ${health.weekendCommits} weekend commits.`);
  } else if (health.burnoutRisk === 'medium') {
    insights.push(`Some off-hours work detected: ${health.lateNightCommits + health.weekendCommits} commits outside business hours.`);
  }

  // Top blockers
  if (health.topBlockers.length > 0) {
    const blockerTypes = health.topBlockers.slice(0, 3).map(b => b.type).join(', ');
    insights.push(`Active blockers: ${blockerTypes}`);
  }

  // Top achievements
  if (health.topAchievements.length > 0) {
    const achievementTypes = health.topAchievements.slice(0, 3).map(a => `${a.count} ${a.type}`).join(', ');
    insights.push(`Key wins: ${achievementTypes}`);
  }

  // Commit type breakdown
  const mainTypes = Object.entries(health.commitTypeBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([_, count]) => count > 0);

  if (mainTypes.length > 0) {
    const typeLabels = mainTypes.map(([type, count]) => {
      const label = COMMIT_TYPES[type]?.label || type;
      return `${count} ${label.toLowerCase()}${count > 1 ? 's' : ''}`;
    }).join(', ');
    insights.push(`Commit types: ${typeLabels}`);
  }

  return insights;
}

interface ContributorWork {
  name: string;
  focus: string[];           // Main areas they're working on
  keyChanges: string[];      // Specific things they built/changed
  domains: string[];         // Technical domains touched
  commits: number;
  prs: number;
  activeBranches: string[];  // Branches they're working on
  lastActive: string;        // Most recent activity date (ISO string)
}

interface WorkInsights {
  contributorWork: ContributorWork[];
  teamFocus: { domain: string; count: number; examples: string[] }[];
  keyInitiatives: string[];
  activeBranches: { branch: string; owner: string; commits: number; lastCommit: string }[];
  summary: string;
}

// Extract owner from branch name patterns like "harris/feature-name" or "feature/harris/thing"
function getBranchOwner(branch: string): string | null {
  if (!branch || branch === 'main' || branch === 'master' || branch === 'develop') {
    return null;
  }

  // Common branch patterns: user/feature, feature/user/thing, user-feature
  const patterns = [
    /^([a-z]+(?:-eci)?)\//i,                    // harris/... or rclemens-eci/...
    /^feature\/([a-z]+(?:-eci)?)\//i,           // feature/harris/...
    /^(?:fix|feat|chore)\/([a-z]+(?:-eci)?)\//i, // fix/harris/...
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) {
      const potentialOwner = match[1].toLowerCase();
      // Check if this maps to a known contributor
      const config = CONTRIBUTOR_CONFIG[potentialOwner];
      if (config) {
        return config.name;
      }
      // Check partial matches
      for (const [key, conf] of Object.entries(CONTRIBUTOR_CONFIG)) {
        if (key.includes(potentialOwner) || potentialOwner.includes(key.split('-')[0])) {
          return conf.name;
        }
      }
    }
  }

  return null;
}

function analyzeWorkIntent(commits: any[], prs: any[], contributors: any[]): WorkInsights {
  const contributorDetails: Record<string, {
    changes: string[];
    domains: Set<string>;
    commits: number;
    prs: number;
    branches: Set<string>;
    lastActive: string;
  }> = {};

  const domainCounts: Record<string, { count: number; examples: string[] }> = {};
  const allChanges: { message: string; author: string; repo: string }[] = [];

  // Track active branches with their owners and commit counts
  const branchActivity: Record<string, { owner: string; commits: number; lastCommit: string; changes: string[] }> = {};

  // Analyze each commit
  for (const commit of commits) {
    const author = commit.author;
    const message = commit.message;
    const branch = commit.branch || 'main';

    // Determine the effective owner - either the branch owner or the commit author
    const branchOwner = getBranchOwner(branch);
    const effectiveOwner = branchOwner || author;

    // Track branch activity (skip main/master)
    if (branch !== 'main' && branch !== 'master') {
      if (!branchActivity[branch]) {
        branchActivity[branch] = {
          owner: branchOwner || author,
          commits: 0,
          lastCommit: commit.date,
          changes: [],
        };
      }
      branchActivity[branch].commits++;
    }

    if (!contributorDetails[effectiveOwner]) {
      contributorDetails[effectiveOwner] = { changes: [], domains: new Set(), commits: 0, prs: 0, branches: new Set(), lastActive: '' };
    }
    contributorDetails[effectiveOwner].commits++;
    // Track most recent activity
    const commitDate = commit.date || '';
    if (!contributorDetails[effectiveOwner].lastActive || commitDate > contributorDetails[effectiveOwner].lastActive) {
      contributorDetails[effectiveOwner].lastActive = commitDate;
    }
    if (branch !== 'main' && branch !== 'master') {
      contributorDetails[effectiveOwner].branches.add(branch);
    }

    // Extract meaningful change description
    let changeDesc = message;
    for (const { pattern, action } of ACTION_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        changeDesc = `${action} ${match[1]}`;
        break;
      }
    }

    // Clean up ticket IDs for readability
    changeDesc = changeDesc.replace(/^\[?[A-Z]+-\d+\]?\s*:?\s*/i, '').trim();
    if (changeDesc && !changeDesc.toLowerCase().startsWith('merge')) {
      contributorDetails[effectiveOwner].changes.push(changeDesc);
      allChanges.push({ message: changeDesc, author: effectiveOwner, repo: commit.repo });
      if (branchActivity[branch]) {
        branchActivity[branch].changes.push(changeDesc);
      }
    }

    // Identify domains
    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (pattern.test(message)) {
        contributorDetails[effectiveOwner].domains.add(domain);
        if (!domainCounts[domain]) {
          domainCounts[domain] = { count: 0, examples: [] };
        }
        domainCounts[domain].count++;
        if (domainCounts[domain].examples.length < 2) {
          domainCounts[domain].examples.push(changeDesc);
        }
      }
    }
  }

  // Analyze PRs
  for (const pr of prs) {
    const author = pr.author;
    if (!contributorDetails[author]) {
      contributorDetails[author] = { changes: [], domains: new Set(), commits: 0, prs: 0, branches: new Set(), lastActive: '' };
    }
    contributorDetails[author].prs++;
    // Track most recent activity from PR
    const prDate = pr.created_at || pr.merged_at || '';
    if (prDate && (!contributorDetails[author].lastActive || prDate > contributorDetails[author].lastActive)) {
      contributorDetails[author].lastActive = prDate;
    }

    // PRs often have better descriptions
    let prDesc = pr.title.replace(/^\[?[A-Z]+-\d+\]?\s*:?\s*/i, '').trim();
    if (prDesc && !prDesc.toLowerCase().startsWith('merge')) {
      contributorDetails[author].changes.push(`PR: ${prDesc}`);
    }

    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (pattern.test(pr.title)) {
        contributorDetails[author].domains.add(domain);
      }
    }
  }

  // Build contributor work summaries
  const contributorWork: ContributorWork[] = [];
  for (const [name, details] of Object.entries(contributorDetails)) {
    // Get unique, meaningful changes (dedupe similar ones)
    const uniqueChanges = [...new Set(details.changes)]
      .filter(c => c.length > 10)
      .slice(0, 5);

    // Determine primary focus areas based on branches and meaningful terms
    const focus = determineFocus(details.changes, Array.from(details.branches || []));

    contributorWork.push({
      name,
      focus,
      keyChanges: uniqueChanges,
      domains: Array.from(details.domains),
      commits: details.commits,
      prs: details.prs,
      activeBranches: Array.from(details.branches || []),
      lastActive: details.lastActive || '',
    });
  }

  // Sort by activity
  contributorWork.sort((a, b) => (b.commits + b.prs * 2) - (a.commits + a.prs * 2));

  // Team focus areas
  const teamFocus = Object.entries(domainCounts)
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Generate key initiatives (group related work)
  const keyInitiatives = extractKeyInitiatives(allChanges);

  // Build active branches list sorted by commit count
  const activeBranches = Object.entries(branchActivity)
    .map(([branch, data]) => ({
      branch,
      owner: data.owner,
      commits: data.commits,
      lastCommit: data.lastCommit,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);

  // Generate a natural language summary
  const summary = generateSummary(contributorWork, teamFocus, keyInitiatives);

  return { contributorWork, teamFocus, keyInitiatives, activeBranches, summary };
}

function determineFocus(changes: string[], branches: string[] = []): string[] {
  const focus: string[] = [];

  // Extract ticket IDs from branches (e.g., ITPLAT01-1537)
  const ticketPattern = /([A-Z]{2,}[-_]?\d+[-_]?\d*)/i;
  const tickets = new Set<string>();
  for (const branch of branches) {
    const match = branch.match(ticketPattern);
    if (match) {
      tickets.add(match[1].toUpperCase());
    }
  }
  for (const change of changes) {
    const match = change.match(ticketPattern);
    if (match) {
      tickets.add(match[1].toUpperCase());
    }
  }

  // Add ticket IDs as focus (limit to 1)
  if (tickets.size > 0) {
    focus.push([...tickets][0]);
  }

  // Extract meaningful technical terms (not generic words or ticket IDs)
  const wordCounts: Record<string, number> = {};
  const stopWords = new Set([
    // Common words
    'the', 'a', 'an', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'from', 'of', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'used',
    // Git terms
    'pr', 'merge', 'branch', 'commit', 'update', 'fix', 'add', 'feat', 'chore', 'initial',
    // Generic terms
    'list', 'items', 'item', 'punch', 'common', 'stack', 'work', 'changes', 'change',
    'some', 'more', 'new', 'old', 'first', 'last', 'next', 'prev', 'this', 'that',
  ]);

  // Pattern to detect ticket IDs (to filter them out)
  const ticketIdPattern = /^[a-z]{2,}\d+$|^\d+$/i;

  for (const change of changes) {
    // Clean the message of ticket prefixes
    const cleanedChange = change.replace(/^\[?[A-Z]+-\d+\]?\s*:?\s*/i, '');
    const words = cleanedChange.toLowerCase().split(/\W+/).filter(w =>
      w.length > 3 &&
      !stopWords.has(w) &&
      !ticketIdPattern.test(w) &&
      !/^\d+$/.test(w)  // Skip pure numbers
    );
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }

  // Get top meaningful words
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word);

  focus.push(...topWords);

  return focus.slice(0, 3);
}

function extractKeyInitiatives(changes: { message: string; author: string; repo: string }[]): string[] {
  // Group by similar themes
  const initiatives: string[] = [];

  // Look for patterns that indicate significant work
  const significantPatterns = [
    /implement.*([a-z]+\s+[a-z]+)/i,
    /add.*([a-z]+\s+[a-z]+)/i,
    /migrat.*to\s+([a-z]+)/i,
    /new\s+([a-z]+\s+[a-z]+)/i,
    /([a-z]+)\s+integration/i,
    /([a-z]+)\s+automation/i,
  ];

  const seen = new Set<string>();
  for (const change of changes) {
    for (const pattern of significantPatterns) {
      const match = change.message.match(pattern);
      if (match && match[1] && !seen.has(match[1].toLowerCase())) {
        seen.add(match[1].toLowerCase());
        initiatives.push(change.message);
        break;
      }
    }
    if (initiatives.length >= 5) break;
  }

  return initiatives;
}

function generateSummary(
  contributorWork: ContributorWork[],
  teamFocus: { domain: string; count: number }[],
  keyInitiatives: string[]
): string {
  const parts: string[] = [];

  // Top focus area
  if (teamFocus.length > 0) {
    parts.push(`The team is primarily focused on **${teamFocus[0].domain}**`);
    if (teamFocus.length > 1) {
      parts[0] += ` and **${teamFocus[1].domain}**`;
    }
    parts[0] += '.';
  }

  // Top contributors and what they're building
  const activeContributors = contributorWork.filter(c => c.keyChanges.length > 0).slice(0, 3);
  for (const contributor of activeContributors) {
    if (contributor.keyChanges.length > 0) {
      const focus = contributor.focus.length > 0 ? ` (${contributor.focus.join(', ')})` : '';
      parts.push(`**${contributor.name}**${focus}: ${contributor.keyChanges[0]}`);
    }
  }

  return parts.join('\n\n');
}

// Configuration
const GITHUB_ORG = 'ECI-Global';
const REPO_PATTERNS = ['one-cloud', 'firehydrant', 'core-logics', 'iac', 'coralogix'];

// Azure DevOps Configuration
const ADO_REPOS = [
  {
    org: 'https://dev.azure.com/Cloud-Delivery',
    project: 'spruce',
    repo: 'spruce',
  },
];

// ============================================================================
// LINEAR INITIATIVE & CONFLUENCE FEEDBACK INTEGRATION
// ============================================================================

interface InitiativeLink {
  id: string;
  label: string;
  url: string;
}

interface FeedbackComment {
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

// Fetch Linear initiative and its linked resources
async function fetchLinearInitiativeResources(): Promise<{
  initiative: { id: string; name: string; url: string } | null;
  links: InitiativeLink[];
  projectIds: string[];
}> {
  try {
    const query = JSON.stringify({
      query: `query {
        initiative(id: "${LINEAR_INITIATIVE_ID}") {
          id
          name
          links { nodes { id label url } }
          projects { nodes { id name } }
        }
      }`
    });

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': LINEAR_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: query,
    });

    const data = await response.json();
    const initiative = data?.data?.initiative;

    if (!initiative) {
      console.warn('Linear initiative not found:', LINEAR_INITIATIVE_ID);
      return { initiative: null, links: [], projectIds: [] };
    }

    return {
      initiative: {
        id: initiative.id,
        name: initiative.name,
        url: `https://linear.app/eci-platform-team/initiative/${initiative.id}`,
      },
      links: initiative.links?.nodes || [],
      projectIds: (initiative.projects?.nodes || []).map((p: any) => p.id),
    };
  } catch (error) {
    console.error('Failed to fetch Linear initiative:', error);
    return { initiative: null, links: [], projectIds: [] };
  }
}

// Fetch comments from Linear issues in a project
async function fetchLinearProjectComments(projectId: string): Promise<FeedbackComment[]> {
  try {
    const query = JSON.stringify({
      query: `query {
        project(id: "${projectId}") {
          name
          issues {
            nodes {
              id
              identifier
              title
              url
              comments {
                nodes {
                  id
                  body
                  user { name }
                  createdAt
                }
              }
            }
          }
        }
      }`
    });

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': LINEAR_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: query,
    });

    const data = await response.json();
    const project = data?.data?.project;
    const comments: FeedbackComment[] = [];

    if (!project?.issues?.nodes) return comments;

    for (const issue of project.issues.nodes) {
      for (const comment of (issue.comments?.nodes || [])) {
        const body = comment.body || '';
        const author = comment.user?.name || 'Unknown';
        const isQuestion = /\?/.test(body) || /question|clarify|wondering|should we|do we|can we/i.test(body);

        // If the comment is from current user and contains a question, it needs a reply from others
        const isFromCurrentUser = isCurrentUser(author);
        const needsReply = isQuestion && isFromCurrentUser;

        comments.push({
          id: `linear-${comment.id}`,
          platform: 'linear',
          type: 'issue_comment',
          item: `${issue.identifier}: ${issue.title}`,
          itemUrl: issue.url,
          author,
          body: body.length > 300 ? body.substring(0, 300) + '...' : body,
          createdAt: comment.createdAt,
          isQuestion,
          isPending: needsReply, // Only pending if it's YOUR question awaiting reply
        });
      }
    }

    return comments;
  } catch (error) {
    console.error('Failed to fetch Linear project comments:', error);
    return [];
  }
}

// Decode HTML entities in text content
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// Extract Confluence page ID from URL
function extractConfluencePageId(url: string): string | null {
  // Pattern: https://eci-solutions.atlassian.net/wiki/spaces/SPACE/pages/PAGE_ID/Title
  const match = url.match(/\/pages\/(\d+)/);
  return match ? match[1] : null;
}

// Helper to check if author is current user
function isCurrentUser(author: string): boolean {
  const normalized = author.toLowerCase();
  return CURRENT_USER_NAMES.some(name => normalized.includes(name.toLowerCase()));
}

// Fetch comments from a Confluence page using v1 API (better author data)
async function fetchConfluencePageComments(pageId: string, pageUrl: string, pageLabel: string): Promise<FeedbackComment[]> {
  if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
    console.warn('Atlassian credentials not configured, skipping Confluence comments');
    return [];
  }

  try {
    const auth = Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

    // Use v1 API which returns author displayName directly in the response
    const response = await fetch(
      `${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}/child/comment?expand=body.storage,version`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Confluence API returned ${response.status} for page ${pageId}`);
      return [];
    }

    const data = await response.json();
    const comments: FeedbackComment[] = [];

    for (const comment of (data.results || [])) {
      // v1 API: author is in version.by.displayName or history.createdBy.displayName
      const author = comment.version?.by?.displayName ||
                     comment.history?.createdBy?.displayName ||
                     'Unknown';

      const body = decodeHtmlEntities(
        (comment.body?.storage?.value || '').replace(/<[^>]*>/g, '')
      );
      const isQuestion = /\?/.test(body) || /question|clarify|input|feedback|should we|do we|can we/i.test(body);

      // If the comment is from current user and contains a question, it needs a reply from others
      const isFromCurrentUser = isCurrentUser(author);
      const needsReply = isQuestion && isFromCurrentUser;

      comments.push({
        id: `confluence-${comment.id}`,
        platform: 'confluence',
        type: 'page_comment',
        item: pageLabel,
        itemUrl: pageUrl,
        author,
        body: body.length > 300 ? body.substring(0, 300) + '...' : body,
        createdAt: comment.version?.when || comment.history?.createdDate || new Date().toISOString(),
        isQuestion,
        isPending: needsReply, // Only pending if it's YOUR question awaiting reply
      });
    }

    return comments;
  } catch (error) {
    console.error('Failed to fetch Confluence comments:', error);
    return [];
  }
}

// Main function to gather all feedback from initiative resources
async function gatherInitiativeFeedback(): Promise<{
  comments: FeedbackComment[];
  quickLinks: Record<string, string>;
  initiativeName: string | null;
}> {
  const allComments: FeedbackComment[] = [];
  const quickLinks: Record<string, string> = {};

  // 1. Fetch initiative and its linked resources
  const { initiative, links, projectIds } = await fetchLinearInitiativeResources();

  if (initiative) {
    quickLinks['linear'] = initiative.url;
  }

  // 2. Process each linked resource
  for (const link of links) {
    // Confluence pages
    if (link.url.includes('atlassian.net/wiki')) {
      const pageId = extractConfluencePageId(link.url);
      if (pageId) {
        const comments = await fetchConfluencePageComments(pageId, link.url, link.label);
        allComments.push(...comments);
        quickLinks[link.label.toLowerCase().replace(/\s+/g, '_')] = link.url;
      }
    }
    // JIRA links
    else if (link.url.includes('atlassian.net/browse')) {
      quickLinks['jira'] = link.url;
    }
    // GitHub links
    else if (link.url.includes('github.com')) {
      quickLinks['github'] = link.url;
    }
  }

  // 3. Fetch comments from Linear project issues
  for (const projectId of projectIds.slice(0, 5)) { // Limit to first 5 projects
    const projectComments = await fetchLinearProjectComments(projectId);
    allComments.push(...projectComments);
  }

  // 4. Sort by date (newest first)
  allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    comments: allComments.slice(0, 20), // Limit to 20 most recent
    quickLinks,
    initiativeName: initiative?.name || null,
  };
}

// ============================================================================
// END LINEAR/CONFLUENCE INTEGRATION
// ============================================================================

async function runCommand(cmd: string, useAdoPat: boolean = false): Promise<any> {
  try {
    const env = { ...process.env };
    if (useAdoPat && AZURE_DEVOPS_PAT) {
      env.AZURE_DEVOPS_EXT_PAT = AZURE_DEVOPS_PAT;
    }
    const { stdout } = await execAsync(cmd, { timeout: 30000, env });
    return JSON.parse(stdout);
  } catch (e) {
    console.error(`Command failed: ${cmd}`, e);
    return null;
  }
}

async function getGitHubRepos(): Promise<string[]> {
  const repos = await runCommand(
    `gh repo list ${GITHUB_ORG} --json name,nameWithOwner --limit 100`
  );

  if (!repos) return [];

  const matching: string[] = [];
  for (const repo of repos) {
    const name = repo.name.toLowerCase();
    for (const pattern of REPO_PATTERNS) {
      if (name.includes(pattern.toLowerCase())) {
        matching.push(repo.nameWithOwner);
        break;
      }
    }
  }
  return matching;
}

async function getRepoBranches(repo: string): Promise<string[]> {
  const branches = await runCommand(
    `gh api "repos/${repo}/branches?per_page=100" --jq '[.[].name]'`
  );
  return branches || ['main'];
}

async function getRepoCommits(repo: string, days: number = 7): Promise<any[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get all branches
  const branches = await getRepoBranches(repo);

  // Fetch commits from all branches in parallel
  const allCommits: any[] = [];
  const seenShas = new Set<string>();

  await Promise.all(
    branches.map(async (branch) => {
      // Fetch FULL commit messages (not just first line) for deeper analysis
      const commits = await runCommand(
        `gh api "repos/${repo}/commits?sha=${branch}&since=${since}&per_page=100" --jq '[.[] | {sha: .sha[0:7], fullSha: .sha, author: .commit.author.name, date: .commit.author.date, message: .commit.message, summary: (.commit.message | split("\\n")[0]), branch: "${branch}"}]'`
      );

      if (commits && Array.isArray(commits)) {
        for (const commit of commits) {
          // Deduplicate by full SHA (commits can appear in multiple branches)
          if (!seenShas.has(commit.fullSha)) {
            seenShas.add(commit.fullSha);
            allCommits.push(commit);
          }
        }
      }
    })
  );

  return allCommits;
}

async function getRepoPRs(repo: string): Promise<any[]> {
  const prs = await runCommand(
    `gh api "repos/${repo}/pulls?state=all&per_page=20" --jq '[.[] | {number, title, user: .user.login, state, created_at, merged_at}]'`
  );
  return prs || [];
}

// Azure DevOps functions - using REST API with PAT
async function getADOBranches(config: typeof ADO_REPOS[0]): Promise<string[]> {
  if (!AZURE_DEVOPS_PAT) return ['main'];

  const orgName = config.org.replace('https://dev.azure.com/', '');
  const result = await runCommand(
    `curl -s -u ":${AZURE_DEVOPS_PAT}" "https://dev.azure.com/${orgName}/${config.project}/_apis/git/repositories/${config.repo}/refs?filter=heads&api-version=7.0" | cat`
  );

  if (!result || !result.value) return ['main'];

  return result.value.map((ref: any) => ref.name.replace('refs/heads/', ''));
}

async function getADOCommits(config: typeof ADO_REPOS[0], days: number): Promise<any[]> {
  if (!AZURE_DEVOPS_PAT) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString();
  const orgName = config.org.replace('https://dev.azure.com/', '');

  // Get all branches
  const branches = await getADOBranches(config);

  const allCommits: any[] = [];
  const seenShas = new Set<string>();

  // Fetch commits from all branches using REST API
  await Promise.all(
    branches.map(async (branch) => {
      const result = await runCommand(
        `curl -s -u ":${AZURE_DEVOPS_PAT}" "https://dev.azure.com/${orgName}/${config.project}/_apis/git/repositories/${config.repo}/commits?searchCriteria.itemVersion.version=${branch}&searchCriteria.fromDate=${sinceStr}&\\$top=100&api-version=7.0" | cat`
      );

      if (result && result.value && Array.isArray(result.value)) {
        for (const commit of result.value) {
          if (!seenShas.has(commit.commitId)) {
            seenShas.add(commit.commitId);
            allCommits.push({
              sha: (commit.commitId || '').substring(0, 7),
              author: commit.author?.name || 'Unknown',
              date: commit.author?.date || commit.committer?.date,
              message: commit.comment || '', // Full message for analysis
              summary: (commit.comment || '').split('\n')[0], // First line for display
              branch,
            });
          }
        }
      }
    })
  );

  return allCommits;
}

async function getADOPRs(config: typeof ADO_REPOS[0]): Promise<any[]> {
  if (!AZURE_DEVOPS_PAT) return [];

  const orgName = config.org.replace('https://dev.azure.com/', '');
  const result = await runCommand(
    `curl -s -u ":${AZURE_DEVOPS_PAT}" "https://dev.azure.com/${orgName}/${config.project}/_apis/git/repositories/${config.repo}/pullrequests?searchCriteria.status=all&\\$top=50&api-version=7.0" | cat`
  );

  if (!result || !result.value || !Array.isArray(result.value)) return [];

  return result.value.map((pr: any) => ({
    number: pr.pullRequestId,
    title: pr.title,
    user: pr.createdBy?.displayName || pr.createdBy?.uniqueName || 'Unknown',
    state: pr.status === 'completed' ? 'closed' : pr.status === 'active' ? 'open' : pr.status,
    created_at: pr.creationDate,
    merged_at: pr.status === 'completed' ? pr.closedDate : null,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7', 10);
  const isRefresh = searchParams.get('refresh') === 'true';

  try {
    // Get matching repos
    const repos = await getGitHubRepos();

    // Gather data from each repo
    const repoData: Record<string, { commits: any[]; prs: any[] }> = {};

    await Promise.all(
      repos.map(async (repo) => {
        const [commits, prs] = await Promise.all([
          getRepoCommits(repo, days),
          getRepoPRs(repo),
        ]);
        repoData[repo] = { commits, prs };
      })
    );

    // Fetch Azure DevOps data
    const adoData: Record<string, { commits: any[]; prs: any[]; platform: 'ado' }> = {};
    await Promise.all(
      ADO_REPOS.map(async (config) => {
        const [commits, prs] = await Promise.all([
          getADOCommits(config, days),
          getADOPRs(config),
        ]);
        adoData[`ado:${config.repo}`] = { commits, prs, platform: 'ado' };
      })
    );

    // Aggregate metrics
    let totalCommits = 0;
    let prsMerged = 0;
    let prsOpen = 0;
    const contributorStats: Record<string, { commits: number; prsMerged: number; prsOpen: number }> = {};
    const repoStats: any[] = [];
    const openPRs: any[] = [];
    const recentCommits: any[] = [];
    const analyzedCommits: CommitWithAnalysis[] = [];

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    for (const [repoFullName, data] of Object.entries(repoData)) {
      const repoName = repoFullName.split('/')[1];
      let repoCommits = 0;
      let repoPRsMerged = 0;
      let repoPRsOpen = 0;

      // Process commits
      for (const commit of data.commits) {
        totalCommits++;
        repoCommits++;

        const author = normalizeContributor(commit.author);
        if (!contributorStats[author]) {
          contributorStats[author] = { commits: 0, prsMerged: 0, prsOpen: 0 };
        }
        contributorStats[author].commits++;

        // Analyze the full commit message with author's timezone
        const authorTimezone = getContributorTimezone(commit.author);
        const analysis = analyzeCommitMessage(commit.message || commit.summary || '', commit.date, authorTimezone);

        const commitEntry = {
          sha: commit.sha,
          author: author,
          message: commit.summary || commit.message?.split('\n')[0] || '',
          fullMessage: commit.message || '',
          repo: repoName,
          branch: commit.branch || 'main',
          date: new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };

        recentCommits.push(commitEntry);
        analyzedCommits.push({
          ...commitEntry,
          summary: commitEntry.message,
          analysis,
        });
      }

      // Process PRs
      for (const pr of data.prs) {
        const createdAt = new Date(pr.created_at);
        const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
        const user = normalizeContributor(pr.user);

        if (mergedAt && mergedAt >= since) {
          prsMerged++;
          repoPRsMerged++;

          if (!contributorStats[user]) {
            contributorStats[user] = { commits: 0, prsMerged: 0, prsOpen: 0 };
          }
          contributorStats[user].prsMerged++;
        } else if (pr.state === 'open') {
          prsOpen++;
          repoPRsOpen++;

          if (!contributorStats[user]) {
            contributorStats[user] = { commits: 0, prsMerged: 0, prsOpen: 0 };
          }
          contributorStats[user].prsOpen++;

          const ageMs = Date.now() - createdAt.getTime();
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

          openPRs.push({
            repo: repoName,
            number: pr.number,
            title: pr.title,
            author: user,
            age: ageDays === 0 ? 'today' : `${ageDays}d`,
            status: ageDays > 5 ? 'stale' : ageDays > 2 ? 'needs-review' : 'in-review',
          });
        }
      }

      repoStats.push({
        name: repoName,
        platform: 'github',
        commits: repoCommits,
        prsMerged: repoPRsMerged,
        prsOpen: repoPRsOpen,
        status: repoCommits > 0 ? 'active' : 'inactive',
      });
    }

    // Process Azure DevOps data
    for (const [repoKey, data] of Object.entries(adoData)) {
      const repoName = repoKey.replace('ado:', '');
      let repoCommits = 0;
      let repoPRsMerged = 0;
      let repoPRsOpen = 0;

      // Process ADO commits
      for (const commit of data.commits) {
        totalCommits++;
        repoCommits++;

        const author = normalizeContributor(commit.author);
        if (!contributorStats[author]) {
          contributorStats[author] = { commits: 0, prsMerged: 0, prsOpen: 0 };
        }
        contributorStats[author].commits++;

        // Analyze the full commit message with author's timezone
        const authorTimezone = getContributorTimezone(commit.author);
        const analysis = analyzeCommitMessage(commit.message || commit.summary || '', commit.date, authorTimezone);

        const commitEntry = {
          sha: commit.sha,
          author: author,
          message: commit.summary || commit.message?.split('\n')[0] || '',
          fullMessage: commit.message || '',
          repo: `${repoName} (ADO)`,
          branch: commit.branch || 'main',
          date: new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };

        recentCommits.push(commitEntry);
        analyzedCommits.push({
          ...commitEntry,
          summary: commitEntry.message,
          analysis,
        });
      }

      // Process ADO PRs
      for (const pr of data.prs) {
        const createdAt = new Date(pr.created_at);
        const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
        const user = normalizeContributor(pr.user);

        if (mergedAt && mergedAt >= since) {
          prsMerged++;
          repoPRsMerged++;

          if (!contributorStats[user]) {
            contributorStats[user] = { commits: 0, prsMerged: 0, prsOpen: 0 };
          }
          contributorStats[user].prsMerged++;
        } else if (pr.state === 'open' || pr.state === 'active') {
          prsOpen++;
          repoPRsOpen++;

          if (!contributorStats[user]) {
            contributorStats[user] = { commits: 0, prsMerged: 0, prsOpen: 0 };
          }
          contributorStats[user].prsOpen++;

          const ageMs = Date.now() - createdAt.getTime();
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

          openPRs.push({
            repo: `${repoName} (ADO)`,
            number: pr.number,
            title: pr.title,
            author: user,
            age: ageDays === 0 ? 'today' : `${ageDays}d`,
            status: ageDays > 5 ? 'stale' : ageDays > 2 ? 'needs-review' : 'in-review',
          });
        }
      }

      repoStats.push({
        name: `${repoName} (ADO)`,
        platform: 'ado',
        commits: repoCommits,
        prsMerged: repoPRsMerged,
        prsOpen: repoPRsOpen,
        status: repoCommits > 0 ? 'active' : 'inactive',
      });
    }

    // Sort and format
    recentCommits.sort((a, b) => b.date.localeCompare(a.date));
    openPRs.sort((a, b) => parseInt(b.age) - parseInt(a.age));

    const contributors = Object.entries(contributorStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.commits - a.commits);

    // Build chart data
    const commitsByContributor = contributors
      .slice(0, 8)
      .map((c) => ({ label: c.name.split(' ')[0], value: c.commits }));

    const commitsByRepo = repoStats
      .filter((r) => r.commits > 0)
      .map((r) => ({ label: r.name, value: r.commits }));

    // Calculate period string
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const period = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Analyze work intent - what is being built
    const workInsights = analyzeWorkIntent(recentCommits, openPRs, contributors);

    // Analyze team health from full commit messages
    const teamHealth = aggregateTeamHealth(analyzedCommits);
    const healthInsights = generateCommitInsights(analyzedCommits, teamHealth);

    // Gather feedback from Linear initiative and linked resources
    const initiativeFeedback = await gatherInitiativeFeedback();

    // Calculate feedback by contributor
    const feedbackByContributor: Record<string, number> = {};
    for (const comment of initiativeFeedback.comments) {
      const author = comment.author;
      feedbackByContributor[author] = (feedbackByContributor[author] || 0) + 1;
    }
    const feedbackByContributorChart = Object.entries(feedbackByContributor)
      .map(([author, count]) => ({ label: author.split(' ')[0], value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Calculate feedback by platform
    const feedbackByPlatform: Record<string, number> = {};
    for (const comment of initiativeFeedback.comments) {
      feedbackByPlatform[comment.platform] = (feedbackByPlatform[comment.platform] || 0) + 1;
    }
    const feedbackByPlatformChart = Object.entries(feedbackByPlatform)
      .map(([platform, count]) => ({ label: platform, value: count }))
      .sort((a, b) => b.value - a.value);

    const response = {
      period,
      generated: new Date().toLocaleString(),
      metrics: {
        totalCommits,
        prsMerged,
        prsOpen,
        contributors: contributors.length,
      },
      charts: {
        commitsByContributor,
        commitsByRepo,
      },
      contributors: contributors.slice(0, 10),
      repos: repoStats.sort((a, b) => b.commits - a.commits),
      openPRs: openPRs.slice(0, 10),
      recentCommits: recentCommits.slice(0, 30),
      warnings: prsOpen > 5 ? [`${prsOpen} PRs are currently open`] : [],
      // Work insights - what is being built
      workInsights: {
        summary: workInsights.summary,
        teamFocus: workInsights.teamFocus,
        contributorWork: workInsights.contributorWork.slice(0, 8).map(c => ({
          name: c.name,
          focus: c.focus,
          keyChanges: c.keyChanges,
          domains: c.domains,
          activeBranches: c.activeBranches,
          lastActive: c.lastActive,
        })),
        keyInitiatives: workInsights.keyInitiatives,
        activeBranches: workInsights.activeBranches,
      },
      // Team health from commit message analysis
      teamHealth: {
        sentiment: teamHealth.overallSentiment,
        sentimentScore: teamHealth.sentimentScore,
        burnoutRisk: teamHealth.burnoutRisk,
        lateNightCommits: teamHealth.lateNightCommits,
        weekendCommits: teamHealth.weekendCommits,
        breakingChanges: teamHealth.breakingChanges,
        blockers: teamHealth.topBlockers,
        achievements: teamHealth.topAchievements,
        commitTypes: teamHealth.commitTypeBreakdown,
        insights: healthInsights,
      },
      // Cross-platform feedback from Linear initiative and linked resources
      feedback: {
        totalComments: initiativeFeedback.comments.length,
        pendingCount: initiativeFeedback.comments.filter(c => c.isPending).length,
        comments: initiativeFeedback.comments,
        pending: initiativeFeedback.comments.filter(c => c.isPending),
        quickLinks: {
          ...initiativeFeedback.quickLinks,
          github: initiativeFeedback.quickLinks.github || 'https://github.com/notifications',
        },
        initiativeName: initiativeFeedback.initiativeName,
        // Charts for feedback breakdown
        byContributor: feedbackByContributorChart,
        byPlatform: feedbackByPlatformChart,
      },
    };

    // Add cache control headers - no caching on refresh
    const headers: HeadersInit = {
      'X-Data-Freshness': isRefresh ? 'fresh' : 'normal',
    };

    if (isRefresh) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
