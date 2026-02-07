# 80HD Context Model

This document explains how 80HD interprets Travis's work patterns and behaviors to make intelligent decisions about when and how to intervene.

## Physical Context Understanding

### Monitor & Desktop Configuration

```
Travis's Setup:
├── LEFT Monitor (Horizontal)
│   ├── Desktop 1: Claude Code (focus workspace)
│   └── Desktop 2: Teams + Outlook (comms hub)
│
└── RIGHT Monitor (Vertical)
    ├── Top: Firefox browsers (research/tools)
    └── Bottom: Terminals (git/builds/ssh)

Interpretation Rules:
1. Hours on Desktop 1 = Deep focus in Claude Code
2. Desktop 2 switch = Checking communications
3. Right monitor active = Reference/research alongside code
4. Rapid desktop switching = Distraction or multitasking
```

### Monitor Activity Signals

```swift
func interpretMonitorContext(_ context: PhysicalContext) -> WorkMode {
    let desktop1Duration = context.hoursOnDesktop(1)
    let desktop2LastCheck = context.hoursSinceDesktop(2)
    let rightMonitorActive = context.isRightMonitorActive()
    
    if desktop1Duration > 2 && desktop2LastCheck > 1 {
        // Deep in Claude Code, hasn't checked comms
        return .deepFocus
    }
    
    if rightMonitorActive && context.firefoxSwitches > 15 {
        // Lots of browser tab switching
        return .researching
    }
    
    if context.desktopSwitches > 10 {
        // Frequent desktop changes
        return .distracted
    }
    
    return .normal
}
```

## Time-Based Context

### Daily Schedule Understanding

```
8:00-9:00 AM: House Mode
├── NOT work time
├── System active but not working
├── 80HD: Ignore this window
└── Detection: Learn pattern over weeks

9:00-12:00 PM: Sacred Focus Time
├── PRIME focus window
├── Vyvanse peak (2-3 hours after dose)
├── 80HD: Protect aggressively, no interruptions
└── Exception: Critical emergency only

12:00-2:00 PM: Tapering Energy
├── Still productive but declining
├── 80HD: Gentle nudges acceptable
└── Good for wrapping up tasks

2:00 PM+: Collaborative Time
├── Lower energy, more social
├── Meetings naturally happen here
├── 80HD: Proactive suggestions welcome
└── Perfect for updates/posts
```

### Time Context Logic

```swift
func shouldIntervene(at time: Date) -> Bool {
    let hour = Calendar.current.component(.hour, from: time)
    
    // Never during house time (8-9am)
    if hour >= 8 && hour < 9 {
        return false
    }
    
    // Never during sacred focus (9am-12pm) unless critical
    if hour >= 9 && hour < 12 && !isCritical {
        return false
    }
    
    // Okay during tapering (12-2pm) if gentle
    if hour >= 12 && hour < 14 && isGentle {
        return true
    }
    
    // Preferred during collaborative time (2pm+)
    if hour >= 14 {
        return true
    }
    
    return false
}
```

## Work Mode Detection

### Deep Focus Mode

**Signals:**
```
Positive Indicators:
├── Desktop 1 active for 2+ hours
├── Steady commit rate (0.5-2 per hour)
├── Low app switching (<5 per hour)
├── Terminal active (tests running)
├── Desktop 2 unchecked (1+ hours)
└── Claude Code has focus

Interpretation: "In the zone, making progress"

80HD Response: Don't interrupt, just monitor and capture context
```

**Code:**
```swift
func isDeepFocus(_ context: ContextSnapshot) -> Bool {
    return context.desktop1Duration > 2.hours &&
           context.commitRate > 0.5 &&
           context.appSwitches < 5 &&
           context.desktop2LastCheck > 1.hour
}
```

### Struggling Mode

**Signals:**
```
Indicators:
├── No commits for 2+ hours
├── High browser switching (20+ per 15min)
├── Heavy MCP usage (5+ Firecrawl calls)
├── Long Claude conversations (30+ messages)
├── Same error patterns in terminal
├── Rapid tab switching in Firefox
└── Stack Overflow/docs heavy research

Interpretation: "Stuck on problem, needs help"

80HD Response: Suggest posting question or rubber ducking
```

