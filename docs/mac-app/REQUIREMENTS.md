# 80HD Requirements

## User Profile: Travis Thompson

### Role & Context
- **Position:** Platform Enablement Team Lead
- **Company:** ECI Solutions
- **Location:** Fredericton, New Brunswick, Canada
- **Work Mode:** Remote (work from home)
- **Condition:** ADHD (starting Vyvanse treatment)
- **Primary Challenge:** Collaboration visibility during hyperfocus states

### Physical Setup

**Dual Monitor Configuration:**
```
LEFT Monitor (Horizontal):
├── Desktop 1: Claude Code (primary workspace)
│   └── This is where FOCUS happens
│
└── Desktop 2: Teams + Outlook (communications)
    └── Monitoring/checking mode

RIGHT Monitor (Vertical):
├── Top Half: Firefox browsers
│   ├── GitHub, Linear, Jira, Confluence
│   ├── Documentation, research
│   └── Multiple tabs typical
│
└── Bottom Half: Terminals
    ├── Git commands
    ├── Build/test output
    └── SSH sessions
```

**Key Pattern:**
- Hours on left monitor (Desktop 1) = Deep focus in Claude Code
- Periodic switches to Desktop 2 = Checking comms
- Right monitor active alongside left = Simultaneous coding + research

### Tool Ecosystem

**Version Control:**
- **Primary Git Hosting:** Azure DevOps + GitHub
- **Usage:** Azure DevOps for VCS (repos, PRs, pipelines), GitHub for code + Issues + Discussions

**Project Management:**
- **Source of Truth:** Linear
- **Sync Pattern:** Linear → GitHub Issues + Jira
- **Azure DevOps Boards:** Not used
- **Jira:** Issues only (synced from Linear)

**Communication:**
- **Primary:** Microsoft Teams (all day - chat + meetings)
- **Email:** Outlook
- **Video:** Teams primary, occasional Zoom/Google Meet for vendors

**Browser:**
- **Primary:** Firefox (migrating to Safari for 80HD integration)

**Documentation:**
- **Internal:** Confluence
- **Technical:** GitHub Discussions

**Development:**
- **Primary IDE:** Claude Code
- **Version Control:** Git
- **CI/CD:** Monitored via Azure DevOps

### Daily Schedule

**Morning (8:00 AM - 9:00 AM): House Mode**
- NOT work time
- Dishes, laundry, dinner prep
- 80HD should NOT track or consider this work time
- System active ≠ work happening

**Prime Focus (9:00 AM - 12:00 PM): SACRED TIME**
- Best deep work window
- Protect aggressively
- No nudges unless critical emergency
- Peak Vyvanse effectiveness (2-3 hours after morning dose)
- This is THE window for flow state

**Tapering (12:00 PM - 2:00 PM): Still Productive**
- Energy declining but workable
- Gentle nudges acceptable
- Good for wrapping up tasks
- Context switches start happening

**Collaborative Time (2:00 PM+): Social Hours**
- Energy lower, less deep work capacity
- More meetings naturally occur here
- Central timezone colleagues online
- Perfect for updates, posts, administrative tasks
- 80HD can be more proactive with suggestions

**Lunch:** Inconsistent timing, not a reliable marker

**Weekends:** Work common, treat as normal work time

### Work Patterns & Triggers

#### Cave Mode Triggers

**Trigger 1: Hyperfocus on Interesting Problem**
```
Pattern:
- Deep in code
- Making steady progress
- Low app switching
- Commits happening regularly

80HD Strategy:
- Let him cook
- Capture context silently
- Intervention AFTER session: "Want to share what you built?"
```

**Trigger 2: Pressure/Deadline**
```
Pattern:
- Commits directly to main (not feature branch)
- Ignoring Desktop 2 (Teams/Outlook) for 4+ hours
- Breaking normal workflow patterns
- No Linear updates despite activity
- Working during "off hours" (8-9am, very late)

80HD Strategy:
- Detect broken patterns
- Offer to handle comms: "In rush mode? Want me to post a WIP update?"
- Don't interrupt the work, support it
```

