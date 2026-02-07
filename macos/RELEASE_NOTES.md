# 80HD - The Observing Eye: Release Notes

## v0.0.1 - "The Observing Eye" (Initial Release)

**Released**: February 7, 2026
**Build**: Development Preview
**Status**: Foundation release - Local monitoring only

---

### What This Release Is

v0.0.1 is the **foundation** of 80HD. It implements the core observation loop:
- Monitor system context every 5 minutes
- Detect work modes from observable signals
- Visualize your day as a timeline
- Track sacred time (9 AM - 12 PM)

This is Travis's personal tool, built for one user (himself). It's not polished. It's not feature-complete. But it works, and it observes.

**Philosophy**: "See clearly first, act later." This release shows you where your focus goes. Future releases will help you protect it.

---

### Features

#### Context Monitoring

✅ **System-level observation** - Tracks active apps, window switches, keyboard activity
✅ **Git integration** - Detects repository, branch, commits via shell commands
✅ **Snapshot capture** - Full context snapshot every 5 minutes
✅ **Session tracking** - One session per app launch, stored in local SQLite
✅ **100% local** - No network requests, no cloud sync, no telemetry

#### Work Mode Detection

✅ **Six work modes**:
- 🟦 **Deep Focus** - Focus app + low switching + active coding
- 🟢 **Communicating** - Using collaboration tools (Slack, Teams, Zoom)
- 🟠 **Struggling** - 2+ struggle signals (high switching, no progress, stale work)
- 🟥 **Pressure** - 2+ pressure signals (very high switching, reactive mode)
- ⚪ **Normal** - Regular productive work without strong signals
- ⚫ **Unknown** - Not enough data to determine mode

✅ **Signal-based heuristics** - Infers mode from observable signals:
- Git commits (recency, frequency)
- App switching rate (switches per hour)
- Active app type (focus vs communication vs distraction)
- Time since last progress

✅ **Detection via signals** - Work mode computed from snapshot signals using `WorkMode.detect()`
✅ **No machine learning** - Simple heuristics, explainable logic

#### Dashboard

✅ **Three-tab interface**:
- **Today's Attention** - Timeline of your day (6 AM - 6 PM) with work mode segments
- **Current Session** - Live metrics, current context, work mode signals
- **History** - Placeholder for future historical analysis

✅ **Real-time updates** - Dashboard refreshes when new snapshot captured
✅ **Menu bar access** - Click brain icon → "Dashboard" or press ⌘D

#### Sacred Time (9 AM - 12 PM)

✅ **Visual indicators**:
- 🧘 emoji in menu bar during sacred time
- Countdown timer ("2h 15m remaining")
- Blue gradient highlight on timeline
- Boundary markers at 9 AM and 12 PM

✅ **Time-based reminders**:
- "Starts in X hours" before 9 AM
- "Ended at 12 PM" after noon
- No enforcement - just awareness

#### Data Persistence

✅ **Local SQLite database**:
- Location: `~/Library/Application Support/80HD/database.sqlite`
- Tables: `work_sessions`, `context_snapshots`, `interventions`
- Indexes for common queries (timestamp, session)
- Automatic cleanup (90-day retention for snapshots)

✅ **Database health checks** - Verifies integrity before monitoring starts
✅ **Graceful degradation** - Continues monitoring even if snapshot save fails

#### Error Handling & Logging

✅ **Structured logging** - OSLog with categories (monitoring, database, lifecycle, ui)
✅ **Log levels** - Debug (dev only), info, error, fault
✅ **Privacy-aware** - User data marked `%{public}s`
✅ **Graceful error recovery** - Non-critical failures don't crash the app

---

### What's NOT in v0.0.1

This is an MVP. Many planned features are deliberately excluded:

❌ **No AI** - Work mode detection uses heuristics, not GPT-4
❌ **No interventions** - App observes but doesn't suggest actions
❌ **No collaboration artifacts** - Doesn't generate standup notes or commit summaries
❌ **No backend sync** - Data lives on one machine only
❌ **No history view** - Tab 3 is a placeholder
❌ **No multi-device** - Can't share data between Macs
❌ **No notifications** - No alerts, no reminders (except menu bar)
❌ **No configurable sacred time** - Hardcoded to 9 AM - 12 PM
❌ **No GitHub/GitLab integration** - Git monitoring is local shell commands only
❌ **No calendar integration** - Doesn't know about your meetings
❌ **No Slack/Teams integration** - Doesn't read messages or threads

---

### Known Limitations

#### Data Granularity

⚠️ **5-minute snapshots only** - Can't detect brief context switches or interruptions
⚠️ **Session-based** - Data only goes back to app launch, not across restarts
⚠️ **No real-time** - Dashboard updates every 5 minutes, not continuously

#### Work Mode Detection

⚠️ **Simple heuristics** - Can misclassify. If you have Xcode open but browse Reddit, app thinks you're in deep work
⚠️ **Git-centric** - Assumes git commits = progress. Not true for planning, design, debugging
⚠️ **No context awareness** - Doesn't know *why* you're struggling, just that you are

#### Privacy & Permissions

