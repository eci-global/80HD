<!-- Discovery summary for 80HD -->
# 80HD Discovery Summary

## Persona Snapshot
- Knowledge worker with ADHD who experiences constant interruptions across Microsoft 365 (Outlook, Teams) and Slack.
- Needs confidence that critical requests are surfaced without monitoring each channel in real time.
- Primary success metric: measurable reduction in daily context switches.

## Core Jobs To Be Done
1. **Stay focused on deep-work tasks** without fear of missing urgent communication.
2. **Receive a concise daily digest** capturing requests, decisions, and follow-ups from email, Teams, and Slack.
3. **Escalate truly urgent items** through a tightly controlled channel that remains available even when Outlook/Teams are closed.

## Key Requirements & Preferences
- Desire to close or mute Outlook and Teams during focus blocks while still being reachable by 80HD.
- Trust hinges on accuracy: false negatives (missed critical items) and false positives (unnecessary interruptions) both erode adoption.
- Wants creative yet lightweight notification surface—ideally a dedicated 80HD companion channel. Initial options:
  - Minimal “Focus Pager” PWA/mobile web app delivered via Vercel with Web Push (backed by Supabase Edge Function push service).
  - SMS fail-safe (e.g., Twilio) for critical escalations until native app exists.
  - Desktop notifier (menu bar or tray) as future enhancement.
- Requires transparent explanations about why something was escalated or suppressed.

## Communication Streams & Data Points
- **Email (Outlook / Exchange Online):** sender, recipients, thread context, timestamp, subject/body, attachments metadata.
- **Microsoft Teams (chats & channels):** participants, channel context, mentions, message bodies, reactions.
- **Slack (DMs, channels, threads):** actors, channel metadata, message content, threads.
- Derived metadata: sentiment, urgency heuristics, project tags, response expectations, follow-up deadlines.

## Compliance & Governance Considerations
- OAuth scopes must be scoped to least privilege (e.g., `Mail.Read`, `TeamsMessages.Read`, `channels:history`).
- Data stored in Supabase/Postgres qualifies as sensitive (PII, potentially confidential company info); enforce encryption at rest, row-level access controls, and audit logging.
- Define retention/deletion policy (default proposal: 90-day rolling window for raw content, longer for derived signals).
- Track provenance from vector embeddings back to source artefacts to support data subject requests.
- Ensure adherence to Microsoft and Slack terms of service for automated access and storage.
- Document data residency expectations (default: US-based Supabase region unless clarified).

## Success Metrics & Guardrails
- Primary metric: number of avoided context switches per day (tracked via 80HD notification history vs. raw message counts).
- Supporting metrics: time-to-escalation for high-urgency events, daily digest satisfaction rating, volume of “noise” vs. “signal” overrides.
- Guardrails: allow user to tune sensitivity thresholds and silence windows; maintain audit trail of escalations and suppressions.

## Outstanding Questions
- Preferred fallback notification channel if Web Push is unavailable (SMS vs. phone call vs. something else).
- Acceptable retention period for raw message content and derived embeddings.
- Need for additional data sources (e.g., calendar invites, task tools) in initial release.



