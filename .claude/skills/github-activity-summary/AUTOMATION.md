# Automation: Daily Email Reports

This document explains how to set up automated daily email reports summarizing team activity.

## Overview

The automation system:
1. Runs on a schedule (daily at 8 AM)
2. Generates an HTML report of the last 24 hours
3. Sends the report via email to configured recipients

## Architecture Options

### Option 1: GitHub Actions (Recommended)

Best for teams already using GitHub. Free for public repos, included minutes for private repos.

### Option 2: AWS Lambda + EventBridge

Best for teams with AWS infrastructure. More customizable, pay-per-use pricing.

### Option 3: Azure Functions + Logic Apps

Best for teams already in Azure ecosystem. Integrates well with Azure DevOps.

---

## GitHub Actions Setup

### Step 1: Create the Workflow

Create `.github/workflows/team-activity-report.yml`:

```yaml
name: Daily Team Activity Report

on:
  schedule:
    # Run at 8 AM EST (13:00 UTC) Monday-Friday
    - cron: '0 13 * * 1-5'
  workflow_dispatch: # Allow manual trigger

jobs:
  generate-report:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup GitHub CLI
        run: |
          gh auth login --with-token <<< "${{ secrets.GH_PAT }}"

      - name: Setup Azure CLI
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Install dependencies
        run: |
          pip install jinja2 sendgrid python-dateutil

      - name: Generate Report
        env:
          GITHUB_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          python .claude/skills/github-activity-summary/scripts/generate-report.py

      - name: Send Email
        env:
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          EMAIL_RECIPIENTS: ${{ vars.EMAIL_RECIPIENTS }}
        run: |
          python .claude/skills/github-activity-summary/scripts/send-email.py
```

### Step 2: Configure Secrets

