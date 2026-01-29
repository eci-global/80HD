#!/usr/bin/env python3
"""Generate team activity report as HTML.

This script gathers activity from GitHub and Azure DevOps repositories
and generates an HTML report suitable for email delivery.

Usage:
    python generate-report.py [--days N] [--output PATH]

Environment:
    GITHUB_TOKEN or GH_TOKEN - GitHub authentication
    AZURE_CREDENTIALS - Azure service principal (optional)
"""

import json
import subprocess
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# Configuration - modify these to match your repos
GITHUB_ORG = "ECI-Global"
GITHUB_REPOS = [
    {"pattern": "one-cloud", "match_type": "contains"},
    {"pattern": "firehydrant", "match_type": "contains"},
    {"name": "core-logics", "match_type": "exact"},
    {"pattern": "iac", "match_type": "contains"},
    {"name": "coralogix", "match_type": "exact"},
]

ADO_REPOS = [
    {
        "org": "https://dev.azure.com/Cloud-Delivery",
        "project": "spruce",
        "repo": "spruce"
    }
]


def run_cmd(cmd: str) -> dict | list | str | None:
    """Run a shell command and return JSON output."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return result.stdout


def get_github_repos() -> list[str]:
    """Find GitHub repos matching our patterns."""
    repos = run_cmd(f"gh repo list {GITHUB_ORG} --json name,nameWithOwner --limit 100")
    if not repos or not isinstance(repos, list):
        return []

    matching = []
    for repo in repos:
        name = repo["name"].lower()
        for pattern in GITHUB_REPOS:
            if pattern.get("match_type") == "contains":
                if pattern["pattern"] in name:
                    matching.append(repo["nameWithOwner"])
                    break
            elif pattern.get("match_type") == "exact":
                if name == pattern["name"]:
                    matching.append(repo["nameWithOwner"])
                    break
    return matching


def get_github_commits(repo: str, since: datetime) -> list[dict]:
    """Get commits from a GitHub repo since a given date."""
    since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    result = run_cmd(
        f'gh api repos/{repo}/commits?since={since_str} '
        f'--jq "[.[] | {{sha: .sha[0:7], author: .commit.author.name, '
        f'date: .commit.author.date, message: (.commit.message | split(\"\\n\")[0])}}]"'
    )
    if isinstance(result, list):
        return result
    return []


def get_github_prs(repo: str, since: datetime) -> list[dict]:
    """Get pull requests from a GitHub repo."""
    result = run_cmd(
        f'gh api repos/{repo}/pulls?state=all --jq '
        f'"[.[] | {{number, title, user: .user.login, state, created_at, merged_at}}]"'
    )
    if isinstance(result, list):
        # Filter by date
        filtered = []
        for pr in result:
            created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            if created >= since.replace(tzinfo=created.tzinfo):
                filtered.append(pr)
            elif pr.get("merged_at"):
                merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                if merged >= since.replace(tzinfo=merged.tzinfo):
                    filtered.append(pr)
        return filtered
    return []


def get_ado_commits(repo_config: dict, since: datetime) -> list[dict]:
    """Get commits from Azure DevOps."""
    org = repo_config["org"]
    project = repo_config["project"]
    repo = repo_config["repo"]

    result = run_cmd(
        f'az repos commit list --organization {org} '
        f'--project {project} --repository {repo} --top 100 --output json'
    )
    if isinstance(result, list):
        # Filter by date
        filtered = []
        for commit in result:
            date_str = commit.get("author", {}).get("date", "")
            if date_str:
                commit_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                if commit_date >= since.replace(tzinfo=commit_date.tzinfo):
                    filtered.append({
                        "sha": commit.get("commitId", "")[:7],
                        "author": commit.get("author", {}).get("name", "Unknown"),
                        "date": date_str,
                        "message": commit.get("comment", "").split("\n")[0]
                    })
        return filtered
    return []


def get_ado_prs(repo_config: dict, since: datetime) -> list[dict]:
    """Get pull requests from Azure DevOps."""
    org = repo_config["org"]
    project = repo_config["project"]
    repo = repo_config["repo"]

    result = run_cmd(
        f'az repos pr list --organization {org} '
        f'--project {project} --repository {repo} --status all --top 50 --output json'
    )
    if isinstance(result, list):
        # Filter and transform
        filtered = []
        for pr in result:
            created = pr.get("creationDate", "")
            if created:
                created_date = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if created_date >= since.replace(tzinfo=created_date.tzinfo):
                    filtered.append({
                        "number": pr.get("pullRequestId"),
                        "title": pr.get("title"),
                        "user": pr.get("createdBy", {}).get("displayName"),
                        "state": pr.get("status"),
                        "created_at": created,
                        "merged_at": pr.get("closedDate") if pr.get("status") == "completed" else None
                    })
        return filtered
    return []


def aggregate_data(github_data: dict, ado_data: dict) -> dict:
    """Aggregate all data into a summary structure."""
    all_data = {
        "total_commits": 0,
        "prs_merged": 0,
        "prs_open": 0,
        "contributors": [],
        "repos": [],
        "warnings": []
    }

    contributor_stats = defaultdict(lambda: {"commits": 0, "prs_merged": 0, "prs_open": 0})

    # Process GitHub data
    for repo_name, data in github_data.items():
        commits = data.get("commits", [])
        prs = data.get("prs", [])

        all_data["repos"].append({
            "name": repo_name.split("/")[-1],
            "platform": "GitHub",
            "commits": len(commits),
            "prs": len(prs)
        })

        all_data["total_commits"] += len(commits)

        for commit in commits:
            author = commit.get("author", "Unknown")
            contributor_stats[author]["commits"] += 1

        for pr in prs:
            user = pr.get("user", "Unknown")
            if pr.get("merged_at"):
                contributor_stats[user]["prs_merged"] += 1
                all_data["prs_merged"] += 1
            elif pr.get("state") == "open":
                contributor_stats[user]["prs_open"] += 1
                all_data["prs_open"] += 1

    # Process Azure DevOps data
    for repo_name, data in ado_data.items():
        commits = data.get("commits", [])
        prs = data.get("prs", [])

        all_data["repos"].append({
            "name": repo_name,
            "platform": "ADO",
            "commits": len(commits),
            "prs": len(prs)
        })

        all_data["total_commits"] += len(commits)

        for commit in commits:
            author = commit.get("author", "Unknown")
            contributor_stats[author]["commits"] += 1

        for pr in prs:
            user = pr.get("user", "Unknown")
            if pr.get("merged_at"):
                contributor_stats[user]["prs_merged"] += 1
                all_data["prs_merged"] += 1
            elif pr.get("state") in ["active", "open"]:
                contributor_stats[user]["prs_open"] += 1
                all_data["prs_open"] += 1

    # Convert contributor stats to list
    all_data["contributors"] = [
        {"name": name, **stats}
        for name, stats in sorted(
            contributor_stats.items(),
            key=lambda x: x[1]["commits"],
            reverse=True
        )
    ]

    # Check for stale PRs
    if all_data["prs_open"] > 3:
        all_data["warnings"].append(f"{all_data['prs_open']} PRs are currently open")

    return all_data


def generate_html(data: dict, days: int) -> str:
    """Generate HTML report from aggregated data."""
    today = datetime.now().strftime("%B %d, %Y")
    period = "24 hours" if days == 1 else f"{days} days"

    contributors_html = "".join(
        f"<tr><td>{c['name']}</td><td>{c['commits']}</td>"
        f"<td>{c['prs_merged']}</td><td>{c['prs_open']}</td></tr>"
        for c in data['contributors']
    )

    repos_html = "".join(
        f"<tr><td>{r['name']}</td>"
        f"<td><span class='tag tag-{r['platform'].lower()}'>{r['platform']}</span></td>"
        f"<td>{r['commits']}</td><td>{r['prs']}</td></tr>"
        for r in data['repos']
    )

    warnings_html = ""
    if data['warnings']:
        warnings_html = "<h2>Attention Needed</h2>" + "".join(
            f"<div class='warning'>⚠️ {w}</div>" for w in data['warnings']
        )

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Team Activity Report - {today}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fafafa;
            color: #1a1a2e;
        }}
        h1 {{
            color: #1a1a2e;
            border-bottom: 2px solid #4a4a8a;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #4a4a8a;
            margin-top: 30px;
        }}
        .summary {{
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }}
        .summary-item {{
            flex: 1;
            min-width: 100px;
            text-align: center;
        }}
        .summary-value {{
            font-size: 32px;
            font-weight: bold;
            color: #1a1a2e;
        }}
        .summary-label {{
            color: #666;
            font-size: 14px;
            margin-top: 4px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        th, td {{
            text-align: left;
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #f5f5f7;
            font-weight: 600;
            color: #4a4a8a;
        }}
        tr:last-child td {{
            border-bottom: none;
        }}
        .warning {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 10px 0;
        }}
        .tag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }}
        .tag-github {{
            background: #e1e4e8;
            color: #24292e;
        }}
        .tag-ado {{
            background: #0078d4;
            color: white;
        }}
        .footer {{
            color: #666;
            font-size: 12px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }}
    </style>
</head>
<body>
    <h1>Team Activity Report</h1>
    <p style="color: #666;">{today} • Last {period}</p>

    <div class="summary">
        <div class="summary-item">
            <div class="summary-value">{data['total_commits']}</div>
            <div class="summary-label">Commits</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{data['prs_merged']}</div>
            <div class="summary-label">PRs Merged</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{data['prs_open']}</div>
            <div class="summary-label">PRs Open</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">{len(data['contributors'])}</div>
            <div class="summary-label">Contributors</div>
        </div>
    </div>

    <h2>Team Activity</h2>
    <table>
        <tr>
            <th>Contributor</th>
            <th>Commits</th>
            <th>PRs Merged</th>
            <th>PRs Open</th>
        </tr>
        {contributors_html}
    </table>

    <h2>Repository Activity</h2>
    <table>
        <tr>
            <th>Repository</th>
            <th>Platform</th>
            <th>Commits</th>
            <th>PRs</th>
        </tr>
        {repos_html}
    </table>

    {warnings_html}

    <div class="footer">
        <p>
            Generated automatically by the github-activity-summary skill.<br>
            Report period: Last {period}
        </p>
    </div>
</body>
</html>"""
    return html


