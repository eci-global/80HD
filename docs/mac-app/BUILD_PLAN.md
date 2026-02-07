# 80HD Build Plan

## Development Philosophy

**User's Role:**
- Understand architecture and concepts
- Make high-level decisions
- Know what each component does
- Direct implementation priorities
- Test and provide feedback

**Claude Code's Role:**
- Write all Swift code
- Implement technical decisions
- Handle syntax and implementation details
- Debug technical issues
- Explain architectural choices

## Phased Implementation

### Phase 1: Foundation (Week 1)
**Goal:** Working menu bar app with basic monitoring

**Deliverables:**
- [ ] Xcode project structure
- [ ] Menu bar icon and basic menu
- [ ] SQLite database setup (encrypted)
- [ ] Basic Git monitoring (commits, branch)
- [ ] Active app detection (NSWorkspace)
- [ ] Simple chat window skeleton (SwiftUI)
- [ ] Data models (ContextSnapshot, WorkSession)

**Technical Tasks:**
```swift
// Menu bar
- NSStatusItem setup
- Basic menu with status display
- Chat window toggle

// Database
- SQLite.swift integration
- Create schema (work_sessions, context_snapshots)
- Basic CRUD operations
- SQLCipher for encryption

// Monitoring
- GitMonitor: Parse .git directory for commits
- SystemMonitor: NSWorkspace for active app
- Timer: Every 5 minutes, capture snapshot

// UI
- MenuBarView (SwiftUI)
- ChatWindow (basic structure)
- AppState (global state management)
```

**Success Criteria:**
- Menu bar icon visible
- Database creates successfully
- Captures git commits
- Knows which app is active
- Can open chat window

---

### Phase 2: Core Monitoring (Week 2)
**Goal:** Comprehensive context gathering from all sources

**Deliverables:**
- [ ] System activity MCP server (custom)
- [ ] Enhanced git monitoring (files changed, branch strategy)
- [ ] Desktop/monitor tracking (which desktop active)
- [ ] Context aggregation (parallel monitoring)
- [ ] Snapshot storage with history
- [ ] Basic pattern detection (focus duration)

**Technical Tasks:**
```swift
// System Monitoring
- Track active desktop (NSWorkspace.shared.frontmostApplication)
- Track mouse position (CGEvent) to determine monitor
- Desktop switch detection
- Window title reading (for browser tabs)

// Git Enhancement
- Files changed in commit
- Detect commits to main vs. feature branch
- Branch naming patterns
- Uncommitted changes detection

// Context Aggregator
- Run monitors in parallel (async/await)
- Handle monitor failures gracefully
- Aggregate results into ContextSnapshot
- 5-minute periodic capture

// Pattern Detection (Simple)
- Calculate focus duration
- Detect desktop switching patterns
- Identify work modes (deep focus vs. checking comms)
```

**Success Criteria:**
- Knows which desktop is active
- Detects commits to main
- Captures full git context
- Monitors run independently
- Database has rich snapshots

---

### Phase 3: Auth & Integrations (Week 3)
**Goal:** Connect to external services (Linear, GitHub, Teams, Outlook)

**Deliverables:**
- [ ] OAuth 2.0 flow (local callback server)
- [ ] macOS Keychain integration
- [ ] Linear integration (official MCP server)
- [ ] GitHub integration (community MCP server)
- [ ] Microsoft Graph integration (custom MCP server)
- [ ] Azure DevOps integration (custom MCP server)
- [ ] Full context gathering (all sources)

