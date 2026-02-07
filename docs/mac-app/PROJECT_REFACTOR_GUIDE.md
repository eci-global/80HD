# 80HD Project Refactor: Solving the Cave Mode Problem

## What's Happening

We're **refactoring the 80HD project** to focus on its real mission: solving the cave mode problem for ADHD professionals doing deep technical work.

**The Pivot:**
- **Before:** Generic interruption shield / notification consolidator
- **After:** Collaboration visibility agent that makes updates automatic during hyperfocus

**What Stays:**
- Supabase backend (Postgres + Edge Functions + Auth)
- MCP server integrations (Linear, GitHub, Teams, Outlook)
- PGVector for embeddings and semantic matching
- Existing infrastructure and tooling

**What Changes:**
- **Focus shifts** from filtering interruptions → generating collaboration
- **New features** around work mode detection, sacred time protection, multi-channel posting
- **User-centric** design around Travis's ADHD patterns and GitOps initiative needs

---

## The Real Problem: Cave Mode

### What Happens
1. Enter hyperfocus on complex technical work (IaC, infrastructure, architecture)
2. Spend hours/days in deep flow state doing excellent work
3. Emerge with completed work but **zero collaboration trail**
4. Receive feedback about "poor collaboration" despite good intentions
5. Anxiety about being perceived as non-collaborative, trust erosion with teams

### The Core Issue
**Friction.** When deep in flow, stopping to post updates feels like climbing a mountain. So we don't. Then stakeholders wonder what we're doing and trust erodes.

### The Solution
Make collaboration **easier than not collaborating** by:
- Monitoring work context automatically (commits, Teams, browser, projects)
- Learning ADHD patterns (deep focus, struggling, pressure modes)
- Generating updates at the right time (never during sacred 9-12am focus)
- Posting to multiple channels (GitHub + Teams + Linear + Confluence)
- Adapting based on what works

---

## Strategic Context: GitOps Initiative

**Why This Matters for Q1 2026:**

The GitOps initiative involves:
- 5 teams (2 favorable, 3 resistant)  
- Complex IaC work (Spacelift, Terraform, AWS)
- High visibility requirements for cultural transformation
- Platform Enablement success measured by delivered materials, NOT by forcing adoption

**The Challenge:**
Complex infrastructure work happens in deep focus, but resistant teams need consistent visibility to build trust during the "learn, do, teach" flywheel.

**How 80HD Helps:**
1. Ensures IaC/GitOps work stays visible across all channels
2. Reduces friction (makes collaboration automatic, not overhead)
3. Builds trust through consistent visibility → increased team confidence
4. Demonstrates cultural change leadership

**Success Metrics:**
- **Primary:** Trust ↑ (with teams, leadership) + Anxiety ↓ (about collaboration)
- **Secondary:** Collaboration debt stays low, work visible by default, zero overhead

---

## User Context: Travis Thompson

### Role & Setup
- **Position:** Platform Enablement Team Lead @ ECI Solutions (Fredericton, NB)
- **Condition:** ADHD (on Vyvanse)
- **Challenge:** Collaboration visibility during hyperfocus

### Physical Setup
```
LEFT Monitor (Horizontal):
├── Desktop 1: Claude Code (primary workspace)
└── Desktop 2: Teams + Outlook (comms hub)

RIGHT Monitor (Vertical):
├── Top: Safari browsers (GitHub, Linear, docs)
└── Bottom: Terminals (git, builds, ssh)
```

**Key Pattern:** Hours on Desktop 1 with no Desktop 2 checks = deep focus

### Tool Ecosystem
- **Version Control:** Azure DevOps + GitHub
- **Project Management:** Linear (source of truth) → syncs to GitHub Issues + Jira
- **Communication:** Teams (primary, all-day) + Outlook (calendar)
- **Documentation:** Confluence
- **Development:** Claude Code

### Daily Schedule
```
8:00-9:00 AM:  House time (dishes, laundry - NOT work, ignore)
9:00-12:00 PM: SACRED FOCUS (prime deep work, Vyvanse peak - NEVER interrupt)
12:00-2:00 PM: Tapering energy (gentle nudges acceptable)
2:00 PM+:      Collaborative time (full intervention capability)
```

### Cave Mode Triggers
1. **Hyperfocus** - Interesting problems (IaC, complex architecture)
2. **Pressure** - Deadlines, urgent fixes
3. **Struggling** - Stuck on problems, need help but don't ask

### Fear
Travis's biggest concern: **posting updates that get ignored**, reinforcing the feeling that collaboration doesn't matter.