def main():
    parser = argparse.ArgumentParser(description="Generate team activity report")
    parser.add_argument("--days", type=int, default=1, help="Number of days to look back (default: 1)")
    parser.add_argument("--output", type=str, default="/tmp/team-activity-report.html",
                        help="Output file path")
    args = parser.parse_args()

    since = datetime.utcnow() - timedelta(days=args.days)
    print(f"Generating report for last {args.days} day(s)...")

    # Gather GitHub data
    github_data = {}
    github_repos = get_github_repos()
    print(f"Found {len(github_repos)} matching GitHub repos")

    for repo in github_repos:
        print(f"  Fetching {repo}...")
        github_data[repo] = {
            "commits": get_github_commits(repo, since),
            "prs": get_github_prs(repo, since)
        }

    # Gather Azure DevOps data
    ado_data = {}
    for repo_config in ADO_REPOS:
        repo_name = repo_config["repo"]
        print(f"  Fetching {repo_name} (Azure DevOps)...")
        ado_data[repo_name] = {
            "commits": get_ado_commits(repo_config, since),
            "prs": get_ado_prs(repo_config, since)
        }

    # Aggregate and generate report
    aggregated = aggregate_data(github_data, ado_data)
    html = generate_html(aggregated, args.days)

    # Write output
    output_path = Path(args.output)
    output_path.write_text(html)
    print(f"\nReport generated: {output_path}")
    print(f"  Total commits: {aggregated['total_commits']}")
    print(f"  PRs merged: {aggregated['prs_merged']}")
    print(f"  PRs open: {aggregated['prs_open']}")
    print(f"  Contributors: {len(aggregated['contributors'])}")


if __name__ == "__main__":
    main()