**Trigger 3: Struggling with Problem**
```
Pattern:
- No commits for 2+ hours
- High Firefox tab/window switching (20+ per 15 min)
- Heavy MCP tool usage (5+ Firecrawl calls per 15 min)
- Long Claude Code conversations (30+ messages)
- Repeated error patterns in terminal

80HD Strategy:
- Detect stuckness early
- Suggest help: "Been researching for a bit. Want to post a question?"
- Offer rubber ducking: "Want to talk through it?"
```

### Collaboration Patterns

**Current State:**
- "Here's a thing, go look at it" (post-completion sharing)
- Minimal mid-stream updates
- No pre-work collaboration

**Desired State:**
- Continual progress updates
- Asking for feedback proactively
- Inviting participation
- Building trust through visibility

**Fear:**
- "No matter which way I go, it'll be ignored"
- Builds distrust when work isn't visible
- Creates anxiety about cave mode

**80HD Strategy:**
- Multi-channel distribution (GitHub + Teams + Linear + Confluence)
- Make it impossible to ignore
- Track engagement as trust indicator

### Meeting Patterns

**Recurring Meetings:**
- **Daily Standups:** With immediate team (time TBD from calendar)
- **Thursday 11:00 AM:** 1:1 with Chris (direct manager)
  - Critical prep needed Wednesday evening
  - Needs: wins, blockers, next steps, questions
- **All-Hands:** Less frequent
- **No Client Meetings:** Internal focus only

**Meeting Culture:**
- Meeting-heavy organization
- Lots of async via Teams
- Frequent interruptions
- Jump on Teams calls for collaboration

### Medication Context

**Starting:** February 2, 2026 (tomorrow from conversation date)
**Medication:** Vyvanse (starting low dose, may increase)
**Timing:** Morning dose
**Peak Effect:** 2-3 hours after dose (aligns with 9am-12pm focus window)

**80HD Considerations:**
- Learn baseline patterns on medication
- Don't ASSUME changes, OBSERVE changes
- Track: focus duration, app switching frequency, context switch recovery
- Adapt intervention timing as patterns stabilize
- If dose changes, re-learn patterns

### Energy & Focus Patterns

**Best Deep Work:** Mid-morning to early afternoon (9am-2pm)

**Most Social/Collaborative:** Central timezone hours (typically 2pm+)

**Context Switch Recovery:** 15-30 minutes to regain flow after interruption

**Leave Me Alone Time:** TBD (may not need dedicated time)

### Struggle Indicators (Technical Signals)

**Research Loop:**
- Firefox tabs proliferating
- Stack Overflow, docs, GitHub issues
- No forward progress in git

**Build/Test Failures:**
- Terminal showing repeated errors
- Same error pattern multiple times
- Git status: no staged changes

**Code Churn:**
- Same files edited repeatedly
- Commits then reverts
- No net progress

**Avoidance:**
- Task switching between unrelated work
- No sustained focus period
- High app switching rate

**AI-Assisted Struggling:**
- Long Claude Code conversation threads
- Heavy Firecrawl MCP usage (web scraping)
- Asking same question different ways

### Pressure Indicators (Behavioral Signals)

**Commits to Main:**
- Bypassing normal feature branch workflow
- Committing directly to main
- Skipping PR/review process

**Communication Blackout:**
- 4+ hours without checking Desktop 2
- Teams messages piling up
- Outlook unread count climbing

**Process Breaking:**
- No Linear updates despite work activity
- No documentation being created
- Skipping normal checkpoints

**Off-Hours Work:**
- Working during 8-9am (house time)
- Very late nights
- Weekend emergency sessions

### Distribution Preferences

**Primary Channels (Always Post):**
1. **GitHub Discussions** - Technical depth, developer audience
2. **Microsoft Teams** - Broad awareness, quick updates
3. **Linear Comments** - Project management view, status

**Secondary Channels (Context-Dependent):**
4. **Confluence** - Architectural decisions (ADRs), documentation
5. **Jira** - Only if unique context needed (rare, usually synced from Linear)

**Multi-Channel Strategy:**
```
Example workflow for significant work:

1. GitHub Discussion:
   - Full technical context
   - Code references, architectural decisions
   - For: Developers, technical stakeholders

2. Teams Post:
   - 2-sentence summary + link to discussion
   - For: Broad team awareness
   - "FYI, working on X, details here →"

3. Linear Comment:
   - Update on related issue
   - Links to discussion and Teams post
   - For: Project management view

4. Confluence Page (if applicable):
   - ADR or runbook
   - For: Long-term reference
   - Links back to discussion

Result: Hard to ignore, builds trust through visibility
```