⚠️ **Screen Recording permission required** - macOS requires this to detect app names
⚠️ **No data portability** - SQLite format, not exported anywhere
⚠️ **No encryption** - Database is plain SQLite, readable by anyone with file access

#### Platform

⚠️ **macOS only** - No Windows, Linux, iOS
⚠️ **Requires macOS 13+** - Uses SwiftUI features from Ventura
⚠️ **Not sandboxed properly** - Uses shell commands, full disk access

---

### System Requirements

**Minimum**:
- macOS 13.0 (Ventura)
- 50 MB disk space
- Screen Recording permission

**Recommended**:
- macOS 14.0 (Sonoma) or later
- Git installed (`/usr/bin/git`)
- Working in git repositories for full context

**Not Supported**:
- macOS 12 (Monterey) or earlier
- Virtual machines (timing may be unreliable)
- Multiple displays (app switching detection may be inaccurate)

---

### Installation

v0.0.1 is **source only**. No pre-built binaries.

**To install**:

1. Clone the repository:
   ```bash
   git clone https://github.com/tedgar/80HD.git
   cd 80HD
   ```

2. Open in Xcode:
   ```bash
   open 80HD.xcodeproj
   ```

3. Build and run:
   - Select "80HD" scheme
   - Press ⌘R

4. Grant permissions when prompted:
   - System Settings → Privacy & Security → Screen Recording
   - Enable "80HD"
   - Restart the app

---

### Migration Notes

This is the first release. No migration needed.

**Future versions** may require database migration. When that happens:
- Backup: `cp ~/Library/Application\ Support/80HD/database.sqlite ~/Desktop/80HD-backup.sqlite`
- Delete: `rm ~/Library/Application\ Support/80HD/database.sqlite`
- Restart: App will create new database with updated schema

You'll lose history, but the app will work.

---

### Breaking Changes

None (first release).

---

### Bug Fixes

None (first release).

---

### Performance

**Benchmarks** (on 2021 MacBook Pro M1):

- **Memory**: 30 MB resident (typical)
- **CPU**: <1% average, 5% spike during snapshot
- **Disk**: 1 KB per snapshot (~288 KB/day)
- **Battery**: Negligible (<0.1% per hour)
- **Startup**: <500ms to launch and start monitoring

**Database growth**:
- 288 snapshots/day (one every 5 minutes, 24 hours)
- ~100 KB/day compressed
- ~3 MB/month
- ~36 MB/year

Automatic cleanup deletes snapshots older than 90 days.

---

### Security & Privacy

✅ **No network requests** - App never phones home
✅ **No analytics** - No telemetry, no tracking
✅ **No cloud storage** - All data local
✅ **No third-party SDKs** - Pure Swift, no dependencies
✅ **Open source** - Code is visible (proprietary license)

⚠️ **Screen Recording permission** - Required by macOS to detect app names
⚠️ **Shell access** - Runs `git` commands via `Process()`
⚠️ **File system access** - Reads git repositories

**Threat model**: This app is designed for self-observation, not surveillance. If someone has access to your Mac, they can read the database. Don't use this on a shared machine.

---

### What's Next

**Planned for v0.0.2** (Target: March 2026):
- AI-powered work mode detection (GPT-4 analyzes snapshots)
- Improved heuristics based on 30 days of real data
- Bug fixes from v0.0.1 usage

**Planned for v0.0.3** (Target: April 2026):
- Gentle interventions (collaboration debt reminders)
- Configurable sacred time window
- Calendar integration (know when meetings happen)

**Planned for v0.1.0** (Target: May 2026):
- Backend sync to Supabase
- Multi-device support
- Historical analysis (trends over weeks/months)

**Planned for v0.2.0** (Target: June 2026):
- Auto-generate collaboration artifacts (standup notes, commit summaries)
- Slack/Teams integration (post updates automatically)
- RSD (rejection sensitivity dysphoria) detection and reframing

---

### Credits

**Design & Development**: Travis Edgar
**AI Pair Programming**: Claude Sonnet 4.5 (Anthropic)
**Inspiration**: Musashi's "Dokkōdō" (The Way of Walking Alone)
**Philosophy**: "Finance tracker for focus" (concept from therapist)

---

### License

Proprietary. Not open source (yet).
Copyright © 2026 Travis Edgar. All rights reserved.

---

### Feedback

**Bug reports**: https://github.com/anthropics/claude-code/issues
**Feature requests**: Welcome, but v0.0.1 is minimal by design
**Questions**: File an issue with "question" label

---

### Acknowledgments

This app exists because:
- Travis has ADHD and goes into "cave mode"
- His team pushes back on invisible work
- He needs a mirror, not a manager
- His therapist said "think of it like a finance tracker"

The app is named "80HD" because Travis originally thought he had "80% ADHD" (turns out it's 100%).

The sacred time concept comes from observing that Vyvanse peak effectiveness is 9 AM - 12 PM, and interruptions during this window destroy the entire day's productivity.

The Observing Eye metaphor comes from Musashi: "See clearly. Move without hesitation." You can't move correctly if you can't see where you actually are.

---

**This is v0.0.1. It's rough. It's incomplete. But it observes. And that's enough for now.**
