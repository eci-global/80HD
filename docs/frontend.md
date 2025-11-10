# Frontend Experience

## Surfaces
- **Dashboard (`/`):** High-level stats, digest preview, Focus Pager pane, priority signals, and chat assistant. Built in Next.js App Router with client components for interactivity.
- **Focus Pager (`/focus-pager`):** Standalone PWA-friendly surface that receives urgent notifications while Outlook/Teams stay closed. Supports acknowledgement, quiet mode, and push opt-in.
- **Chat API (`/api/query`):** Placeholder endpoint ready to connect Supabase semantic search + LLM orchestration for natural language queries.

## Component Highlights
- `FocusPagerPanel` — interactive list of escalations with acknowledgement and "mark as noise" affordances.
- `DigestCard` — preview of the evening summary with tabbed highlights/follow-ups state.
- `SignalCard` — visual representation of priority score, color-coded by channel.
- `ChatPanel` — text-area input using SWR mutation to hit `/api/query`.

## Design Principles
- Dark, low-contrast UI to reduce sensory load.
- Use of motion for reinforcing priority without overwhelming (Framer Motion on signal cards).
- Call-to-action clarity: ack/respond, mark noise, view digest.
- PWA readiness for mobile Focus Pager (manifest, responsive layout).

## Next Steps
- Wire `/api/query` to Supabase Edge Function that performs hybrid search + LLM summarization.
- Implement authentication (Supabase Auth) and multi-tenant routing.
- Replace mock data with hooks fetching from Supabase tables (`activities`, `daily_digests`, `escalations`).
- Add push notifications via service worker for Focus Pager.


