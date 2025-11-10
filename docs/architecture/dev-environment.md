# Developer Environment Blueprint

## Repository Layout
```
/
├─ apps/
│  ├─ api/         # Edge function source, shared Supabase clients
│  └─ web/         # Vercel-hosted Next.js front-end & Focus Pager PWA
├─ packages/
│  └─ shared/      # Shared TypeScript utilities (schemas, types, tracing)
├─ infra/          # Terraform/Stack configuration for Supabase+Vercel
└─ docs/           # Product, architecture, and ops documentation
```

## Toolchain Standards
- **Language:** TypeScript-first for API, workers, and web surfaces.
- **Runtime:** Node 20 LTS; Supabase Edge Functions (Deno) with shared TS definitions.
- **Package Management:** pnpm workspace; enforce consistent tooling with `pnpm dlx tsx`, linting via `eslint` + `biome`.
- **Formatting:** Prettier for markdown/mdx, Biome for TS/JS; enforced via pre-commit hooks (Husky).
- **Testing:** Vitest for unit tests, Playwright for end-to-end UI verification, smoke tests against Supabase staging.
- **Env Management:** `.env.example` tracked, local secrets via Doppler/1Password CLI; CI uses GitHub Actions secrets.

## Local Dev Workflow
1. Install dependencies with `pnpm install`.
2. Start Supabase local stack via `supabase start` (or use cloud staging with RLS-limited dev account).
3. Run API watcher: `pnpm --filter apps/api dev` (Edge function emulator).
4. Run web app: `pnpm --filter apps/web dev` (Next.js + Web Push service worker).
5. Execute lint/tests with `pnpm lint` and `pnpm test`.

## Required Services & Accounts
- Supabase project (staging + prod) with PGVector enabled.
- Microsoft Azure AD app registration for Graph access (delegated scopes).
- Slack app with Events API subscription and Socket Mode token for local dev.
- OpenAI or Anthropic API keys for embeddings + LLM operations.
- Twilio (or chosen fallback) account for SMS/pager failover.

## Developer Tooling Enhancements
- Generate shared types and validation with Zod/TypeScript contracts in `packages/shared`.
- Observability sandbox using OpenTelemetry collector docker compose.
- Storybook (optional) for UI component iteration within `apps/web`.

## Git & CI Policy
- Feature branches with conventional commits.
- Pull requests require lint, test, and type checks to pass.
- Deploy previews via Vercel; Supabase migrations executed through `supabase db push` in CI.
- Infrastructure definitions in `infra/` validated with `terraform fmt` + `terraform validate`.