**Code:**
```swift
func isStruggling(_ context: ContextSnapshot) -> Bool {
    let timeSinceCommit = context.hoursSinceLastCommit()
    let firefoxSwitches = context.firefoxSwitchesPer15Min()
    let mcpCalls = context.mcpCallsPer15Min()
    let claudeLength = context.claudeConversationLength()
    
    // Research loop pattern
    if timeSinceCommit > 2 &&
       firefoxSwitches > 20 &&
       mcpCalls.firecrawl > 5 {
        return true
    }
    
    // AI-assisted struggling
    if timeSinceCommit > 1 &&
       claudeLength > 30 &&
       mcpCalls.firecrawl > 3 {
        return true
    }
    
    return false
}
```

### Pressure Mode

**Signals:**
```
Indicators:
├── Commits to main (not feature branch)
├── Ignoring Desktop 2 for 4+ hours
├── Breaking normal workflow patterns
├── No Linear updates despite activity
├── Working during off hours (8-9am, late)
├── Skipping PR/review process
└── High urgency, low process

Interpretation: "Deadline pressure, tunnel vision"

80HD Response: Offer to handle comms, don't interrupt focus
```

**Code:**
```swift
func isPressureMode(_ context: ContextSnapshot) -> Bool {
    let signals: [Bool] = [
        context.hasCommitsToMain() && !context.isHotfix(),
        context.hoursSinceDesktop2Check() > 4,
        context.hasDeadlineWithin(hours: 24),
        context.workingDuringOffHours(),
        context.noLinearUpdatesButHighActivity()
    ]
    
    // 2+ pressure signals = pressure mode
    return signals.filter { $0 }.count >= 2
}
```

### Communication Mode

**Signals:**
```
Indicators:
├── Desktop 2 active (Teams/Outlook)
├── Typing in Teams
├── Teams call active
├── Multiple email sends
├── Calendar event in progress
└── Low code activity

Interpretation: "Actively collaborating"

80HD Response: No nudges, collaboration already happening
```

## Collaboration Debt Calculation

### Debt Formula

```swift
struct CollaborationDebt {
    let hoursSinceUpdate: Double
    let workIntensity: Double // 0.0 - 1.0
    
    var score: Double {
        return hoursSinceUpdate * workIntensity
    }
    
    var level: DebtLevel {
        switch score {
        case 0..<24: return .low
        case 24..<48: return .medium
        default: return .high
        }
    }
}
```

### What Counts as an "Update"

```
Collaboration Activities (resets debt):
├── Git push (commits visible)
├── GitHub Discussion post
├── Teams message to project channel
├── Linear comment or update
├── PR created or commented
├── Confluence page updated
└── Any artifact posted to channels

Non-Collaboration (doesn't reset):
├── Local commits (not pushed)
├── Reading messages (not responding)
├── Viewing Linear (not updating)
├── Private DMs
└── Internal notes
```

### Work Intensity Factor

```swift
func calculateWorkIntensity(_ context: ContextSnapshot) -> Double {
    var intensity = 0.0
    
    // Code changes
    intensity += min(Double(context.commits) * 0.1, 0.4)
    
    // Files affected
    intensity += min(Double(context.filesChanged) / 20, 0.3)
    
    // Focus duration
    if context.focusDuration > 3.hours {
        intensity += 0.3
    }
    
    return min(intensity, 1.0)
}
```

## Struggle Detection (Technical Signals)

### Research Loop Pattern

```
Pattern:
├── No commits for 2+ hours
├── 15+ Firefox tabs open
├── Stack Overflow, GitHub issues, docs
├── 20+ tab switches per 15 minutes
├── 5+ Firecrawl MCP calls (desperate scraping)
└── Copy/pasting code, trying things

Interpretation: "Can't find answer, getting frustrated"

Suggestion: "Lots of research, no commits. Want to post what you're trying to solve?"
```

### AI-Assisted Struggling

