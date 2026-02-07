# 80HD - The Observing Eye: User Guide

**Version 0.0.1**

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Dashboard](#understanding-the-dashboard)
3. [Work Modes Explained](#work-modes-explained)
4. [Sacred Time](#sacred-time)
5. [Reading Your Timeline](#reading-your-timeline)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Launch

When you first launch 80HD:

1. **Menu bar icon appears** - Look for a brain icon (🧠) in your menu bar
2. **Permission request** - macOS will ask for Screen Recording permission
   - This lets the app see which app you're using
   - Click "Open System Settings" → enable "80HD" → restart the app
3. **Monitoring starts** - The app begins capturing snapshots every 5 minutes
4. **Database created** - A local SQLite database is created at `~/Library/Application Support/80HD/`

### Opening the Dashboard

Click the brain icon in your menu bar and select "Dashboard" (or press ⌘D).

The dashboard has 3 tabs:
- **Overview** - Current session stats and live metrics
- **Timeline** - Visual timeline of your day
- **History** - (Coming soon) Past sessions and trends

---

## Understanding the Dashboard

### Tab 1: Today's Attention

This tab shows what's happening right now in your work session.

#### Live Metrics

- **Session Duration** - How long you've been working since app launch
- **Current Mode** - Your current work mode (see Work Modes Explained below)
- **Sacred Time Status** - Whether you're in the 9 AM - 12 PM protected window

#### Current Context

Shows what the app sees:

- **Active App** - The application you're currently using
- **Git Repository** - The repo you're working in (if any)
- **Branch** - Your current git branch
- **Commits Today** - How many commits you've made today
- **App Switches (last hour)** - How often you've switched apps

**Why this matters**: High app switching (20+/hour) often indicates struggling or pressure. Low switching + git activity usually means deep work.

#### Work Mode Signals

Shows what signals the app detected to determine your current work mode:

**Struggle Signals** (things that suggest you might be stuck):
- "No recent commits (last commit 3h ago)" - Haven't committed in a while
- "High app switching (25 switches/hour)" - Bouncing between apps frequently
- "No git activity detected" - Not in a repo or no commits

**Pressure Signals** (things that suggest you're under pressure):
- "High app switching (25 switches/hour)" - Rapid context switching
- "Using communication tool: Slack" - In email/chat instead of coding
- "Recent commits but high switching" - Trying to code while managing interruptions

### Tab 2: Current Session

Visual representation of your entire work day (6 AM - 6 PM).

#### Timeline Zones

The background shows different time zones:

- **Gray (6-9 AM)** - Pre-sacred time
- **Blue gradient (9 AM - 12 PM)** - **Sacred Time** (your protected focus window)
- **Orange (12-2 PM)** - Tapering time (post-sacred transition)
- **Green (2-6 PM)** - Collaborative time (acceptable for meetings/chat)

#### Work Mode Segments

Colored bars show your actual work modes:

- **🟦 Blue** - Deep Focus (flow state, focused coding)
- **🟢 Green** - Communicating (collaboration, meetings, chat)
- **🟠 Orange** - Struggling (stuck, spinning, blocked)
- **🟥 Red** - Pressure (reactive, firefighting, high stress)
- **⚪ Gray** - Normal (regular productive work)
- **⚫ Dark Gray** - Unknown (not enough data)

#### Sacred Time Markers

Two blue vertical lines mark the start (9 AM) and end (12 PM) of sacred time. Hover over the blue zone for a reminder of what sacred time means.

---

## Work Modes Explained

The app infers your work mode from observable signals. It's not perfect, but it gives you awareness.

### 🟦 Deep Focus

**What it means**: You're in flow state - focused, making progress, minimal distractions.

**How it's detected**:
- Working in a focus app (Xcode, VS Code, Terminal, IntelliJ, etc.)
- Low app switching (<10/hour)
- Active coding (commits or uncommitted changes)

**What to do**: Protect this state. Don't check Slack. Don't open email. Keep going.

---

### 🟢 Communicating

**What it means**: You're collaborating with your team. Meetings, chat, code review discussions.

**How it's detected**:
- Using communication tools (Slack, Teams, Zoom, Outlook)
- Detected regardless of other signals

**What to do**: This is productive collaboration. The app won't interrupt you with reminders while you're already collaborating.

---

### 🟠 Struggling

**What it means**: You're stuck. High app switching, no progress, possibly avoiding the hard problem.

**How it's detected**:
- 2+ struggle signals detected simultaneously
- Common signals: high switching (20+/hour), no recent commits, stale work

**Why this happens**:
- Problem is harder than expected
- Missing information or context
- Procrastinating on a difficult task
- Unclear requirements

**What to do**:
1. **Acknowledge it** - You're not lazy, you're stuck
2. **Ask for help** - Ping a teammate, pair program, or rubber duck
3. **Take a walk** - Sometimes your brain needs distance
4. **Break it down** - Make the next step smaller

---

### 🟥 Pressure

**What it means**: You're reacting instead of creating. High interruptions, context-switching, possibly in firefighting mode.

**How it's detected**:
- 2+ pressure signals detected simultaneously
- Common signals: very high switching (25+/hour), rapid mode changes, reactive behavior

**Why this happens**:
- On-call or incident response
- Too many meetings
- Team is blocked waiting for you
- Last-minute deadline

**What to do**:
1. **Triage** - What actually needs your attention *right now*?
2. **Batch** - Close Slack, batch-reply in 1 hour
3. **Delegate** - Can someone else handle it?
4. **Communicate** - Tell your team you need focus time

---

### ⚪ Normal

**What it means**: Regular productive work. Not in deep focus, not struggling, not in crisis mode. Just working.

**How it's detected**:
- Default mode when no strong signals are present
- Working in a repository or focus app, but without the intensity of deep focus
- Low enough switching to rule out struggling/pressure

**What to do**: This is fine. Most work is Normal mode. It's productive, just not exceptional in any direction.

---

### ⚫ Unknown

**What it means**: Not enough data to determine work mode.

**How it's detected**:
- First few snapshots after app launch
- Working in unfamiliar apps outside the known categories
- No git data and not in a focus app

**What to do**: Nothing. The app will gather more data over time and classify you into one of the other modes.

---

## Sacred Time

**Sacred Time is 9 AM - 12 PM** - the first 3 hours of your workday.

### Why It Matters

Research shows your brain is sharpest in the morning (especially if you take ADHD meds like Vyvanse). This is **peak focus time**. It's sacred because:

- **Willpower is highest** - You haven't spent it yet
- **Interruptions compound** - One Slack ping at 9:30 AM destroys the whole window
- **Deep work requires ramp-up** - Takes 15-30 min to get into flow, can't afford restarts

### What the App Does

During sacred time (9 AM - 12 PM):
- **Menu bar shows 🧘** - Visual reminder that you're in sacred time
- **Countdown shown** - "🧘 Sacred time: Active (2h 15m remaining)"
- **Timeline highlights** - Blue gradient on timeline

### What You Should Do

- **No Slack/email** - Close them. Batch-check at noon.
- **No meetings** - Block your calendar 9-12 AM
- **No "quick questions"** - They're never quick
- **Phone on Do Not Disturb** - Seriously

### What Sacred Time Is NOT

- **Not a moral judgment** - If you don't use it for deep work, that's okay
- **Not enforced** - The app reminds, doesn't block
- **Not mandatory** - Some days you're on-call or in firefighting mode

---

## Reading Your Timeline

### Example 1: Good Deep Work Day

```
6 AM  ──────── (gray, pre-sacred)
9 AM  ════════ 🟦🟦🟦🟦🟦🟦 (blue, deep work during sacred time)
12 PM ─────    🟩🟩 (green, shallow work - code review)
2 PM  ─────    🟥 (red, standup meeting)
              🟩🟩 (green, documentation)
6 PM  ────────
```

**Interpretation**: You used sacred time for deep work (blue), did shallow work (green) in the afternoon, and had one brief pressure spike (red) for your standup. Excellent day.

### Example 2: Struggling Day

```
6 AM  ──────── (gray)
9 AM  ════════ 🟩 (green, started in shallow work)
              🟨🟨🟨🟨🟨 (yellow, spent most of sacred time struggling)
12 PM ─────    🟥 (red, pressure spike)
              🟨🟨 (yellow, still struggling)
2 PM  ─────    🟩 (green, finally made progress on something easier)
6 PM  ────────
```

**Interpretation**: You struggled most of the day (yellow). The app doesn't know *why* - maybe the problem was unclear, maybe you needed help, maybe you were avoiding it. But you know. Use this awareness.

### Example 3: Firefighting Day

```
6 AM  ──────── (gray)
9 AM  ════════ 🟥🟥🟥🟥🟥🟥 (red, pressure entire sacred time)
12 PM ─────    🟥🟥🟥🟥 (red, pressure continues)
2 PM  ─────    🟥🟥 (red, still in firefighting mode)
6 PM  ────────
```

**Interpretation**: You spent the entire day in reactive mode (red). This happens - production incidents, emergencies, on-call. The app just shows you the cost: you got zero deep work time. Now you know.

---

## Troubleshooting

### "The app says I'm in Deep Work but I'm just browsing Reddit"

The app infers from signals, not magic. If you:
- Have Xcode open (focus app)
- Made a commit 30 minutes ago
- Haven't switched apps much

...the app thinks you're in deep work. It doesn't know you're procrastinating. That's on you.

### "App switches show 0 or —"

**Cause**: Screen Recording permission not granted, or data not collected yet.

**Fix**:
1. System Settings → Privacy & Security → Screen Recording
2. Enable "80HD"
3. Restart the app
4. Wait 5 minutes for first snapshot

### "Git context not showing"

**Cause**: Not working in a git repository, or git not in your PATH.

**Fix**:
- Make sure you're working in a directory with a `.git/` folder
- Run `which git` in Terminal - should return `/usr/bin/git` or similar
- If git isn't installed: `xcode-select --install`

### "Sacred time shows at wrong hours"

**Cause**: Sacred time is hardcoded to 9 AM - 12 PM in your local timezone.

**Fix**: Not configurable in v0.0.1. If you work different hours, mentally adjust.

### "The timeline is empty"

**Cause**: Not enough data yet. App only shows data from the current session (since launch).

**Fix**: Wait. The app captures snapshots every 5 minutes. After 30-60 minutes you'll see segments appear.

### "App crashes on launch"

**Cause**: Database corruption or incompatible data.

**Fix**:
```bash
rm ~/Library/Application\ Support/80HD/database.sqlite
```

Then relaunch. You'll lose history, but the app will work.

---

## Understanding Your Patterns (Over Time)

The app doesn't judge. It shows you reality. After using it for a week, you might notice:

- **Sacred time is regularly red/yellow** - You're not protecting your focus window
- **Struggling happens on Mondays** - Maybe requirements aren't clear at sprint start
- **Deep work only happens after 2 PM** - Your morning is consumed by meetings/Slack
- **Pressure spikes correlate with deploy days** - Firefighting mode

The point isn't to feel bad. The point is to see clearly. Then you can:
- **Protect sacred time** - Block your calendar, close Slack
- **Ask for clarity earlier** - Don't spin for hours
- **Negotiate meetings** - "Can we move this to afternoon?"
- **Delegate firefighting** - Rotate on-call, empower teammates

---

## What This App Is NOT

- **Not a time tracker** - It doesn't track hours or bill clients
- **Not a productivity shame machine** - It observes, doesn't judge
- **Not an activity monitor** - It doesn't log keystrokes or screenshots
- **Not surveillance** - Data stays local, you're observing yourself

---

## Philosophy: The Finance Tracker Analogy

Travis's therapist said: "Think of it like a finance tracker. When you track where your money goes, you're not judging yourself - you're just seeing reality. Then you can make intentional choices."

Same here. The app shows where your attention goes. Not to shame you. To give you awareness. So you can choose.

If you spent sacred time in Slack, you didn't fail. You just know the cost now. Next time, you can choose differently.

---

## Getting Help

- **Bug reports**: https://github.com/anthropics/claude-code/issues
- **Questions**: File an issue with the "question" label
- **Feature requests**: Welcome, but v0.0.1 is minimal by design

---

**Remember**: The app is a mirror, not a manager. It shows you where your focus goes. What you do with that information is up to you.
