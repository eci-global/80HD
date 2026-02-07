# Email Composition Examples

Common email scenarios with step-by-step flows.

## Simple Email with Formatting

**User Request:**
```
Email john@acme.com about the project kickoff meeting tomorrow at 2pm
```

**Parsed:**
- To: john@acme.com
- Subject: Project Kickoff Meeting
- Body: Meeting tomorrow at 2pm

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Project Kickoff Meeting"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi John,</p><p>I wanted to confirm our project kickoff meeting scheduled for tomorrow at 2:00 PM.</p><p>Please let me know if this time still works for you.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"John", address:"john@acme.com"}}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** John <john@acme.com>
**Subject:** Project Kickoff Meeting

The draft is open in Outlook. Review and send when ready.
```

---

## Email with Attachments

**User Request:**
```
Send the quarterly report to sarah@finance.com with the attached Q4-report.xlsx
```

**Parsed:**
- To: sarah@finance.com
- Subject: Quarterly Report
- Body: Sharing the quarterly report
- Attachments: Q4-report.xlsx

**Validation Step:**
```bash
ls -la ~/Documents/Q4-report.xlsx
# -rw-r--r--  1 user  staff  45678 Jan 15 10:30 /Users/user/Documents/Q4-report.xlsx
```

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Quarterly Report"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi Sarah,</p><p>Please find attached the quarterly report for your review.</p><p>Let me know if you have any questions.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Sarah", address:"sarah@finance.com"}}
    make new attachment at theMsg with properties {file:POSIX file "/Users/user/Documents/Q4-report.xlsx"}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** Sarah <sarah@finance.com>
**Subject:** Quarterly Report
**Attachments:** Q4-report.xlsx (45 KB)

The draft is open in Outlook. Review and send when ready.
```

---

## Vendor Request Email

**User Request:**
```
Email our vendor at orders@supplier.com requesting pricing for 500 units of SKU-1234.
Include that we need delivery by March 15th and prefer NET-30 terms.
CC our procurement team at procurement@company.com
```

**Parsed:**
- To: orders@supplier.com
- CC: procurement@company.com
- Subject: Pricing Request - SKU-1234 (500 Units)
- Body: Structured request with requirements

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Pricing Request - SKU-1234 (500 Units)"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hello,</p><p>We would like to request pricing for the following order:</p><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Order Details</h3><ul style=\"margin: 10px 0; padding-left: 20px;\"><li><strong>SKU:</strong> SKU-1234</li><li><strong>Quantity:</strong> 500 units</li><li><strong>Required Delivery:</strong> March 15, 2026</li><li><strong>Payment Terms:</strong> NET-30 preferred</li></ul><p>Please provide a quote at your earliest convenience.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Supplier Orders", address:"orders@supplier.com"}}
    make new cc recipient at theMsg with properties {email address:{name:"Procurement Team", address:"procurement@company.com"}}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** Supplier Orders <orders@supplier.com>
**CC:** Procurement Team <procurement@company.com>
**Subject:** Pricing Request - SKU-1234 (500 Units)

The draft is open in Outlook. Review and send when ready.
```

---

## Status Update Email

**User Request:**
```
Send a status update to the team (team@company.com) about the API migration.
We're 75% complete, on track for the Feb 15 deadline. Blockers: waiting on DB team
for schema approval. Next steps: complete testing and documentation.
```

**Parsed:**
- To: team@company.com
- Subject: API Migration Status Update
- Body: Structured status with progress, blockers, next steps

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"API Migration Status Update"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi Team,</p><p>Here's the latest status update on the API migration project.</p><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Progress</h3><ul style=\"margin: 10px 0; padding-left: 20px;\"><li><strong>Completion:</strong> 75%</li><li><strong>Target Date:</strong> February 15, 2026</li><li><strong>Status:</strong> On Track</li></ul><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Blockers</h3><ul style=\"margin: 10px 0; padding-left: 20px;\"><li>Waiting on DB team for schema approval</li></ul><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Next Steps</h3><ol style=\"margin: 10px 0; padding-left: 20px;\"><li>Complete testing</li><li>Finalize documentation</li></ol><p>Please reach out if you have any questions.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Team", address:"team@company.com"}}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** Team <team@company.com>
**Subject:** API Migration Status Update

The draft is open in Outlook. Review and send when ready.
```

---

## Multi-Recipient Email

**User Request:**
```
Send meeting notes to Alice (alice@company.com), Bob (bob@company.com),
and CC our manager Carol (carol@company.com).
Subject: Sprint Planning Notes - Feb 5
Include decisions: prioritized backlog items 1-5, assigned owners, set sprint goal
to "Complete user authentication flow"
```