**Technical Tasks:**
```swift
// OAuth Manager
- LocalCallbackServer (localhost:8080)
- Browser-based authorization flow
- Token exchange
- Keychain storage
- Auto-refresh logic

// MCP Server Integration
- MCP protocol client (JSON-RPC over stdio)
- Linear MCP server (use official)
- GitHub MCP server (find/use community)
- Custom MCP servers:
  - Microsoft Graph (Teams + Outlook)
  - Azure DevOps (repos, PRs, pipelines)

// Service Managers
- LinearMonitor (issues viewed, comments, updates)
- GitHubMonitor (PRs, discussions, issues)
- TeamsMonitor (status, messages sent count, calls)
- OutlookMonitor (calendar events, email count)
- AzureDevOpsMonitor (PR activity, pipeline runs)

// Settings UI
- Connect/disconnect services
- Show connection status
- Re-authenticate flow
```

**Success Criteria:**
- OAuth flow completes successfully
- Tokens stored in Keychain
- Can query Linear for issues
- Can query GitHub for PRs
- Can query Teams status
- Can query Outlook calendar
- All services contribute to context snapshot

---

### Phase 4: Safari Extension (Week 4)
**Goal:** Track browser activity (tabs, domains, switching)

**Deliverables:**
- [ ] Safari App Extension (Swift)
- [ ] App Groups for shared state
- [ ] Tab tracking (active, switches, domains)
- [ ] Browser activity in context snapshots
- [ ] Installation/permission flow

**Technical Tasks:**
```swift
// Safari Extension
- Safari App Extension target in Xcode
- Tab activity monitoring
- Active tab URL/title capture (domain only)
- Tab switch detection
- Window switch detection

// App Groups
- Shared UserDefaults container
- Extension writes: { url, title, timestamp }
- Main app reads: current browser context

// Browser Monitor (Main App)
- Read from App Groups
- Parse domain (github.com, not full URL)
- Track switches per time window
- Detect research patterns (many tabs)

// UI/UX
- Safari extension permission request
- Instructions for enabling
- Status indicator (connected/not connected)
```

**Success Criteria:**
- Extension shows in Safari preferences
- Can track active tab domain
- Detects tab switching frequency
- Browser data in context snapshots
- User can enable/disable

---

### Phase 5: AI Agent (Week 5)
**Goal:** Claude API integration and intelligent intervention logic

**Deliverables:**
- [ ] Anthropic Claude API client
- [ ] Intervention decision engine
- [ ] Draft generation (GitHub, Teams, Linear)
- [ ] Chat functionality (real Claude conversation)
- [ ] Notification system (macOS native)

**Technical Tasks:**
```swift
// Claude API Client
- HTTP client (URLSession)
- Messages API endpoint
- Streaming support (optional)
- Error handling (rate limits, timeouts)
- Token counting/budget management

// Intervention Engine
- Decision tree logic:
  - Check time (sacred 9-12 window)
  - Check struggle signals
  - Check pressure signals
  - Check collaboration debt
- Queue interventions for later if needed
- Calculate optimal timing

// Artifact Generator
- Prompt templates for different artifacts
- GitHub Discussion generator
- Teams post generator (2 sentences + link)
- Linear comment generator
- Context-aware content

// Chat Window
- Message history
- User input field
- Claude response display
- Streaming (optional)
- Actions (approve draft, dismiss, ask question)

// Notifications
- NSUserNotificationCenter (or UNUserNotificationCenter)
- Action buttons (View Draft, Remind Later)
- Rich notifications (show draft preview)
```

**Success Criteria:**
- Can call Claude API successfully
- Generates relevant draft updates
- Chat works (ask questions, get answers)
- Notifications appear with actions
- User can approve/dismiss interventions

---

### Phase 6: Learning & Adaptation (Week 6)
**Goal:** Pattern learning and adaptive behavior

**Deliverables:**
- [ ] Pattern recognition (work modes)
- [ ] Intervention effectiveness tracking
- [ ] Behavioral learning (timing, approach)
- [ ] Collaboration debt calculation
- [ ] Struggle detection (technical signals)
- [ ] Pressure detection (behavioral signals)

