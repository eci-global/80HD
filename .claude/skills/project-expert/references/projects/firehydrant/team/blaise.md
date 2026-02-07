# Blaise Lewis

**Role**: SRE
**Team**: SRE
**Experience**: Experienced ops engineer, likely strong PagerDuty background

## Learning Style
- Needs to understand WHY before accepting HOW
- Responds poorly to top-down mandates — needs to feel agency in the process
- Likely responds better to 1:1 walkthroughs than broadcast training

## Strengths
- Not afraid to voice concerns (even if framed as complaints, the feedback surfaces real gaps)
- Identifies UX friction that others silently tolerate

## Growth Areas
- Adapting mental models from familiar tools (PagerDuty) to new ones (FireHydrant)
- Separating "this works differently" from "this is broken"
- Understanding platform design intent before evaluating capability

## Recurring Patterns
- **Detractor pattern**: Typically pushes back on new tooling and process changes. This appears rooted in loss of control and resistance to change rather than technical inability.
- **PagerDuty mental model**: Expects alert-centric workflow where the alert is the primary workspace. Hasn't internalized FireHydrant's alert-as-triage-point → incident-as-workspace separation.

## Interaction Notes
- 2026-02-06 (AM): Complained that FireHydrant alerts are "very bad at about everything" — specifically post-ack limitations (no snooze, no escalate, no incident creation from mobile). Analysis: applying PagerDuty expectations to FireHydrant's intentionally different design. Mobile incident creation IS available but he may not have found it. Notification preferences issue (Andrew Gazdowicz) is a separate config gap, not platform-level.
- 2026-02-06 (PM): Asked about missed DDMS events from ME, correctly identified it as likely a CEL expression change. **Key observation**: Blaze knew WHERE to look (git history, GitHub Actions) but asked instead of searching himself. He has the technical skills and investigative instincts — this is a dependency/ownership pattern. Teaching moment: reinforce self-service investigation tools. His question demonstrated understanding of the system (CEL, pipeline deployment) which is excellent foundation.
