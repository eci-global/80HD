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

// Contributor name normalization - maps various usernames/display names to a canonical name
// Keys are lowercase patterns to match, values are the canonical display name
const CONTRIBUTOR_ALIASES: Record<string, string> = {
  // Rick Clemens
  'rclemens-eci': 'Rick Clemens',
  'rclemens': 'Rick Clemens',
  'r clemens': 'Rick Clemens',
  'rick clemens': 'Rick Clemens',

  // Blaze Lewis
  'git-blazelewis': 'Blaze Lewis',
  'blazelewis': 'Blaze Lewis',
  'bllewis': 'Blaze Lewis',
  'blewis': 'Blaze Lewis',
  'blaze lewis': 'Blaze Lewis',

  // Sean Wilson
  'sewilson-eci': 'Sean Wilson',
  'sewilson': 'Sean Wilson',
  'swilson-eci': 'Sean Wilson',
  'swilson': 'Sean Wilson',
  'sean wilson': 'Sean Wilson',

  // Travis Edgar
  'rustyautopsy': 'Travis Edgar',
  'travis edgar': 'Travis Edgar',
  'tedgar': 'Travis Edgar',

  // Michael Ezzell
  'michael ezzell': 'Michael Ezzell',
  'mezzell': 'Michael Ezzell',

  // Jeff Harris
  'jeharris-eci': 'Jeff Harris',
  'jeharris': 'Jeff Harris',
  'jeff harris': 'Jeff Harris',

  // Mike Petersen
  'mipetersen-eci': 'Mike Petersen',
  'mipetersen': 'Mike Petersen',
  'mike petersen': 'Mike Petersen',
};

// Normalize a contributor name using the alias map
function normalizeContributor(name: string): string {
  if (!name) return 'Unknown';

  const lowerName = name.toLowerCase().trim();

  // Direct match
  if (CONTRIBUTOR_ALIASES[lowerName]) {
    return CONTRIBUTOR_ALIASES[lowerName];
  }

  // Partial match - check if any alias pattern is contained in the name
  for (const [pattern, canonical] of Object.entries(CONTRIBUTOR_ALIASES)) {
    if (lowerName.includes(pattern) || pattern.includes(lowerName)) {
      return canonical;
    }
  }

  // No match - return original name with title case
  return name;
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

interface ContributorWork {
  name: string;
  focus: string[];           // Main areas they're working on
  keyChanges: string[];      // Specific things they built/changed
  domains: string[];         // Technical domains touched
  commits: number;
  prs: number;
}

interface WorkInsights {
  contributorWork: ContributorWork[];
  teamFocus: { domain: string; count: number; examples: string[] }[];
  keyInitiatives: string[];
  summary: string;
}

function analyzeWorkIntent(commits: any[], prs: any[], contributors: any[]): WorkInsights {
  const contributorDetails: Record<string, {
    changes: string[];
    domains: Set<string>;
    commits: number;
    prs: number;
  }> = {};

  const domainCounts: Record<string, { count: number; examples: string[] }> = {};
  const allChanges: { message: string; author: string; repo: string }[] = [];

  // Analyze each commit
  for (const commit of commits) {
    const author = commit.author;
    const message = commit.message;

    if (!contributorDetails[author]) {
      contributorDetails[author] = { changes: [], domains: new Set(), commits: 0, prs: 0 };
    }
    contributorDetails[author].commits++;

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
      contributorDetails[author].changes.push(changeDesc);
      allChanges.push({ message: changeDesc, author, repo: commit.repo });
    }

    // Identify domains
    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (pattern.test(message)) {
        contributorDetails[author].domains.add(domain);
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
      contributorDetails[author] = { changes: [], domains: new Set(), commits: 0, prs: 0 };
    }
    contributorDetails[author].prs++;

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

    // Determine primary focus areas based on most common words
    const focus = determineFocus(details.changes);

    contributorWork.push({
      name,
      focus,
      keyChanges: uniqueChanges,
      domains: Array.from(details.domains),
      commits: details.commits,
      prs: details.prs,
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

  // Generate a natural language summary
  const summary = generateSummary(contributorWork, teamFocus, keyInitiatives);

  return { contributorWork, teamFocus, keyInitiatives, summary };
}

function determineFocus(changes: string[]): string[] {
  const wordCounts: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'from', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'pr', 'merge', 'branch', 'commit', 'update', 'fix', 'add']);

  for (const change of changes) {
    const words = change.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
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
      const commits = await runCommand(
        `gh api "repos/${repo}/commits?sha=${branch}&since=${since}&per_page=100" --jq '[.[] | {sha: .sha[0:7], fullSha: .sha, author: .commit.author.name, date: .commit.author.date, message: (.commit.message | split("\\n")[0]), branch: "${branch}"}]'`
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
              message: (commit.comment || '').split('\n')[0],
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

        recentCommits.push({
          sha: commit.sha,
          author: author,
          message: commit.message,
          repo: repoName,
          date: new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

        recentCommits.push({
          sha: commit.sha,
          author: author,
          message: commit.message,
          repo: `${repoName} (ADO)`,
          date: new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
      recentCommits: recentCommits.slice(0, 15),
      warnings: prsOpen > 5 ? [`${prsOpen} PRs are currently open`] : [],
      // Work insights - what is being built
      workInsights: {
        summary: workInsights.summary,
        teamFocus: workInsights.teamFocus,
        contributorWork: workInsights.contributorWork.slice(0, 6).map(c => ({
          name: c.name,
          focus: c.focus,
          keyChanges: c.keyChanges,
          domains: c.domains,
        })),
        keyInitiatives: workInsights.keyInitiatives,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