**Technical Tasks:**
```swift
// Pattern Learner
- Analyze work sessions for patterns
- Classify work modes:
  - Deep Focus
  - Struggling
  - Pressure
  - Communication
  - Context Switching
- Detect medication effects over time
- Learn best focus times

// Collaboration Debt
- Calculate hours since last update
- Weight by work intensity
- Thresholds: LOW (<24h), MEDIUM (24-48h), HIGH (>48h)
- Factor in all channels (git, Linear, Teams, GitHub)

// Struggle Detection
- No commits + high browser switching
- Heavy MCP usage (Firecrawl)
- Long Claude Code conversations
- Repeated error patterns
- Time stuck on problem

// Pressure Detection
- Commits to main (not feature branch)
- Ignoring Desktop 2 (4+ hours)
- Breaking normal workflow
- Off-hours work
- No Linear updates despite activity

// Learning Model
- Track intervention outcomes:
  - Approved → Reinforcement
  - Dismissed → Weaken pattern
  - Snoozed → Try different timing
- Adjust timing based on success
- Personalize to Travis's patterns
```

**Success Criteria:**
- Correctly identifies work modes
- Detects struggling early
- Detects pressure signals
- Calculates collaboration debt accurately
- Learns from intervention outcomes
- Improves timing over weeks

---

### Phase 7: Polish & Deployment (Week 7)
**Goal:** Production-ready application

**Deliverables:**
- [ ] Menu bar UI refinement
- [ ] Settings panel (complete)
- [ ] Error handling (comprehensive)
- [ ] Logging system
- [ ] Multiple monitor support (refinement)
- [ ] Performance optimization
- [ ] Build DMG installer
- [ ] Code signing
- [ ] Documentation (user guide)

**Technical Tasks:**
```swift
// UI Polish
- Menu bar status messages (clear, concise)
- Chat window styling (readable, clean)
- Settings organized by category
- Visual feedback (loading states)
- Keyboard shortcuts

// Error Handling
- Connection failures (show, retry)
- Token expiration (auto-refresh or prompt)
- MCP server crashes (restart)
- Database errors (backup, recover)
- API rate limits (backoff, inform user)

// Logging
- Unified logging framework
- Log levels (debug, info, warning, error)
- Rotation (don't fill disk)
- Privacy (no sensitive data)
- Export logs for debugging

// Performance
- Reduce memory footprint
- Optimize database queries
- Debounce rapid events
- Lazy loading where possible

// Deployment
- Build release configuration
- Code signing (Developer ID)
- Notarization (Apple)
- DMG creation with background image
- Auto-update mechanism (Sparkle)

// Documentation
- User guide (how to use)
- Setup instructions (OAuth, Safari)
- Troubleshooting guide
- Privacy policy (what's tracked)
```

**Success Criteria:**
- Feels polished and professional
- Handles all error cases gracefully
- Performant (low CPU, memory)
- Easy to install (.dmg)
- Clear documentation
- Ready for daily use

---

## Development Workflow

### Daily/Weekly Rhythm

**Daily:**
1. Claude Code implements specific feature/component
2. Travis tests implementation
3. Feedback → Adjustments
4. Move to next task

**Weekly:**
1. End of week: Working milestone
2. Travis uses the app in real work
3. Collect learnings for next week
4. Prioritize next phase tasks

### Git Workflow

**Branching:**
- `main` - stable, working versions
- `feature/*` - specific features
- `phase-N` - phase branches (merge when complete)

**Commits:**
- Small, focused commits
- Clear commit messages
- Reference task/feature

**Testing:**
- Manual testing per commit
- Integration testing per feature
- Real-world testing per phase

### Communication

**During Development:**
- Travis provides context and decisions
- Claude Code asks clarifying questions
- Both discuss trade-offs
- Clear handoff points

**Between Sessions:**
- Document decisions in DESIGN_DECISIONS.md
- Update this BUILD_PLAN.md with progress
- Log issues/learnings for next session

---

## Risk Management

### Technical Risks

**Risk 1: MCP Server Complexity**
- **Mitigation:** Start with official servers (Linear)
- **Fallback:** Direct API if MCP too complex
- **Test Early:** Phase 3 validates approach

