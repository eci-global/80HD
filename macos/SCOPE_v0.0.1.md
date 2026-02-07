# v0.0.1 Scope Proposal: The Observing Eye

**Status:** Proposed - Awaiting Staff Engineer Review & Travis Approval
**Author:** Staff Developer
**Date:** 2026-02-07

---

## Executive Summary

**Build the Earth layer (Foundation & Ground Truth) + minimal Fire layer (Sacred Time Protection).** Give Travis a working "finance tracker for focus" that shows where his attention goes without judgment. No AI mentor yet, no interventions, no backend — just a crystal-clear mirror of his work context.

**Working Title:** "The Observing Eye" (first milestone toward full Musashi Mentor)

---

## What v0.0.1 Includes

### Earth Layer (Foundation & Ground Truth) - 100%

**Context Monitoring (Every 5 Minutes):**
- ✅ Git activity (repo, branch, commits, uncommitted changes) - REUSE existing GitMonitor
- ✅ System activity (active app, app switches, focus/comm detection) - REUSE existing SystemMonitor
- ✅ Local SQLite persistence - REFACTOR existing DatabaseManager (add error handling, verification)
- ⚠️ Session tracking (work sessions with start/end time) - EXISTS but needs verification

**What Makes This "Earth":**
Raw data collection only. No interpretation, no judgment, no AI. Just: "Here's what happened."

### Fire Layer (Sacred Time Protection) - 20%

