# 80HD - The Observing Eye (macOS App)

**Version 0.0.1** - Initial Release

## What This Is

The Observing Eye is a macOS menu bar app that monitors your work context and visualizes where your focus goes throughout the day. Think of it as a "finance tracker for focus" - it shows you where your attention, energy, and time are actually going, without judgment.

This is v0.0.1: the foundation. Local monitoring, basic work mode detection, and timeline visualization. No AI, no cloud sync, no interventions yet. Just observation.

## Key Features

- **System Context Monitoring** - Tracks active apps, window switches, git activity every 5 minutes
- **Work Mode Detection** - Identifies deep focus, struggling, pressure, communicating, normal, and unknown states
- **Timeline Visualization** - See your day as a color-coded timeline with work mode segments
- **Sacred Time Protection** - 9 AM - 12 PM is marked as protected focus time
- **100% Local** - All data stored in local SQLite database, never leaves your machine

## System Requirements

- macOS 13.0 (Ventura) or later
- Xcode 15.0+ (for building from source)
- Git (optional, for repository monitoring)

## Building and Running

### Quick Start

1. Open `../80HD.xcodeproj` in Xcode (project is in parent directory)
2. Select the "80HD" scheme
3. Press Cmd+R to build and run

### First Launch

On first launch, the app will:
1. Create a menu bar icon (brain symbol)
2. Request Screen Recording permission (needed to detect active apps)
3. Start monitoring your work context every 5 minutes
4. Create a local database at `~/Library/Application Support/80HD/database.sqlite`

### Opening the Dashboard

Click the menu bar icon and select "Dashboard" (or press Cmd+D).

## Architecture Overview

```
80HDApp.swift
  └─> AppDelegate (menu bar setup, app lifecycle)
        └─> MonitoringCoordinator (orchestrates monitoring)
              ├─> GitMonitor (detects git context)
              ├─> SystemMonitor (detects active apps)
              └─> DatabaseManager (persists snapshots)
                    └─> SQLite database

ObservingEyeDashboard (SwiftUI views)
  ├─> Tab 1: Today's Attention
  ├─> Tab 2: Current Session
  └─> Tab 3: History (not implemented yet)

AppState (observable singleton)
  └─> Publishes current context to all views
```

### Key Components

#### Monitors (`macos/Monitors/`)
- **MonitoringCoordinator** - Orchestrates all monitoring, captures snapshots every 5 minutes
- **GitMonitor** - Detects git repository, branch, commits via shell commands
- **SystemMonitor** - Detects active app, window switches via NSWorkspace

#### Models (`macos/Models/`)
- **ContextSnapshot** - Immutable snapshot of system state at a moment in time
- **WorkMode** - Enum representing detected work mode (deepWork, shallowWork, struggling, pressure)
- **AppState** - Observable singleton that publishes current context to views
- **WorkSession** - Represents a work session from app launch to quit

#### Database (`macos/Database/`)
- **DatabaseManager** - SQLite wrapper for persistent storage
- Tables: `work_sessions`, `context_snapshots`, `interventions`
- Location: `~/Library/Application Support/80HD/database.sqlite`

#### Views (`macos/Views/`)
- **ObservingEyeDashboard** - Main dashboard with 3 tabs
- **MenuBarView** - Menu bar dropdown (not used yet, AppDelegate builds menu)
- **ChatWindowView** - Placeholder for future chat feature

## Data Flow

1. **Every 5 minutes**: Timer fires in MonitoringCoordinator
2. **Context capture**: GitMonitor and SystemMonitor gather current state
3. **Snapshot creation**: Context packaged into ContextSnapshot
4. **Work mode detection**: ContextSnapshot analyzes signals → determines WorkMode
5. **Database save**: Snapshot persisted to SQLite
6. **State broadcast**: AppState.shared publishes to all views
7. **UI update**: Dashboard timeline and stats refresh

## Work Mode Detection

The app infers work mode from observable signals:

- **Deep Focus** (blue): Focus app + low app switching + active coding (commits or uncommitted changes)
- **Communicating** (green): Using communication tools (Slack, Teams, Outlook, chat apps)
- **Struggling** (orange): 2+ struggle signals (high switching, no progress, stale work)
- **Pressure** (red): 2+ pressure signals (very high switching, reactive mode)
- **Normal** (gray): Regular productive work without any strong signals
- **Unknown** (gray): Not enough data to determine mode

