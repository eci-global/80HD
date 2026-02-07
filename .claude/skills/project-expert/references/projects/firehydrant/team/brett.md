# Brett Welschmeyer

**Role**: SRE Engineer
**Team**: UTR (Unified Technology Resources)

## Learning Style
- Hasn't been able to engage deeply with the system due to access issues
- Professional and measured in communication, but clearly frustrated
- Will need hands-on walkthrough once access issues are resolved

## Strengths
- Patient despite weeks of being blocked
- Self-diagnosed the issue correctly ("pretty sure something is wrong with my user")
- Willing to try multiple approaches (HTTPS, SSH, GH CLI, rebuilt git config)

## Growth Areas
- Limited exposure to the IaC workflow due to 3+ weeks of access issues
- Will need the full onboarding experience from scratch once unblocked
- Webhook setup: initially couldn't find webhooks (channel type issue — shared channels can't have webhooks)

## Recurring Patterns
- **GitHub access blocked**: SSO migration broke his access. Tried HTTPS, SSH, GH CLI, cleared git config. Issue was he wasn't added to the Okta app for GitHub. Even after being added, still had clone/write issues.
- **Channel type issue**: Set up a shared channel for webhooks, but shared channels don't support webhooks. Had to recreate as standard channel.

## Interaction Notes
- 2025-12-12: Couldn't find webhooks in Teams channel — discovered shared channels don't support them. Resolved by recreating channel.
- 2025-12-19: Reported repo not found errors. Sean added him to Okta app, Travis confirmed write access, but issues persisted.
- 2026-01-06: Still blocked. "I can't do anything with firehydrant until this is fixed." Escalated formally. Three weeks without access.
