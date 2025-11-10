# Runbook: Missed Escalation

## Trigger
- User reports that an urgent message never reached Focus Pager/SMS.
- Alert monitors detect discrepancy between high-priority activities and notifications sent.

## Immediate Actions
1. Check `escalations` table for tenant and activity hash. Confirm whether an escalation row exists.
2. If absent, inspect `activities` row to verify `metadata.urgency` and `requiresResponse`.
3. Review prioritization logs (Edge Function) for the activity ID to find computed score and reasons.
4. Validate notification channel status (Web Push subscription or SMS provider health).

## Remediation Paths
- **Scoring issue:** adjust sender importance weights or urgency thresholds; re-run prioritization job on affected activity.
- **Notification failure:** re-send via alternate channel, rotate push/SMS credentials, trigger end-to-end notification test.
- **Connector delay:** check ingestion queue backlog, delta tokens, and API rate-limit responses.

## Post-Incident
- Record root cause and mitigation in incident tracker.
- Capture user feedback on severity and trust impact.
- Update prioritization heuristics or add automated test to prevent regression.


