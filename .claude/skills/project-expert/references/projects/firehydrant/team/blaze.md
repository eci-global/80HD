# Blaze Lewis

**Role**: SRE Manager
**Team**: Distribution (ROW, EU, LBMH) — ~17 products across 3 sub-teams
**Products**: Acsellerate, Cognytics, Jumptrack, Britannia/V5, DDMS Plus, EcInteractive Plus, PSN, Red Falcon, Team Design, EasyOrder, Progress, Horizon, Spruce/RSMax, RSClassic, SPEC, Pacsoft

## Learning Style
- Prefers things to work immediately — low tolerance for iterative debugging
- Pushes back when frustrated, but engages when shown clear paths forward
- Needs to see the end-to-end flow working before trusting the process
- Responds better to direct answers than to "figure it out" coaching
- Tends to skim instructions — misses details in PR comments and messages

## Strengths
- Knows his products and team structure deeply
- Provides detailed breakdowns when asked (EU/ROW/LBMH splits)
- Sets up webhooks correctly once shown how
- Willing to submit data (CSVs, webhook links) quickly

## Growth Areas
- IaC mental model: Still thinks in terms of "click ops" and struggles with the PR→merge→deploy→validate cycle
- Doesn't yet trust the pipeline — wants to validate in FH before the pipeline has even run
- Confuses generated files (YAML) with source files (CSV)
- Doesn't fully understand that changes in FH UI will be overwritten by Terraform
- Frustrated by YAML review ("I'm not reviewing 8000+ lines of YAML") — doesn't realize the CSV is the review surface, not the generated output

## Recurring Patterns
- **On-call rotation ordering**: Major recurring concern. Worried that by the time a PR is approved, the order is already stale. Doesn't fully grasp that the CSV order is the source of truth and gets applied at deploy time.
- **PR lifecycle confusion**: Submits PRs but doesn't follow up on status. Checks FireHydrant before PR is merged, then reports things as broken. Needs the PR→merge→deploy→validate sequence reinforced.
- **"This process seems really broken"**: Expressed frustration with the overall IaC approach (Dec 22). Root cause is the gap between his expectations (instant changes) and the IaC reality (PR→review→merge→deploy cycle).
- **504 errors**: Hit FireHydrant API 504s but didn't know how to troubleshoot or work around them. When asked "what have you tried?" answered "I don't even know what to try."
- **Product naming frustration**: Wishes product codes aligned with his internal naming conventions. "I would have really appreciated it if you used our Product Codes or Product Registered Long Names."

## Interaction Notes
- 2025-12-12: Set up webhooks correctly after being shown the Workflows path. Had 3 webhooks for 1 FH team — needed team split discussion.
- 2025-12-19: PR not merged, checked FH and reported things as broken. Hadn't followed PR review comments.
- 2025-12-22: Frustrated with reviewing generated YAML. Needed Python installed. Said "this process seems really broken."
- 2025-12-26: Hit 504s, couldn't troubleshoot. Didn't know what gave the 504 or what to try. Travis coached toward identifying the source.
- 2025-12-30: On-call ordering debate. Concerned rotation order changes weekly but PR process is too slow. Travis suggested weekly PRs or custom tooling.
