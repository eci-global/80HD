# Security & Privacy Strategy

## Data Protection
- **Encryption:** Supabase stores data encrypted at rest; enforce TLS 1.2+ for all traffic. Sensitive columns (body, attachments metadata) encrypted client-side before insertion where feasible.
- **Row-Level Security:** Enable RLS on every table (`tenants`, `activities`, `activity_chunks`, `escalations`, `daily_digests`, `action_items`). Policies restrict access to authenticated user’s `tenant_id`.
- **Secrets Management:** Use Supabase Vault for OAuth refresh tokens; Doppler/1Password CLI for developer secrets; GitHub OIDC for CI workflows.
- **Data Minimization:** Strip attachments to metadata unless explicitly whitelisted; store message body redacted for digest (no binary).

## Identity & Access
- Supabase Auth with passkeys / OAuth (Microsoft) for SSO. Service role key scoped to backend only.
- Admin console for managing trusted senders, contact importance, and notification channels.
- Access reviews every 90 days; on-call accounts use MFA and hardware keys.

## Threat Modeling (High-Level)
- **OAuth Token Abuse:** Store tokens encrypted, rotate every 90 days, monitor for anomalous usage (failed refresh attempts).
- **Webhook Spoofing:** Validate Slack request signatures, Microsoft Graph change notifications (JWT validation), and maintain idempotency hashes.
- **Prompt Injection / LLM Abuse:** Sanitize content before prompting, include source citations, limit tool invocation scope, log prompts/responses.
- **Data Exfiltration:** Audit trails on Supabase; anomaly detection on export volume; break-glass alert if `select` volume spikes.

## Compliance Considerations
- Align with Microsoft and Slack terms for storing copies of messages.
- GDPR readiness: support data subject deletion (cascade delete tenant data) and export (generate digest export).
- Retention policy: default 90 days raw, 365 days metadata/embeddings; configurable per tenant.
- Logging: store in dedicated Supabase schema with 30-day retention; forward to Logflare/Datadog for monitoring.

## Security Backlog
- Implement automated dependency updates (Renovate).
- Add static analysis (ESLint security plugins, Biome) and secret scanning in CI.
- Schedule annual penetration testing and tabletop incident response exercises.
- Build alert thresholds for unusual escalation volume or repeated false negatives.