**Risk 2: Safari Extension Approval**
- **Mitigation:** Follow Apple guidelines strictly
- **Fallback:** Firefox extension (more work)
- **Test Early:** Phase 4 validates permissions

**Risk 3: OAuth Token Refresh**
- **Mitigation:** Implement refresh early
- **Fallback:** Manual re-auth if fails
- **Test:** Simulate expiration scenarios

**Risk 4: Performance (CPU/Memory)**
- **Mitigation:** Profile early, optimize as needed
- **Fallback:** Reduce polling frequency
- **Test:** Monitor resource usage each phase

**Risk 5: macOS API Changes**
- **Mitigation:** Target macOS 14+ (stable)
- **Fallback:** Graceful degradation if API unavailable
- **Test:** Test on Travis's machine

### Schedule Risks

**Risk 1: Feature Creep**
- **Mitigation:** Stick to MVP per phase
- **Recovery:** Defer features to later phases

**Risk 2: Integration Complexity**
- **Mitigation:** Build custom MCP servers incrementally
- **Recovery:** Start with fewer integrations, add later

**Risk 3: Learning Curve (Swift)**
- **Mitigation:** Claude Code handles Swift details
- **Recovery:** More iterations, but Travis doesn't code

---

## Success Metrics (Per Phase)

### Phase 1: Does it run?
- App launches
- Menu bar visible
- Database works
- Basic monitoring happening

### Phase 2: Does it see my work?
- Tracks git activity
- Knows which desktop active
- Captures context snapshots
- Shows basic patterns

### Phase 3: Does it know my world?
- Connected to Linear, GitHub, Teams, Outlook
- Pulls data from all sources
- Rich context snapshots
- No manual data entry

### Phase 4: Does it see my browsing?
- Tracks active tab domain
- Detects research patterns
- Browser in context snapshots

### Phase 5: Is it intelligent?
- Suggests interventions at good times
- Generates useful drafts
- Chat is helpful
- Notifications are relevant

### Phase 6: Does it learn?
- Detects work modes correctly
- Timing improves over weeks
- Fewer false positives
- Better at detecting struggle/pressure

### Phase 7: Can I use it daily?
- Reliable (doesn't crash)
- Performant (doesn't slow Mac)
- Polished (looks professional)
- Documented (I can help myself)

---

## Definition of Done (Per Phase)

**Code:**
- [ ] Feature implemented as designed
- [ ] No compiler warnings
- [ ] Error handling in place
- [ ] Logged appropriately

**Testing:**
- [ ] Manually tested happy path
- [ ] Tested error cases
- [ ] Tested on Travis's Mac
- [ ] Edge cases considered

**Documentation:**
- [ ] Code comments for complex logic
- [ ] DESIGN_DECISIONS.md updated
- [ ] README updated if needed
- [ ] Known issues documented

**User Validation:**
- [ ] Travis tested and approved
- [ ] Feedback incorporated
- [ ] No blocking issues
- [ ] Ready for next phase

---

## Post-Launch (After Week 7)

### Weeks 8-12: Real-World Usage
- Travis uses daily
- Collect feedback
- Fix bugs
- Tune learning algorithms
- Measure success metrics (trust, anxiety)

### Weeks 13-16: Refinement
- Enhance based on learnings
- Add nice-to-have features
- Optimize performance
- Improve UX based on real patterns

### Beyond:
- Consider team features (if successful)
- Explore additional integrations
- Share learnings publicly (blog post?)
- Open source? (if appropriate)

---

## Current Status

**Phase:** Pre-Development (Documentation)

**Next Immediate Steps:**
1. Complete documentation set ✅ (in progress)
2. Set up Xcode project
3. Begin Phase 1 implementation

**Ready to Start When:**
- All documentation reviewed by Travis
- Any open questions resolved
- Claude Code has full context
- Travis has migrated to Safari
