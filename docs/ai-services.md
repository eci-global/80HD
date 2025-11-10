# AI Services & Prioritization

## Prioritization Heuristics
The `rankActivity` function computes a priority signal (score, label, recommended channel) using:
- **Metadata factors:** urgency hints, high-importance flags, due dates, explicit response requests.
- **Participant weighting:** sender importance score (curated from feedback) and mention detection.
- **Temporal decay:** older messages lose priority; quiet hours downgrade non-critical alerts.
- **Channel selection:** critical → SMS fallback, important → Focus Pager (unless quiet hours), normal → daily digest, low confidence → suppressed.

Future improvements:
- Learn sender importance dynamically via reinforcement feedback.
- Integrate vector similarity to detect repeated nudges and escalate if unresolved.

## Summaries & Explanations
- Daily summary builder groups highlights, decisions, and follow-ups, backed by LLM completions with low-temperature prompts.
- Escalation explanation generator produces user-facing rationale for each alert (transparency and trust).
- Action items derived from follow-ups include due dates for quick triage.

## Execution Flow
1. Ingestion pipeline normalizes activities and stores them in Postgres.
2. Scheduler selects candidates for summarization (e.g., once daily) and high-urgency items for immediate analysis.
3. Prioritization outputs feed alert dispatcher (Focus Pager + SMS) and daily digest generator.
4. Summaries stored and surfaced in Vercel app; explanations attached to notifications.

## Guardrails
- All LLM calls routed through a `LanguageModelProvider` abstraction supporting provider rotation and rate limits.
- Prompt templates versioned in code and logged with request IDs for auditability.
- User feedback (mark as noise/critical) captured to adjust importance weights.