**Solution:** Multi-channel distribution (GitHub + Teams + Linear + Confluence) makes it impossible to miss.

---

## Core Concepts

### Work Mode Detection

80HD identifies four work states:

**1. Deep Focus**
- Pattern: Steady commits, low app switching, Desktop 1 for 2+ hours
- Strategy: Don't interrupt, capture context silently
- Intervention: AFTER session, help document what was built

**2. Struggling**  
- Pattern: No commits 2+ hours, high browser switching (20+/15min), heavy Firecrawl usage, long Claude conversations (30+ messages)
- Strategy: Suggest posting question or asking for help
- Example: "Been researching for a bit. Want to post what you're trying to solve?"

**3. Pressure**
- Pattern: Commits to main (bypassing feature branches), ignoring Desktop 2 (4+ hours), working off-hours
- Strategy: Offer to handle comms, don't interrupt the work
- Example: "In rush mode? Want me to post a WIP update?"

**4. Communication**
- Pattern: Active in Teams/Outlook, typing, in calls
- Strategy: No nudges, collaboration already happening

### Collaboration Debt

**Formula:** `debt_score = hours_since_last_update × work_intensity`

**Levels:**
- LOW: <24 hours
- MEDIUM: 24-48 hours  
- HIGH: >48 hours

**What counts as update:** Git push, GitHub Discussion, Teams message, Linear comment, PR created, Confluence page

**What doesn't count:** Local commits, reading (not responding), viewing Linear (not updating), private DMs

### Sacred Time Protection

**9:00-12:00 PM: NEVER interrupt**
- Vyvanse peak effectiveness
- Most valuable focus hours
- Queue nudges for 12pm+ if needed
- Exception: Only critical emergencies

**8:00-9:00 AM: Not work time**
- House duties (dishes, laundry, dinner prep)
- Don't track or consider as work

**2:00 PM+: Collaborative time**
- Energy naturally lower, more social
- Perfect window for nudges and updates
- Central timezone colleagues online

### Multi-Channel Distribution

When generating updates, ALWAYS post to multiple channels:

1. **GitHub Discussion** - Technical depth, code context (for developers)
2. **Teams Post** - 2-sentence awareness + link (for broad team)  
3. **Linear Comment** - Project status, links to discussion and Teams (for PM view)
4. **Confluence** - ADRs or runbooks if architectural (for long-term reference)

**Why:** One channel = easy to miss. Multiple = impossible to ignore. Builds trust through omnipresence.

---

## Technical Approach

### Current Infrastructure (Keep & Use)

**Backend Services:**
- Supabase (Postgres + Edge Functions + Auth + Storage)
- PGVector for semantic search and embeddings
- Vercel AI SDK for LLM interactions
- MCP servers for integrations

**What This Provides:**
- Activity storage and querying
- AI-powered content generation
- Tool integrations (Linear, GitHub, Teams, Outlook, Azure DevOps)
- Authentication and authorization

### New Components (Build)

**Future Phase - Native Client:**
- Native macOS app (Swift + SwiftUI) for:
  - System-level monitoring (active app, desktop, monitor)
  - Local git repository monitoring
  - Menu bar interface
  - Notifications and interventions
- Safari App Extension for browser activity tracking
- Local-first data with sync to backend services

**Architecture Evolution:**
```
Current: Backend services for integrations and AI
Future:  Backend services + Native macOS client for monitoring and UX
```

### Why This Hybrid Works

**Backend handles:**
- MCP server integrations (already built)
- AI content generation (already built)
- Activity storage (already built)
- OAuth flows (already built)

