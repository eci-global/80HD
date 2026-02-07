# Rick Clemens

**Role**: SRE Manager
**Team**: Manufacturing (M1, JB2, DataInv, JobBOSS)

## Learning Style
- Needs visual walkthroughs — looks at screenshots and UI but sometimes at the wrong view
- Asks direct questions when confused but doesn't always absorb the answers on first pass
- Responds well to specific instructions ("click the 3 dots next to team")
- Needs the distinction between different schedule types explained repeatedly

## Strengths
- Willing to submit PRs and try the process
- Reports issues clearly (handoff time wrong, rotations incorrect)
- His PR submission actually surfaced two bugs in the Terraform sorting and Python YAML generation

## Growth Areas
- **Staff schedule vs 24x7 schedule**: Major confusion. Looked at staff schedule view and reported on-call as wrong, when the 24x7 schedule (the actual rotation) was a different view. This happened multiple times.
- **On-call rotation ordering**: Didn't understand that CSV row order determines rotation order. Had to be walked through the connection between CSV order → Terraform → FireHydrant responder order.
- **FH UI navigation**: Doesn't know where to find the right views. Needed specific instructions ("click the … next to team and look at responders").
- **On-call vs on_call flag**: Initially confused about on_call yes/no toggle ("That makes no sense") — thought setting Keith to "no" was counterproductive when the actual need was to reorder the CSV.

## Recurring Patterns
- **Looking at wrong view**: Consistently views staff schedule instead of 24x7 schedule when checking on-call rotation. This needs to be called out explicitly every time.
- **Handoff time confusion**: Asked about handoff times not matching work hours (5pm end vs 6pm handoff). This is a legitimate question about gap coverage.
- **CSV order = rotation order**: This concept needed multiple explanations. The mental model of "row position in a spreadsheet controls who's on-call when" is non-obvious.

## Interaction Notes
- 2025-12-19: Reported handoff time mismatch and incorrect rotations for JB2, DataInv, JobBOSS. M1 was correct. Handoff settings fixed but rotation issues persisted.
- 2025-12-30: Reported on-call order wrong on all products — was looking at staff schedule, not 24x7 schedule. Travis walked through the correct view.
- 2025-12-30: Submitted PR to reorder CSV. PR surfaced 2 bugs in the system (TF sorting, Python YAML generation).
- 2025-12-31: Travis fixed bugs and applied to M1 for testing.
