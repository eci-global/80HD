#!/usr/bin/env python3
"""Send the generated report via email.

Supports multiple email providers:
- SendGrid (default)
- Mailgun
- AWS SES

Usage:
    python send-email.py [--provider sendgrid|mailgun|ses] [--report PATH]

Environment variables:
    EMAIL_RECIPIENTS - Comma-separated list of recipient emails
    EMAIL_FROM - Sender email address (default: reports@yourcompany.com)

    For SendGrid:
        SENDGRID_API_KEY - SendGrid API key

    For Mailgun:
        MAILGUN_API_KEY - Mailgun API key
        MAILGUN_DOMAIN - Mailgun domain

    For AWS SES:
        AWS_ACCESS_KEY_ID - AWS access key
        AWS_SECRET_ACCESS_KEY - AWS secret key
        AWS_REGION - AWS region (default: us-east-1)
"""

import os
import argparse
from datetime import datetime
from pathlib import Path


def send_via_sendgrid(html_content: str, recipients: list[str], from_email: str, subject: str):
    """Send email via SendGrid."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, Content, To
    except ImportError:
        print("SendGrid not installed. Run: pip install sendgrid")
        return False

    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        print("SENDGRID_API_KEY environment variable not set")
        return False

    message = Mail(
        from_email=Email(from_email, "Team Activity Bot"),
        to_emails=[To(email.strip()) for email in recipients],
        subject=subject,
        html_content=Content("text/html", html_content)
    )

    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        print(f"SendGrid: Email sent (status {response.status_code})")
        return response.status_code == 202
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False


def send_via_mailgun(html_content: str, recipients: list[str], from_email: str, subject: str):
    """Send email via Mailgun."""
    try:
        import requests
    except ImportError:
        print("Requests not installed. Run: pip install requests")
        return False

    api_key = os.environ.get("MAILGUN_API_KEY")
    domain = os.environ.get("MAILGUN_DOMAIN")

    if not api_key or not domain:
        print("MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables required")
        return False

    try:
        response = requests.post(
            f"https://api.mailgun.net/v3/{domain}/messages",
            auth=("api", api_key),
            data={
                "from": f"Team Activity Bot <{from_email}>",
                "to": recipients,
                "subject": subject,
                "html": html_content
            }
        )
        print(f"Mailgun: Email sent (status {response.status_code})")
        return response.status_code == 200
    except Exception as e:
        print(f"Mailgun error: {e}")
        return False


def send_via_ses(html_content: str, recipients: list[str], from_email: str, subject: str):
    """Send email via AWS SES."""
    try:
        import boto3
    except ImportError:
        print("Boto3 not installed. Run: pip install boto3")
        return False

    region = os.environ.get("AWS_REGION", "us-east-1")

    try:
        ses = boto3.client("ses", region_name=region)
        response = ses.send_email(
            Source=from_email,
            Destination={"ToAddresses": recipients},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Html": {"Data": html_content}}
            }
        )
        print(f"SES: Email sent (MessageId: {response['MessageId']})")
        return True
    except Exception as e:
        print(f"SES error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Send team activity report via email")
    parser.add_argument(
        "--provider",
        choices=["sendgrid", "mailgun", "ses"],
        default="sendgrid",
        help="Email provider to use (default: sendgrid)"
    )
    parser.add_argument(
        "--report",
        type=str,
        default="/tmp/team-activity-report.html",
        help="Path to the HTML report file"
    )
    args = parser.parse_args()

    # Get recipients
    recipients_str = os.environ.get("EMAIL_RECIPIENTS", "")
    if not recipients_str:
        print("EMAIL_RECIPIENTS environment variable not set")
        print("Set it to a comma-separated list of email addresses")
        return 1

    recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]
    if not recipients:
        print("No valid recipients found")
        return 1

    # Get sender
    from_email = os.environ.get("EMAIL_FROM", "reports@yourcompany.com")

    # Read report
    report_path = Path(args.report)
    if not report_path.exists():
        print(f"Report not found: {report_path}")
        print("Run generate-report.py first")
        return 1

    html_content = report_path.read_text()

    # Generate subject
    subject = f"Team Activity Report - {datetime.now().strftime('%B %d, %Y')}"

    # Send email
    print(f"Sending report to {len(recipients)} recipient(s) via {args.provider}...")

    providers = {
        "sendgrid": send_via_sendgrid,
        "mailgun": send_via_mailgun,
        "ses": send_via_ses
    }

    success = providers[args.provider](html_content, recipients, from_email, subject)

    if success:
        print("Email sent successfully!")
        return 0
    else:
        print("Failed to send email")
        return 1


if __name__ == "__main__":
    exit(main())