**Parsed:**
- To: alice@company.com, bob@company.com
- CC: carol@company.com
- Subject: Sprint Planning Notes - Feb 5
- Body: Meeting decisions with structure

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Sprint Planning Notes - Feb 5"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi All,</p><p>Here are the notes from today's sprint planning session.</p><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Sprint Goal</h3><p><strong>Complete user authentication flow</strong></p><h3 style=\"color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;\">Decisions</h3><ul style=\"margin: 10px 0; padding-left: 20px;\"><li>Prioritized backlog items 1-5 for this sprint</li><li>Assigned owners to each item</li><li>Committed to sprint goal</li></ul><p>Please review and let me know if I missed anything.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Alice", address:"alice@company.com"}}
    make new to recipient at theMsg with properties {email address:{name:"Bob", address:"bob@company.com"}}
    make new cc recipient at theMsg with properties {email address:{name:"Carol", address:"carol@company.com"}}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** Alice <alice@company.com>, Bob <bob@company.com>
**CC:** Carol <carol@company.com>
**Subject:** Sprint Planning Notes - Feb 5

The draft is open in Outlook. Review and send when ready.
```

---

## Email with Table Data

**User Request:**
```
Email finance@company.com with the expense breakdown:
Travel: $1,200, Equipment: $3,500, Software: $800, Training: $500
Subject: Q4 Expense Report Summary
```

**Parsed:**
- To: finance@company.com
- Subject: Q4 Expense Report Summary
- Body: Table with expense data

**Generated AppleScript:**
```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Q4 Expense Report Summary"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi,</p><p>Please find below the Q4 expense breakdown:</p><table style=\"border-collapse: collapse; margin: 15px 0; width: 100%;\"><tr style=\"background-color: #f5f5f5;\"><th style=\"border: 1px solid #ddd; padding: 8px; text-align: left;\">Category</th><th style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">Amount</th></tr><tr><td style=\"border: 1px solid #ddd; padding: 8px;\">Travel</td><td style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">$1,200</td></tr><tr><td style=\"border: 1px solid #ddd; padding: 8px;\">Equipment</td><td style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">$3,500</td></tr><tr><td style=\"border: 1px solid #ddd; padding: 8px;\">Software</td><td style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">$800</td></tr><tr><td style=\"border: 1px solid #ddd; padding: 8px;\">Training</td><td style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">$500</td></tr><tr style=\"background-color: #f5f5f5; font-weight: bold;\"><td style=\"border: 1px solid #ddd; padding: 8px;\">Total</td><td style=\"border: 1px solid #ddd; padding: 8px; text-align: right;\">$6,000</td></tr></table><p>Let me know if you need any additional details.</p><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Finance", address:"finance@company.com"}}
    open theMsg
end tell
```

**Output:**
```
✓ Email draft created in Outlook

**To:** Finance <finance@company.com>
**Subject:** Q4 Expense Report Summary

The draft is open in Outlook. Review and send when ready.
```

---

## Formal Business Email

**User Request:**
```
Draft a formal email to the CEO (ceo@company.com) requesting approval
for the $50,000 infrastructure upgrade. Include ROI: 40% cost reduction,
improved uptime from 99.5% to 99.99%, and 3-month payback period.
```

**Parsed:**
- To: ceo@company.com
- Subject: Request for Approval: Infrastructure Upgrade ($50,000)
- Body: Formal structure with business justification

**Generated HTML Body:**
```html
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             font-size: 14px; line-height: 1.6; color: #333;">

<p>Dear [CEO Name],</p>

<p>I am writing to request your approval for an infrastructure upgrade investment
of $50,000. This proposal has been reviewed by the IT and Finance teams.</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Business Justification</h3>

<table style="border-collapse: collapse; margin: 15px 0;">
  <tr>
    <td style="padding: 8px 16px 8px 0;"><strong>Investment:</strong></td>
    <td style="padding: 8px 0;">$50,000</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px 8px 0;"><strong>Cost Reduction:</strong></td>
    <td style="padding: 8px 0;">40%</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px 8px 0;"><strong>Uptime Improvement:</strong></td>
    <td style="padding: 8px 0;">99.5% → 99.99%</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px 8px 0;"><strong>Payback Period:</strong></td>
    <td style="padding: 8px 0;">3 months</td>
  </tr>
</table>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Recommendation</h3>

<p>Given the strong ROI and short payback period, I recommend proceeding with
this investment at your earliest convenience.</p>

<p>I am happy to provide additional details or schedule a meeting to discuss further.</p>

<p>Respectfully,<br>
[Your Name]<br>
[Your Title]</p>

</body>
</html>
```

**Output:**
```
✓ Email draft created in Outlook

**To:** CEO <ceo@company.com>
**Subject:** Request for Approval: Infrastructure Upgrade ($50,000)

The draft is open in Outlook. Review and send when ready.
```