**Native client handles:**
- System monitoring (can't do from web)
- Desktop/monitor tracking (requires macOS APIs)
- Browser activity (Safari extension)
- Notifications (native macOS)
- Menu bar UX (always visible)

**Integration:** Native client → Supabase Edge Functions → MCP servers → Tools

---

## How Code Fits the Refactor

### What Stays Exactly As-Is

**Keep using:**
- `apps/api/src/connectors/` - MCP integrations work for both visions
- `supabase/functions/` - Edge Functions still needed
- `packages/shared/` - Shared schemas and utilities
- Database migrations - Data storage still required
- OAuth flows - Authentication still needed

**Don't change:**
- AGENTS.md coding standards (still apply)
- Git workflow (still using Jira IDs)
- MCP server patterns (still best practice)
- TypeScript strict mode (still enforced)

### What Gets Added

**New directories:**
```
80HD/
├── apps/
│   ├── api/src/          (existing - keep)
│   ├── web/              (existing - maybe repurpose for dashboard)
│   └── macos/            (NEW - native Swift app)
│       ├── 80HD.xcodeproj
│       ├── Sources/
│       │   ├── Monitors/      (Git, System, Browser)
│       │   ├── Models/        (ContextSnapshot, WorkSession)
│       │   ├── Views/         (Menu bar, Chat window)
│       │   └── Services/      (Supabase client, API calls)
│       └── SafariExtension/
└── docs/
    └── cave-mode/        (NEW - cave mode specific docs)
```

### What Gets Refocused

**Existing components, new purpose:**

**`apps/api/src/intelligence/`:**
- Before: Filter/prioritize interruptions
- After: Detect work modes, calculate collaboration debt, generate updates

**`apps/api/src/connectors/`:**
- Before: Fetch activity for consolidation
- After: Fetch activity for context + post generated updates

**`apps/web/`:**
- Before: Dashboard for filtered activity
- After: Dashboard for collaboration visibility, intervention history, pattern insights

**Database schema:**
- Before: Store activities for filtering
- After: Store context snapshots, work sessions, interventions, patterns

---

## Refactor Strategy

### Phase 1: Backend Refocus (Current Sprint)

**Goal:** Adapt existing backend to support cave mode detection

**Tasks:**
1. Add work mode detection logic to `intelligence/`
2. Create collaboration debt calculation
3. Update database schema for context snapshots and interventions
4. Modify connectors to support posting (not just fetching)
5. Add sacred time rules to scheduler

**Deliverables:**
- Edge Functions detect work modes
- API can calculate collaboration debt
- Database stores work sessions and patterns
- Connectors can post to GitHub/Teams/Linear

### Phase 2: Native Client Foundation (Next)

**Goal:** Build minimal macOS app

**Tasks:**
1. Create Xcode project
2. Menu bar app with basic UI
3. Git monitoring (local repositories)
4. System monitoring (active app, desktop)
5. Supabase client (call Edge Functions)

**Deliverables:**
- Menu bar icon
- Context gathering works
- Can query backend for suggestions

### Phase 3: Intelligence Integration

**Goal:** Connect native client to backend intelligence

**Tasks:**
1. Safari extension for browser tracking
2. Full context upload to backend
3. Receive intervention suggestions
4. Display notifications
5. Chat interface

**Deliverables:**
- Full work mode detection
- Nudges appear at right times
- Can chat with 80HD

---

## How to Explain This to Claude Code

**Use this narrative:**

```
We're refactoring 80HD to focus on its real mission: solving the cave 
mode problem.

Cave mode: When I'm in deep focus on complex IaC/infrastructure work, 
collaboration becomes invisible. This causes trust issues with teams and 
anxiety about being perceived as non-collaborative.

The solution: Make collaboration easier than not collaborating by 
automatically monitoring my work context, detecting my ADHD patterns 
(deep focus, struggling, pressure), and auto-generating updates for 
GitHub, Teams, Linear, and Confluence at the right time.

Our existing infrastructure (Supabase, MCP servers, Edge Functions) is 
perfect for this - we're just refocusing what we use it for:
- Before: Filter interruptions
- After: Generate collaboration

We'll eventually add a native macOS client for system-level monitoring 
and better UX, but the backend services we've built are exactly what we 
need.

This is part of my Q1 2026 GitOps initiative where I need high 
visibility with 5 teams during Platform Enablement's cultural 
transformation.
```

---

## Success Criteria

**You'll know the refactor is working when:**

1. **Backend detects work modes** - Can identify deep focus vs struggling vs pressure
2. **Collaboration debt calculated** - Knows when Travis needs to post update
3. **Multi-channel posting works** - Can post to GitHub, Teams, Linear simultaneously
4. **Sacred time respected** - Never nudges during 9-12am
5. **Travis feels less anxious** - Trust building, not trust eroding
6. **GitOps visibility improves** - Teams see consistent updates on IaC work

---

## Next Steps

1. **Update README and CLAUDE docs** (already done)
2. **Brief Claude Code** on the refactor (use narrative above)
3. **Start Phase 1** - Adapt backend for cave mode detection
4. **Test with real work** - Use during actual GitOps tasks
5. **Iterate based on anxiety levels** - Does it help or add overhead?

---

## Key Reminders

**For Claude Code:**
- This is a refactor, not a rewrite
- Existing infrastructure stays and is valuable
- We're refocusing purpose, not changing tech
- All current coding standards still apply
- Git workflow (Jira IDs) unchanged

**For Travis:**
- Don't throw away existing work
- Backend services are perfect for this
- Native client comes later
- Test backend changes with real GitOps work
- Measure by anxiety levels and team trust