Detection logic lives in `WorkMode.detect()` static method.

## Sacred Time (9 AM - 12 PM)

The first 3 hours of the workday (9 AM - 12 PM) are marked as "sacred time" - your protected focus window. The app:
- Shows a 🧘 indicator in the menu bar during sacred time
- Highlights this period in the timeline with a blue gradient
- Counts down time remaining during the window

This is a reminder, not enforcement. The app doesn't block anything in v0.0.1.

## Database Schema

### work_sessions
```sql
CREATE TABLE work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    primary_focus TEXT,
    git_commits INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    collaboration_events INTEGER DEFAULT 0,
    dominant_work_mode TEXT,
    notes TEXT
);
```

### context_snapshots
```sql
CREATE TABLE context_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp TEXT NOT NULL,
    work_mode TEXT,
    git_repo TEXT,
    git_branch TEXT,
    git_commits_today INTEGER,
    active_app TEXT,
    app_bundle_id TEXT,
    app_switches_hour INTEGER,
    struggle_signals TEXT,
    pressure_signals TEXT,
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);
```

### interventions
```sql
CREATE TABLE interventions (
    id TEXT PRIMARY KEY,
    session_id INTEGER,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    responded_at TEXT,
    response TEXT,
    draft_content TEXT,
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);
```

## Privacy & Security

- **100% local** - All data stored in local SQLite database
- **No network requests** - App never sends data anywhere
- **No analytics** - App doesn't track you
- **Screen Recording permission** - Required to detect active app names (macOS sandboxing requirement)
- **User data** - App names and git repo names stored locally

## Development

### Adding New Work Mode Detection Logic

Edit `macos/Models/ContextSnapshot.swift`:

```swift
var workMode: WorkMode {
    // Add your detection logic here
    // Access: self.system, self.git, self.struggleSignals, self.pressureSignals
}
```

### Adding New Dashboard Views

1. Create SwiftUI view in `macos/Views/`
2. Add tab to `ObservingEyeDashboard.swift`
3. Subscribe to `@StateObject var appState = AppState.shared` for live updates

### Adding New Monitors

1. Create monitor class in `macos/Monitors/`
2. Implement `getCurrentState()` method
3. Add to `MonitoringCoordinator.captureSnapshot()`

## Troubleshooting

### "Failed to Start Monitoring" on Launch

**Cause**: Database health check failed or session creation failed

**Fix**: Delete database file and restart:
```bash
rm ~/Library/Application\ Support/80HD/database.sqlite
```

### App Switches Always Show 0

**Cause**: Screen Recording permission not granted

**Fix**:
1. System Settings → Privacy & Security → Screen Recording
2. Enable checkbox for "80HD"
3. Restart the app

### Git Context Not Showing

**Cause**: Not working in a git repository, or git not in PATH

**Fix**:
- Work in a directory with `.git/` folder
- Verify: `which git` returns a path

### Menu Bar Icon Not Showing

**Cause**: Menu bar too crowded (macOS hides overflow icons)

**Fix**: Cmd+drag other icons to rearrange, or use Bartender/Hidden Bar

## Known Limitations (v0.0.1)

- **Local only** - No cloud sync, data lives on one machine
- **Basic work mode detection** - Simple heuristics, not AI-powered
- **No interventions** - App observes but doesn't suggest actions
- **No history view** - Tab 3 is a placeholder
- **Manual git only** - Doesn't integrate with GitHub/GitLab APIs
- **macOS only** - No Windows or Linux support

## What's Next (Future Versions)

- **v0.0.2**: AI-powered work mode detection with GPT-4
- **v0.0.3**: Gentle interventions (collaboration debt reminders)
- **v0.1.0**: Backend sync to Supabase for multi-device
- **v0.2.0**: Auto-generate collaboration artifacts (standup notes, commit summaries)

## License

Proprietary - Travis Edgar

## Support

File issues at: https://github.com/anthropics/claude-code/issues (for now)