In your repo settings (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `GH_PAT` | GitHub Personal Access Token with `repo` scope |
| `AZURE_CREDENTIALS` | Azure service principal JSON (see below) |
| `SENDGRID_API_KEY` | SendGrid API key for email delivery |

| Variable | Description |
|----------|-------------|
| `EMAIL_RECIPIENTS` | Comma-separated email addresses |

### Step 3: Create Azure Credentials

```bash
az ad sp create-for-rbac --name "team-activity-report" \
  --role "Reader" \
  --scopes /subscriptions/{subscription-id} \
  --sdk-auth
```

Copy the JSON output to the `AZURE_CREDENTIALS` secret.

---

## Report Generation Script

Create `.claude/skills/github-activity-summary/scripts/generate-report.py`:

```python
#!/usr/bin/env python3
"""Generate team activity report as HTML."""

import json
import subprocess
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# Configuration
GITHUB_REPOS = [
    {"pattern": "one-cloud", "match_type": "contains"},
    {"name": "fire-hydrant", "match_type": "exact"},
    {"name": "core-logics", "match_type": "exact"},
    {"name": "iac", "match_type": "exact"},
]

ADO_REPOS = [
    {
        "org": "https://dev.azure.com/Cloud-Delivery",
        "project": "spruce",
        "repo": "spruce"
    }
]

def run_cmd(cmd):
    """Run a shell command and return JSON output."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return result.stdout

def get_github_repos():
    """Find GitHub repos matching our patterns."""
    repos = run_cmd("gh repo list --json name,nameWithOwner --limit 100")
    if not repos:
        return []

    matching = []
    for repo in repos:
        name = repo["name"].lower()
        for pattern in GITHUB_REPOS:
            if pattern.get("match_type") == "contains":
                if pattern["pattern"] in name:
                    matching.append(repo["nameWithOwner"])
            elif pattern.get("match_type") == "exact":
                if name == pattern["name"]:
                    matching.append(repo["nameWithOwner"])
    return matching

def get_github_activity(repo, since):
    """Get commits and PRs from a GitHub repo."""
    since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")

    commits = run_cmd(f'gh api repos/{repo}/commits?since={since_str} --jq ".[] | {{sha: .sha[0:7], author: .commit.author.name, date: .commit.author.date, message: .commit.message | split(\\"\\n\\")[0]}}"')

    prs = run_cmd(f'gh api repos/{repo}/pulls?state=all --jq ".[] | {{number, title, user: .user.login, state, created_at, merged_at}}"')

    return {"commits": commits or [], "prs": prs or []}

def get_ado_activity(repo_config, since):
    """Get commits and PRs from Azure DevOps."""
    org = repo_config["org"]
    project = repo_config["project"]
    repo = repo_config["repo"]

    commits = run_cmd(f'az repos commit list --organization {org} --project {project} --repository {repo} --top 50 --output json')

    prs = run_cmd(f'az repos pr list --organization {org} --project {project} --repository {repo} --status all --top 50 --output json')

    return {"commits": commits or [], "prs": prs or []}

def generate_html(data):
    """Generate HTML report from aggregated data."""
    today = datetime.now().strftime("%B %d, %Y")

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #1a1a2e; border-bottom: 2px solid #4a4a8a; padding-bottom: 10px; }}
        h2 {{ color: #4a4a8a; margin-top: 30px; }}
        .summary {{ background: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .summary-item {{ display: inline-block; margin-right: 40px; }}
        .summary-value {{ font-size: 24px; font-weight: bold; color: #1a1a2e; }}
        .summary-label {{ color: #666; font-size: 14px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ text-align: left; padding: 12px; border-bottom: 1px solid #eee; }}
        th {{ background: #f5f5f7; font-weight: 600; }}
        .warning {{ background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }}
        .tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }}
        .tag-github {{ background: #e1e4e8; }}
        .tag-ado {{ background: #0078d4; color: white; }}
    </style>
</head>
<body>
    <h1>Team Activity Report - {today}</h1>

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
        <tr><th>Contributor</th><th>Commits</th><th>PRs Merged</th><th>PRs Open</th></tr>
        {"".join(f"<tr><td>{c['name']}</td><td>{c['commits']}</td><td>{c['prs_merged']}</td><td>{c['prs_open']}</td></tr>" for c in data['contributors'])}
    </table>

    <h2>Repository Activity</h2>
    <table>
        <tr><th>Repository</th><th>Platform</th><th>Commits</th><th>PRs</th></tr>
        {"".join(f"<tr><td>{r['name']}</td><td><span class='tag tag-{r['platform'].lower()}'>{r['platform']}</span></td><td>{r['commits']}</td><td>{r['prs']}</td></tr>" for r in data['repos'])}
    </table>

    {"<h2>Attention Needed</h2>" + "".join(f"<div class='warning'>⚠️ {w}</div>" for w in data['warnings']) if data['warnings'] else ""}

    <p style="color: #666; font-size: 12px; margin-top: 40px;">
        Generated automatically by the github-activity-summary skill.<br>
        Report period: Last 24 hours
    </p>
</body>
</html>
"""
    return html

def main():
    since = datetime.utcnow() - timedelta(days=1)

    # Gather data
    all_data = {
        "total_commits": 0,
        "prs_merged": 0,
        "prs_open": 0,
        "contributors": [],
        "repos": [],
        "warnings": []
    }

    contributor_stats = defaultdict(lambda: {"commits": 0, "prs_merged": 0, "prs_open": 0})

    # GitHub repos
    for repo in get_github_repos():
        activity = get_github_activity(repo, since)
        repo_name = repo.split("/")[-1]

        commit_count = len(activity["commits"]) if isinstance(activity["commits"], list) else 0
        pr_count = len(activity["prs"]) if isinstance(activity["prs"], list) else 0

        all_data["repos"].append({
            "name": repo_name,
            "platform": "GitHub",
            "commits": commit_count,
            "prs": pr_count
        })
        all_data["total_commits"] += commit_count

    # Azure DevOps repos
    for repo_config in ADO_REPOS:
        activity = get_ado_activity(repo_config, since)

        commit_count = len(activity["commits"]) if isinstance(activity["commits"], list) else 0
        pr_count = len(activity["prs"]) if isinstance(activity["prs"], list) else 0

        all_data["repos"].append({
            "name": repo_config["repo"],
            "platform": "ADO",
            "commits": commit_count,
            "prs": pr_count
        })
        all_data["total_commits"] += commit_count

    # Generate HTML
    html = generate_html(all_data)

    # Save report
    output_path = Path("/tmp/team-activity-report.html")
    output_path.write_text(html)
    print(f"Report generated: {output_path}")

if __name__ == "__main__":
    main()
```

---

## Email Delivery Script

Create `.claude/skills/github-activity-summary/scripts/send-email.py`:

```python
#!/usr/bin/env python3
"""Send the generated report via SendGrid."""

import os
from pathlib import Path
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, Content, To

def main():
    api_key = os.environ.get("SENDGRID_API_KEY")
    recipients = os.environ.get("EMAIL_RECIPIENTS", "").split(",")

    if not api_key or not recipients:
        print("Missing SENDGRID_API_KEY or EMAIL_RECIPIENTS")
        return

    # Read the generated report
    report_path = Path("/tmp/team-activity-report.html")
    if not report_path.exists():
        print("Report not found")
        return

    html_content = report_path.read_text()

    # Send email
    from_email = Email("reports@yourcompany.com", "Team Activity Bot")
    to_emails = [To(email.strip()) for email in recipients if email.strip()]

    from datetime import datetime
    subject = f"Team Activity Report - {datetime.now().strftime('%B %d, %Y')}"

    message = Mail(
        from_email=from_email,
        to_emails=to_emails,
        subject=subject,
        html_content=Content("text/html", html_content)
    )

    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        print(f"Email sent: {response.status_code}")
    except Exception as e:
        print(f"Error sending email: {e}")

if __name__ == "__main__":
    main()
```

---

## Alternative: Mailgun

If you prefer Mailgun over SendGrid:

```python
import requests

def send_via_mailgun(html_content, recipients):
    return requests.post(
        f"https://api.mailgun.net/v3/{os.environ['MAILGUN_DOMAIN']}/messages",
        auth=("api", os.environ["MAILGUN_API_KEY"]),
        data={
            "from": "Team Activity Bot <reports@yourcompany.com>",
            "to": recipients,
            "subject": f"Team Activity Report - {datetime.now().strftime('%B %d, %Y')}",
            "html": html_content
        }
    )
```

---

## Alternative: AWS SES

```python
import boto3

def send_via_ses(html_content, recipients):
    ses = boto3.client('ses', region_name='us-east-1')

    return ses.send_email(
        Source='reports@yourcompany.com',
        Destination={'ToAddresses': recipients},
        Message={
            'Subject': {'Data': f"Team Activity Report - {datetime.now().strftime('%B %d, %Y')}"},
            'Body': {'Html': {'Data': html_content}}
        }
    )
```

---

## Testing

### Manual Trigger

```bash
# Trigger the workflow manually
gh workflow run team-activity-report.yml
```

### Local Testing

```bash
# Generate report locally
python .claude/skills/github-activity-summary/scripts/generate-report.py

# View the output
open /tmp/team-activity-report.html
```

---

## Troubleshooting

### Email not arriving

1. Check spam/junk folder
2. Verify SendGrid API key is valid
3. Check GitHub Actions logs for errors
4. Verify sender domain is authenticated in SendGrid

### Missing data from repos

1. Verify the GH_PAT has access to the repos
2. Check Azure credentials have Reader role
3. Review the repo patterns in generate-report.py

### Workflow not running

1. Check cron syntax at crontab.guru
2. Verify workflow is in default branch
3. Check Actions is enabled for the repo