**Time Window Awareness:**
- ✅ 9-12 AM = Sacred Focus (UI shows "Protected Time" badge)
- ✅ 8-9 AM = House Time (app doesn't track, grayed out)
- ✅ 12-2 PM = Tapering Time
- ✅ 2+ PM = Collaborative Time

**What Makes This "Fire":**
Timing awareness without intervention. The app KNOWS when it should never speak (9-12), but doesn't DO anything yet.

### The Observing Eye Dashboard (NEW)

**Menu Bar Status:**
- Current work mode badge (Deep Focus / Struggling / Pressure / Normal / Communication)
- Time in current mode (e.g., "Deep Focus - 2h 15m")
- Sacred time indicator when 9-12 (e.g., "🛡️ Protected")

**Dashboard Window (NEW - replaces placeholder chat):**

**Tab 1: Today's Attention**
- Timeline view (horizontal bar chart, 8 AM → now)
- Color-coded by work mode
- Hover shows: active app, git repo/branch, mode signals
- This is the "finance tracker" view — shows where focus went

**Tab 2: Current Session**
- Live stats: time in session, commits today, app switches/hour
- Current context: active repo, branch, active app
- Work mode with contributing signals (e.g., "Deep Focus: low switching + focus app + commits")
- NO recommendations, NO nudges — pure observation

**Tab 3: History** (Optional for v0.0.1, nice-to-have)
- Past sessions (last 7 days)
- Session duration, dominant mode, commits made
- Click to see session timeline

**NO Chat Interface Yet** - Remove ChatWindowView, replace with ObservingEyeDashboard

---

## What v0.0.1 Explicitly EXCLUDES

❌ Backend integration (Supabase, API calls, snapshot upload)
❌ AI/LLM features (Claude API, interventions, reframe moments)
❌ Collaboration artifact generation (GitHub, Teams, Linear posts)
❌ Browser monitoring (Safari extension - Phase 2 capability)
❌ Communication monitoring (Teams/Outlook status - Phase 3 capability)
❌ Water layer (pattern learning, rhythm detection, baselines)
❌ Wind layer (team dynamics, trigger sources)
❌ Void layer (long-term wisdom, mentor insights)
❌ Settings panel (beyond basic prefs)

---

## Why This Scope?

### Why This Much:

1. **Standalone value** - Travis gets immediate insight into his attention patterns. "Where did my focus go today?" is answerable on day 1.
2. **Tests the foundation** - Verifies Earth layer works before building Water/Fire/Wind/Void on top.
3. **Validates core loop** - 5-minute snapshots → work mode classification → visual feedback. If this doesn't work, nothing else will.
4. **Builds muscle memory** - Travis gets used to glancing at the menu bar, checking the dashboard. Sets the pattern for future mentor moments.
5. **Privacy-first proof** - Everything local, no cloud, no AI. Proves the data collection layer respects privacy.

### Why Not Less:

Removing the dashboard makes this pure infrastructure with no user value. Travis wouldn't use it, wouldn't test it, wouldn't learn from it. The Observing Eye dashboard is the minimum viable experience.

### Why Not More:

Adding backend integration or AI features triples scope and introduces network/auth/error complexity before validating the core monitoring works. Adding browser/communication monitoring requires permission flows and extension development — dependencies outside our control. Adding Water layer (pattern learning) requires weeks of data collection before it provides value.

---

## Success Criteria

v0.0.1 is successful if:

1. **It runs reliably** - App launches, menu bar visible, no crashes
2. **It captures accurately** - Every 5 minutes, git + system context saved to SQLite
3. **It classifies correctly** - Work modes match Travis's actual state (spot-check over 2 days)
4. **It shows clearly** - Dashboard timeline makes sense, Travis can answer "where did my focus go?" by looking at it
5. **Sacred time works** - 9-12 AM shows protected badge, dashboard reflects this
6. **Travis uses it** - Not just runs in background, but Travis actively checks the dashboard 2-3x/day

**What "done" looks like:**
Travis runs the app for 3 full workdays. At end of day 3, he opens the dashboard and can tell you:
- How much time he spent in Deep Focus vs other modes
- When he context-switched most heavily
- Whether he stayed on one repo or bounced between projects
- Whether sacred time was actually protected (no interruptions 9-12)

And he finds the data USEFUL, not just accurate.

---

## Implementation Task Breakdown

### Phase 1: Verify & Refactor (Week 1)

**Task 1.1: Verify Existing Infrastructure**
- Build existing Xcode project, confirm it compiles
- Run app, verify menu bar appears
- Trigger snapshot capture, verify SQLite file created
- Check database schema matches current models
- Verify GitMonitor and SystemMonitor return valid data
- **Tooling:** XcodeBuildMCP for autonomous build/test

**Task 1.2: Refactor DatabaseManager**
- Add comprehensive error handling (throw detailed errors, not print statements)
- Add database verification method (schema health check on launch)
- Add data integrity checks (foreign key constraints enforced)
- Test snapshot save/load roundtrip
- **Deliverable:** DatabaseManager that fails loudly with actionable errors

**Task 1.3: Refactor AppDelegate**
- Extract monitoring into ContextAggregator (use existing protocol)
- Separate concerns: AppDelegate = lifecycle, ContextAggregator = monitoring
- Add proper error handling for monitor failures
- **Deliverable:** Clean separation, easier to test monitors individually

### Phase 2: Build Dashboard (Week 2)

**Task 2.1: Create Dashboard Window**
- Replace ChatWindowView with ObservingEyeDashboard
- Tab structure: Today's Attention / Current Session / History (optional)
- Menu bar action: "Dashboard" (cmd-D) opens window
- **Deliverable:** Tabbed window that opens from menu bar

**Task 2.2: Implement "Today's Attention" Timeline**
- Horizontal timeline bar (8 AM → now)
- Color-coded segments by work mode
- Hover tooltip: time range, mode, active app, git context
- Update live as new snapshots arrive
- **Deliverable:** Visual timeline showing attention allocation

**Task 2.3: Implement "Current Session" Stats**
- Real-time stats: session duration, commits today, app switches/hour
- Current context card: repo/branch, active app, work mode
- Work mode explanation: show contributing signals
- **Deliverable:** Live dashboard showing current state

**Task 2.4: Implement "History" View (Optional)**
- List of past sessions (last 7 days)
- Session cards: date, duration, dominant mode, commits
- Click to see session timeline
- **Deliverable:** Historical view (defer if time-constrained)

### Phase 3: Sacred Time Protection UI (Week 2)

**Task 3.1: Menu Bar Time Indicators**
- Show current time window badge: 🛡️ Protected (9-12) / 🏠 House Time (8-9) / 🤝 Collaborative (2+)
- Update menu bar status line to reflect time window
- **Deliverable:** Menu bar clearly indicates sacred time

**Task 3.2: Dashboard Time Window Context**
- Timeline shows sacred time zones as background shading
- Current session card highlights if in sacred time
- **Deliverable:** Dashboard visually reinforces sacred time concept

### Phase 4: Polish & Ship (Week 3)

**Task 4.1: Error Handling & Logging**
- Comprehensive error handling for all monitor failures
- Unified logging (use os.log framework)
- Log rotation (don't fill disk)
- Graceful degradation (if GitMonitor fails, app still runs with SystemMonitor)
- **Deliverable:** Production-quality error handling

**Task 4.2: Performance Optimization**
- Profile memory usage (target: <100 MB)
- Profile CPU usage (target: <2% when idle)
- Optimize database queries (indexes verified)
- Debounce rapid events
- **Deliverable:** Lightweight menu bar app

**Task 4.3: User Testing Prep**
- Add data export (CSV or JSON) for debugging
- Add database reset option (for testing fresh starts)
- Add "About" panel with version, database path
- **Deliverable:** Ready for Travis to use daily

**Task 4.4: Documentation**
- User guide (what it does, how to interpret dashboard)
- Privacy policy (what's tracked, what's not, all local)
- Troubleshooting guide (common issues, how to reset)
- **Deliverable:** Travis can use without asking questions

---

## Dependencies

1. **XcodeBuildMCP** (from Researcher findings) - Autonomous build/test/preview during implementation
2. **Xcode 15+** - For macOS 14+ target
3. **Swift 5.9+** - Modern concurrency support
4. **SQLite3** (built into macOS) - Database persistence
5. **macOS 14+** - Target OS version

**No external dependencies** (no Supabase SDK, no network libraries, no AI SDKs)

---

## Risks & Mitigations

**Risk 1: Database doesn't actually work**
- **Likelihood:** Medium (no evidence of testing)
- **Impact:** High (blocks entire milestone)
- **Mitigation:** Task 1.1 verifies database first, before building dashboard
- **Fallback:** Rebuild DatabaseManager from scratch if broken (1-2 days)

**Risk 2: Work mode classification is inaccurate**
- **Likelihood:** Medium (logic exists but untested)
- **Impact:** Medium (dashboard shows wrong modes)
- **Mitigation:** Spot-check against Travis's actual state over 2 days, tune thresholds
- **Fallback:** Simplify to fewer modes (Focus / Not Focus / Unknown)

**Risk 3: Travis has no Swift experience**
- **Likelihood:** N/A (fact)
- **Impact:** High if AI implementation fails
- **Mitigation:** XcodeBuildMCP provides build/test/preview autonomously, AI writes all code
- **Fallback:** Hire Swift contractor for 1 week if AI struggles

**Risk 4: Timeline visualization is complex**
- **Likelihood:** Medium (SwiftUI charting is non-trivial)
- **Impact:** Low (can defer to static list view)
- **Mitigation:** Start with simple bar chart, iterate to timeline if time permits
- **Fallback:** Table view of sessions instead of timeline

**Risk 5: Performance issues (CPU/memory)**
- **Likelihood:** Low (5-min polling is light)
- **Impact:** Medium (annoying background app)
- **Mitigation:** Profile early (Task 4.2), optimize before shipping
- **Fallback:** Reduce polling frequency to 10 minutes

**Risk 6: Scope creep during implementation**
- **Likelihood:** High (Five Rings vision is vast)
- **Impact:** High (never ships)
- **Mitigation:** This document is the scope contract. Staff Engineer reviewer challenges any additions.
- **Fallback:** Remove History tab, ship with just Today + Current Session

---

## What Comes After v0.0.1?

**v0.0.2: The Water Layer** (Pattern Learning)
- Baseline learning: what's "normal" for Travis?
- Rhythm detection: when is he most focused?
- Medication awareness: how do Vyvanse windows affect patterns?

**v0.0.3: The Fire Layer** (Intervention Engine)
- Backend integration: upload snapshots to Supabase
- Claude API integration: generate reframe moments
- First intervention type: "Is this the sword you want to draw right now?"

**v0.0.4: The Wind Layer** (Understanding Others)
- Communication monitoring: Teams/Outlook status via MCP server
- Trigger detection: Teams message → abrupt context shift
- "Who controlled your attention today?" view

**v0.0.5: The Void Layer** (Mentor Wisdom)
- Long-term pattern synthesis
- Cross-session insights ("you haven't noticed this about yourself...")
- Growth tracking over months

---

## Open Questions

1. **Do we include encryption in v0.0.1?** - BUILD_PLAN.md mentions SQLCipher, but current DatabaseManager doesn't use it. Recommendation: defer to v0.0.2 since all data is local metadata anyway.

2. **Do we need multi-repo tracking?** - Current GitMonitor finds "most recent" repo. Is that sufficient, or does Travis work across multiple repos simultaneously? Recommendation: ship with single-repo detection, add multi-repo in v0.0.2 if needed.

3. **What's the target macOS version?** - Recommend macOS 14+ (released Sept 2023) for modern SwiftUI features. Travis's machine?

4. **Should History tab be in v0.0.1?** - It's marked "optional." Recommendation: include if time permits, defer if not. Today + Current Session is minimum.

5. **Do we want data export in v0.0.1?** - For debugging/analysis. Recommendation: yes, simple JSON export of snapshots.

---

## Recommendation

**SHIP THIS SCOPE.**

It's the minimum that provides standalone value (finance tracker for focus) while validating the foundation (Earth layer monitoring works). It sets the stage for Water/Fire/Wind/Void without overcommitting. Travis can use it daily within 2-3 weeks, generate real feedback, and prove the concept before investing in backend/AI infrastructure.

**Next step:** Staff Engineer review of this proposal. Challenge scope creep, validate feasibility, confirm 2-3 week timeline is realistic given XcodeBuildMCP tooling and Travis's zero Swift experience.