```
Pattern:
├── Long Claude Code conversation (30+ messages)
├── Iterating on same problem
├── Multiple approaches tried
├── Heavy Firecrawl usage alongside Claude
├── Still no commit (solution not found)
└── Conversation going in circles

Interpretation: "Even AI can't solve it alone, needs human input"

Suggestion: "You and Claude have been at this a while. Want another perspective?"
```

### Build/Test Failure Loop

```
Pattern:
├── Terminal showing errors
├── Same error repeating (3+ times)
├── Git status: no staged changes
├── Code reverts (trying and failing)
└── Time stuck on same problem

Interpretation: "Hitting a technical wall"

Suggestion: "Hitting a wall? Worth asking team?"
```

## Pressure Detection (Behavioral Signals)

### Commits to Main Pattern

```
Normal Flow:
feature/xyz → PR → review → merge to main

Pressure Flow:
commit directly to main

Detection:
git log main --since="1 hour" --author="Travis"
└── If commits found → Pressure signal

Interpretation: "Bypassing process, emergency mode"

Response: "Hot fix or deadline push? Want me to handle comms?"
```

### Communication Blackout Pattern

```
Normal: Check Desktop 2 every 1-2 hours
Pressure: No Desktop 2 for 4+ hours

Detection:
hoursSinceDesktop2() > 4 && isWorkHours()

Interpretation: "Tunnel vision, ignoring everything else"

Response: "Been heads-down for 4 hours. Want me to check if anyone's blocked?"
```

### Off-Hours Work Pattern

```
Normal: 9am-5pm primarily
Pressure: Working during 8-9am (house time) or very late

Detection:
hour in [8...9) || hour >= 23

Interpretation: "Desperation mode, working unusual hours"

Response: Offer help, no judgment about timing
```

## Intervention Decision Tree

```
Every 5 minutes evaluation:

1. Check Time Window
   ├── 8-9am? → Don't intervene (house time)
   ├── 9am-12pm? → Only if critical (sacred focus)
   ├── 12-2pm? → Gentle nudges okay
   └── 2pm+? → Full intervention capability

2. Check Work Mode
   ├── Deep Focus? → Don't interrupt (monitor only)
   ├── Struggling? → Offer help
   ├── Pressure? → Offer to handle comms
   └── Communication? → No nudge (already collaborating)

3. Check Collaboration Debt
   ├── LOW? → No action needed
   ├── MEDIUM? → Queue for later
   └── HIGH? → Suggest update (if good timing)

4. Check Upcoming Events
   ├── Chris 1:1 in <24h? → Prep Wednesday evening
   ├── Standup in <2h? → Offer to generate notes
   └── Deadline in <24h? → Check if update needed

5. Make Decision
   ├── Intervene now? → Show notification
   ├── Queue for later? → Set reminder
   └── Do nothing? → Continue monitoring
```

## Learning & Adaptation

### What 80HD Learns

```
Patterns Over Time:
├── Best intervention times (time of day)
├── Successful nudge approaches (wording)
├── Typical focus duration before break
├── Medication effects (if observable)
├── Context switch recovery time
├── Preferred update formats
└── Response patterns (approve/dismiss)

Example Learning:
Week 1: Nudge at 10am → Dismissed (too early)
Week 2: Nudge at 2pm → Approved (good timing)
Week 3: Nudge at 4pm → Approved (also good)
Learning: "Afternoon nudges work better than morning"

Model Update: Prefer 2pm-5pm window for interventions
```

### Medication Context (Vyvanse)

```
What 80HD Tracks:
├── Baseline patterns on medication
├── Changes if dose increases
├── Focus duration changes
├── App switching frequency changes
├── Best focus times changes
└── Context switch recovery changes

What 80HD Does NOT Assume:
├── Medication "should" have certain effects
├── Patterns will change predictably
└── One pattern fits all

Approach: Observe, learn, adapt. No assumptions.
```

## Context Snapshot Structure

