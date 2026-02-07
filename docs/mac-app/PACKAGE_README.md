# 80HD Documentation Package

This package contains all documentation needed to onboard Claude Code to the 80HD project.

## What's Included

### Core Project Files (Update Your Repo)
1. **README.md** - Project overview with cave mode problem, strategic context, features
2. **CLAUDE.md** - Quick reference for Claude Code with your personal context and 80HD concepts

### Complete Design Documentation (For Reference)
3. **ARCHITECTURE.md** - System design, tech stack, component architecture
4. **REQUIREMENTS.md** - Your work patterns, tools, needs, fears, success criteria
5. **CONTEXT_MODEL.md** - How 80HD interprets your behavior (work modes, signals)
6. **BUILD_PLAN.md** - 7-phase implementation roadmap with detailed tasks

### Implementation Guide
7. **HANDOFF_TO_CLAUDE_CODE.md** - Step-by-step Phase 1 implementation with code examples
8. **START_BUILDING.md** - What to say to Claude Code after it passes understanding test

---

## How to Use This Package

### Step 1: Update Your Project Files

**Copy to your repo:**
- `README.md` → Replace your current README.md
- `CLAUDE.md` → Replace your current CLAUDE.md

These files now explain the real mission: solving cave mode, not filtering interruptions.

### Step 2: Onboard Claude Code

**In Claude Code, upload files in this order:**

**First Upload (Understanding the Problem):**
1. README.md
2. REQUIREMENTS.md

**Say:**
```
We're building 80HD - a native macOS app that solves the cave mode problem.

Read these two docs:
1. README - The problem and mission
2. REQUIREMENTS - My work patterns and needs

Tell me what problem we're solving and who I am.
```

**Wait for Claude Code to respond.**

---

**Second Upload (Understanding the Design):**

3. ARCHITECTURE.md
4. CONTEXT_MODEL.md

**Say:**
```
Now the design:
3. ARCHITECTURE - Technical approach
4. CONTEXT_MODEL - How 80HD interprets my behavior

Tell me what our technical approach is and how 80HD understands my work modes.
```

**Wait for Claude Code to respond.**

---

**Third Upload (Ready to Build):**

5. BUILD_PLAN.md
6. HANDOFF_TO_CLAUDE_CODE.md

**Say:**
```
Now the implementation plan:
5. BUILD_PLAN - 7-phase roadmap
6. HANDOFF_TO_CLAUDE_CODE - Phase 1 step-by-step guide

Tell me what Phase 1 delivers and what we build first.
```

**Wait for Claude Code to respond.**

---

### Step 3: Test Understanding

**Ask Claude Code these 6 questions:**

```
Before we start, answer these to confirm understanding:

1. What is "cave mode" and why is it a problem?
2. What are my sacred focus hours and why do we never interrupt them?
3. What are the 4 work modes 80HD detects?
4. Why do we post to multiple channels (GitHub + Teams + Linear)?
5. What's the technical approach (native app, database, integrations)?
6. What's the first thing we build in Phase 1?
```

**Expected Answers:**
1. Hyperfocus → invisible collaboration → trust erosion + anxiety
2. 9am-12pm, Vyvanse peak + prime focus, never interrupt
3. Deep focus, struggling, pressure, communication
4. Fight fear of being ignored, impossible to miss updates
5. Native Swift macOS app, local SQLite, Safari extension, MCP servers, 100% local
6. Xcode project with menu bar app, SQLite database, Git monitoring

---

### Step 4: Start Building

**When Claude Code passes the test, use START_BUILDING.md**

**Say:**
```
Perfect! You understand the mission.

Let's start Phase 1: Building the native macOS app foundation.

First task: Create the Xcode project following HANDOFF_TO_CLAUDE_CODE.md

We're building:
- Menu bar app with basic UI
- SQLite database (encrypted, local)
- Git monitoring (local repos)
- System monitoring (active app)
- Simple chat window

100% local. No cloud. Privacy-first.

Show me the project structure and we'll start building.
```

---

## Quick Reference

### Key Concepts

**Cave Mode Problem:**
- Hyperfocus on IaC/infrastructure work
- Collaboration becomes invisible
- Trust erodes despite good work
- Anxiety about being perceived as non-collaborative

**Solution:**
- Monitor work context automatically
- Detect ADHD patterns (deep focus, struggling, pressure)
- Generate updates at right time (never during 9-12am)
- Post to multiple channels (GitHub + Teams + Linear + Confluence)
- Learn and adapt based on patterns

**Technical Approach:**
- Native macOS app (Swift + SwiftUI)
- Local SQLite database (encrypted)
- Safari App Extension for browser tracking
- MCP servers for tool integrations (run locally)
- 100% local - data never leaves your Mac

### Your Context (Travis)

**Setup:**
- LEFT monitor (horizontal): Desktop 1 = Claude Code, Desktop 2 = Teams/Outlook
- RIGHT monitor (vertical): Safari (top), Terminals (bottom)

**Schedule:**
- 8-9am: House time (not work)
- 9am-12pm: SACRED FOCUS (never interrupt)
- 12pm-2pm: Tapering (gentle nudges ok)
- 2pm+: Collaborative time (full intervention)

**Tools:**
- Linear (source of truth) → syncs to GitHub Issues + Jira
- Teams (primary), Outlook (calendar)
- Azure DevOps + GitHub (VCS)
- Confluence (docs)

**Fear:**
Posting updates that get ignored

**Solution:**
Multi-channel distribution (impossible to ignore)

### Work Modes

1. **Deep Focus** - Don't interrupt, capture context
2. **Struggling** - Suggest asking for help
3. **Pressure** - Offer to handle comms
4. **Communication** - Already collaborating, no nudge

### Sacred Time Rules

**9:00-12:00 PM:**
- NEVER interrupt
- Vyvanse peak effectiveness
- Queue all nudges for 12pm or later
- Exception: Only critical emergencies

---

## If Claude Code Gets Confused

**If it mentions Supabase:**
> "No. 80HD is native macOS only. Local SQLite. No backend services."

**If it wants to rewrite existing code:**
> "This repo has other projects. 80HD is a new native Swift app. Start fresh with Xcode."

**If it forgets sacred time:**
> "Remember 9am-12pm is sacred. Never interrupt during this window."

**If it wants to build everything at once:**
> "One component at a time. Menu bar first, then database, then Git monitoring."

---

## Phase 1 Success Criteria

You'll know Phase 1 is complete when:

- ✅ Menu bar icon visible and clickable
- ✅ SQLite database creates and stores data
- ✅ Git monitoring detects commits
- ✅ System monitoring tracks active app
- ✅ Chat window opens/closes
- ✅ Context snapshots save every 5 minutes
- ✅ You can use it during real GitOps work

Then move to Phase 2: Enhanced monitoring, desktop tracking, Safari extension prep.

---

## Support

If you need to refer back to design decisions, patterns, or specific details:
- Check ARCHITECTURE.md for system design
- Check CONTEXT_MODEL.md for behavior interpretation
- Check REQUIREMENTS.md for your specific needs
- Check BUILD_PLAN.md for the full roadmap

---

**Ready to start building! Follow the steps above and you'll have Claude Code fully onboarded.** 🚀