### Success Metrics

**Primary Metrics (Most Important):**
1. **Trust Increases**
   - With immediate team
   - With other teams
   - With leadership
   
2. **Anxiety Decreases**
   - About cave mode
   - About collaboration
   - About being perceived as non-collaborative

**Secondary Metrics:**
- Collaboration debt stays low
- Updates happen naturally without effort
- Zero time spent on "collaboration overhead"
- Hyperfocus without guilt
- Work visible by default

**Trust Indicators (Observable):**
- Engagement on posts (comments, reactions, views)
- Fewer "what's the status?" questions
- Getting looped in earlier on decisions
- Positive feedback in 1:1s
- Team adopting work/recommendations

**Anxiety Indicators (Self-Reported):**
- Weekly self-assessment (scale 1-10)
- Trend over time (goal: decreasing)
- Sentiment in 80HD chats
- Stress signals (app switching, late nights)

### Nightmare Scenarios (What We're Preventing)

1. **Adoption Failure:**
   - Building everything
   - No one uses it
   - Perception: "Travis doesn't understand our needs"

2. **Trust Erosion:**
   - Lost trust from stakeholders
   - Perceived as non-collaborative
   - Career impact despite good work

3. **Burnout:**
   - Constant anxiety about collaboration
   - Guilt about hyperfocus
   - Overhead killing productivity

### What Makes Collaboration "Good Enough"

**Minimum Viable Collaboration:**
- Updates within 24 hours of significant work
- Proactive "stuck" signals before others ask
- Weekly rhythm of visibility
- Responses to direct questions within 4 hours

**Ideal Collaboration:**
- Near-real-time awareness of work
- Proactive feedback requests
- Invitations to participate
- No surprises for stakeholders

**80HD's Role:**
- Make "good enough" automatic
- Make "ideal" achievable
- Remove friction that prevents both

### Context-Specific Needs

**For IaC/GitOps Initiative (Q1 2026):**
- 9 projects (4 tactical, 5 strategic)
- 5 teams involved (2 favorable, 3 resistant)
- High visibility needed
- Regular updates critical for buy-in

**For Platform Enablement Work:**
- Cultural transformation focus
- Demonstrating value through visibility
- Building trust with resistant teams
- Standing out professionally

### Integration Requirements

**Must Integrate:**
- Linear (source of truth, MCP server exists)
- GitHub (code + discussions, MCP server exists)
- Microsoft Teams (primary comms, custom MCP needed)
- Outlook (calendar + email, custom MCP needed)
- Azure DevOps (VCS + pipelines, custom MCP needed)
- Git (local monitoring, direct file system access)
- Safari (browser tracking, native extension)
- macOS System (apps, windows, desktops, native APIs)

**Nice to Have:**
- Jira (synced from Linear, lower priority)
- Confluence (documentation, can be manual initially)
- Zoom (occasional vendor calls, lower priority)

### Privacy Requirements

**Must Never Store:**
- Email/Teams message content
- Meeting titles or details
- Document contents
- Full URLs (domains only)
- Passwords or credentials
- File contents
- Keystrokes

**Can Store (Metadata Only):**
- Commit messages (git)
- Counts (emails sent, Teams messages)
- Timing (when things happened)
- Domains visited (github.com, not full URL)
- App usage (which app, not what you did)
- Meeting attendance (yes/no, not details)

**Security Requirements:**
- All data local only (never leaves Mac)
- Database encrypted at rest
- OAuth tokens in Keychain
- No cloud sync
- User can delete all data anytime

### Non-Requirements (Out of Scope)

**Not Building:**
- Automatic posting without approval
- Time tracking/billing
- Performance monitoring for management
- Activity surveillance
- Keystroke logging
- Screen recording
- File content analysis

**Philosophy:**
- Trust-building tool, not monitoring tool
- For Travis's benefit, not management's
- Reduces anxiety, doesn't create it
- Helps collaboration, doesn't force it