```json
{
  "timestamp": "2026-02-01T14:47:00Z",
  
  "physical": {
    "active_desktop": 1,
    "active_monitor": "left_horizontal",
    "last_desktop_switch": "45 minutes ago",
    "right_monitor_active": true,
    "mouse_monitor": "left"
  },
  
  "work": {
    "current_repo": "firehydrant",
    "commits_today": 8,
    "commits_to_main": 0,
    "branch": "feature/spacelift-integration",
    "time_since_commit": "18 minutes",
    "uncommitted_changes": true,
    "files_changed": 12,
    "terminal_active": true
  },
  
  "communication": {
    "teams_status": "available",
    "teams_in_call": false,
    "teams_messages_sent": 2,
    "teams_last_active": "47 minutes ago",
    "outlook_in_meeting": false,
    "outlook_unread": 12,
    "emails_sent": 0
  },
  
  "project_management": {
    "linear_issues_viewed": 1,
    "linear_comments": 0,
    "linear_last_update": "yesterday",
    "github_pr_activity": "none",
    "azure_devops_activity": "none"
  },
  
  "browser": {
    "firefox_active_domain": "stackoverflow.com",
    "firefox_tabs_estimate": 15,
    "firefox_switches_15min": 8,
    "domains_visited": ["stackoverflow.com", "github.com", "docs.python.org"]
  },
  
  "system": {
    "active_app": "Visual Studio Code",
    "app_switches_hour": 4,
    "do_not_disturb": false,
    "idle_time": 0
  },
  
  "mcp_usage": {
    "firecrawl_calls_15min": 3,
    "total_calls_hour": 12,
    "elevated": true
  },
  
  "claude_code": {
    "conversation_active": true,
    "thread_length": 24,
    "duration_minutes": 45,
    "topic_inferred": "terraform state migration"
  },
  
  "derived_metrics": {
    "work_mode": "normal_work_with_ai",
    "focus_duration": "2h 15m",
    "collaboration_debt": "HIGH",
    "struggle_signals": ["elevated_mcp", "long_claude_conversation"],
    "pressure_signals": ["ignoring_comms"],
    "intervention_recommended": false,
    "reason": "In productive AI-assisted work, let continue"
  }
}
```

## Response Templates

### Struggling Responses

```
Research Loop:
"Seeing lots of research on [topic]. Want to post a question to the team?"

AI-Assisted:
"You and Claude have been going back and forth on this. Want another perspective?"

Build Failures:
"Hitting a wall with [error]? Worth asking if someone's seen this?"

General:
"Been at this for a bit. Want to rubber duck with the team?"
```

### Pressure Responses

```
Commits to Main:
"Noticed commits to main. Hot fix or deadline push? Want me to handle the comms?"

Communication Blackout:
"You've been heads-down for 4 hours, deadline in 6. Want me to:
- Post a 'working on it' update
- Check if anyone's blocked on you
- Queue your messages for after?"

Off-Hours:
"Working late on [project]. Need help or want me to draft a status update?"
```

### Collaboration Debt Responses

```
Medium Debt (24-48h):
"Been a bit since last update. Ready to share progress?"

High Debt (48h+):
"Made progress on [project]. Want me to draft an update?"

With Upcoming Event:
"Chris 1:1 tomorrow. Want me to prep your wins/blockers?"
```

## Privacy Preservation

### What Gets Captured

```
Metadata Only:
├── Counts (commits, messages, tabs)
├── Timing (when things happened)
├── Domains (github.com, not full URL)
├── Durations (how long in each state)
├── Patterns (switching frequency)
└── States (in meeting yes/no, status)

NEVER:
├── Message content
├── Email content
├── Meeting titles/details
├── Document contents
├── Full URLs
├── Passwords
├── Keystrokes
└── File contents
```

### Example Safe vs. Unsafe

```
✅ SAFE:
"Teams messages sent: 5"
"Active domain: github.com"
"In meeting: true"
"Commits today: 8"

❌ UNSAFE:
"Teams message: 'Hey can you...'"
"Active URL: github.com/private-repo/secret-feature"
"Meeting: '1:1 with Chris about performance review'"
"Commit message: 'Fixed the auth bypass vulnerability'"
```
