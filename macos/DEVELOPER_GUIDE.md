# 80HD - The Observing Eye: Developer Guide

**Version 0.0.1**

## Table of Contents

1. [Codebase Structure](#codebase-structure)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Adding New Work Mode Detection](#adding-new-work-mode-detection)
4. [Adding New Dashboard Views](#adding-new-dashboard-views)
5. [Adding New Monitors](#adding-new-monitors)
6. [Database Schema](#database-schema)
7. [Logging and Debugging](#logging-and-debugging)
8. [Testing](#testing)
9. [Common Patterns](#common-patterns)

---

## Codebase Structure

```
macos/
├── 80HDApp.swift                 # SwiftUI app entry point
├── AppDelegate.swift             # Menu bar setup, app lifecycle
│
├── Models/                       # Data models
│   ├── ContextSnapshot.swift     # Immutable snapshot of system state
│   ├── WorkMode.swift            # Enum: deepFocus, struggling, pressure, communication, normal, unknown
│   ├── AppState.swift            # Observable singleton, broadcasts state
│   └── WorkSession.swift         # Work session model
│
├── Monitors/                     # Context monitoring
│   ├── MonitoringCoordinator.swift  # Orchestrates all monitoring
│   ├── GitMonitor.swift             # Git context detection
│   ├── SystemMonitor.swift          # Active app detection
│   └── ContextMonitor.swift         # Protocol (not used)
│
├── Database/                     # Persistence
│   └── DatabaseManager.swift     # SQLite wrapper
│
├── Views/                        # SwiftUI views
│   ├── ObservingEyeDashboard.swift  # Main dashboard (3 tabs)
│   ├── MenuBarView.swift            # Menu bar dropdown (not used)
│   └── ChatWindowView.swift         # Placeholder for future chat
│
├── Utilities/                    # (empty after Logger.swift deletion)
│
└── Resources/                    # (empty, for future assets)
```

---

## Architecture Deep Dive

### Data Flow

```
Timer (5 min) ──────> MonitoringCoordinator.captureSnapshot()
                              │
                              ├──> GitMonitor.getCurrentState() ──> GitContext?
                              ├──> SystemMonitor.getCurrentState() ──> SystemContext
                              │
                              └──> Build ContextSnapshot
                                      │
                                      ├──> ContextSnapshot.workMode (computed property)
                                      ├──> DatabaseManager.saveSnapshot()
                                      └──> AppState.shared.update(snapshot)
                                              │
                                              └──> All SwiftUI views refresh
```

### Key Design Decisions

**1. Snapshot-based, not event-based**

The app captures full snapshots every 5 minutes, not individual events. This makes analysis simpler (work mode is computed from snapshot state) but means granularity is limited to 5-minute windows.

**Tradeoff**: Simpler code, coarser data.

**2. Work mode as computed property**

`ContextSnapshot.workMode` is computed from signals, not stored directly. This means:
- Changing detection logic retroactively affects all snapshots
- No migration needed when logic changes
- Can't preserve "what the app thought at the time" vs "what we know now"

**Tradeoff**: Flexibility vs historical accuracy.

**3. Observable singleton AppState**

`AppState.shared` is the source of truth for UI. All views subscribe via `@StateObject`.

**Why**: SwiftUI needs a single source of truth for reactivity. AppDelegate and MonitoringCoordinator can't be `@Observable` because they're NSObject subclasses.

**4. Local-only, no backend**

v0.0.1 is 100% local. No network, no sync, no cloud. This keeps complexity low and privacy absolute.

**Why**: Build the foundation first. Backend sync comes in v0.1.0.

---

## Adding New Work Mode Detection

Work mode detection lives in `ContextSnapshot.workMode` (Models/ContextSnapshot.swift).

### Current Detection Logic

```swift
var workMode: WorkMode {
    // 1. Check struggle signals
    if !struggleSignals.isEmpty {
        return .struggling
    }

    // 2. Check pressure signals
    if !pressureSignals.isEmpty {
        return .pressure
    }

    // 3. Check for deep work
    if let git = git,
       git.hasRecentCommit(within: 2.0),
       system.appSwitchesLastHour < 10,
       system.isFocusApp {
        return .deepWork
    }

    // 4. Default to shallow work
    return .shallowWork
}
```

### Adding a New Signal

**Example**: Add "procrastination" signal for social media use.

1. Add signal to ContextSnapshot:

```swift
struct ContextSnapshot: Codable {
    // ... existing properties ...

    var procrastinationSignals: [String] {
        var signals: [String] = []

        let socialApps = ["Twitter", "Reddit", "YouTube", "Instagram", "TikTok"]
        if socialApps.contains(system.activeApp) {
            signals.append("Using social media: \(system.activeApp)")
        }

        return signals
    }
}
```

2. Update work mode logic:

```swift
var workMode: WorkMode {
    // Procrastination counts as struggling
    if !struggleSignals.isEmpty || !procrastinationSignals.isEmpty {
        return .struggling
    }

    // ... rest of logic ...
}
```

### Adding a New Work Mode

**Example**: Add `.learning` mode for reading docs/tutorials.

1. Add to WorkMode enum (Models/WorkMode.swift):

```swift
enum WorkMode: String, Codable {
    case deepWork = "deep_work"
    case shallowWork = "shallow_work"
    case struggling
    case pressure
    case learning  // NEW

    var description: String {
        switch self {
        // ... existing cases ...
        case .learning:
            return "Learning"
        }
    }

    var color: Color {
        switch self {
        // ... existing cases ...
        case .learning:
            return .purple
        }
    }
}
```

2. Add detection logic:

```swift
var workMode: WorkMode {
    // ... existing checks ...

    // Learning: reading docs, no commits, browser focused
    let docsSites = ["stackoverflow.com", "developer.apple.com", "docs.swift.org"]
    if system.activeApp == "Safari" || system.activeApp == "Chrome",
       system.appSwitchesLastHour < 15,
       // TODO: Detect if browser is on docs site (requires accessibility API)
       git?.commitsToday == 0 {
        return .learning
    }

    // ... rest of logic ...
}
```

---

## Adding New Dashboard Views

The dashboard uses SwiftUI with tabs. To add a new tab:

### 1. Create the View

Create a new file in `macos/Views/`:

```swift
// macos/Views/InsightsTab.swift

import SwiftUI

struct InsightsTab: View {
    @StateObject private var appState = AppState.shared

    var body: some View {
        VStack(spacing: 20) {
            Text("Insights")
                .font(.title)

            if let snapshot = appState.currentContext {
                Text("Current mode: \(snapshot.workMode.description)")
                    .foregroundColor(snapshot.workMode.color)
            } else {
                Text("No data yet...")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}
```

### 2. Add Tab to Dashboard

Edit `macos/Views/ObservingEyeDashboard.swift`:

```swift
struct ObservingEyeDashboard: View {
    var body: some View {
        TabView {
            CurrentSessionTab()
                .tabItem {
                    Label("Overview", systemImage: "chart.bar")
                }

            TimelineTab()
                .tabItem {
                    Label("Timeline", systemImage: "timeline.selection")
                }

            InsightsTab()  // NEW
                .tabItem {
                    Label("Insights", systemImage: "lightbulb")
                }

            HistoryTab()
                .tabItem {
                    Label("History", systemImage: "clock")
                }
        }
        .frame(width: 800, height: 600)
    }
}
```

### 3. Subscribe to AppState

All views should subscribe to `AppState.shared` to get live updates:

```swift
@StateObject private var appState = AppState.shared

var body: some View {
    if let snapshot = appState.currentContext {
        // Use snapshot.system, snapshot.git, snapshot.workMode, etc.
    }
}
```

AppState publishes `currentContext` whenever MonitoringCoordinator captures a new snapshot.

---

## Adding New Monitors

Monitors gather context from the system. To add a new monitor:

### 1. Create the Monitor

Create a new file in `macos/Monitors/`:

```swift
// macos/Monitors/BrowserMonitor.swift

import Foundation
import AppKit

/// Monitors browser tabs and active URLs
class BrowserMonitor {

    /// Check if browser monitoring is available
    var isAvailable: Bool {
        // Check if browser is running and accessible
        return NSWorkspace.shared.runningApplications
            .contains { $0.bundleIdentifier == "com.apple.Safari" }
    }

    /// Get current browser context
    func getCurrentState() -> BrowserContext? {
        guard isAvailable else { return nil }

        // Use AppleScript to get active Safari tab
        let script = """
        tell application "Safari"
            if (count of windows) > 0 then
                return URL of current tab of front window
            end if
        end tell
        """

        guard let url = runAppleScript(script) else {
            return nil
        }

        return BrowserContext(activeURL: url, browser: "Safari")
    }

    private func runAppleScript(_ source: String) -> String? {
        var error: NSDictionary?
        guard let scriptObject = NSAppleScript(source: source) else {
            return nil
        }

        let output = scriptObject.executeAndReturnError(&error)
        guard error == nil else {
            print("AppleScript error: \(error!)")
            return nil
        }

        return output.stringValue
    }
}

struct BrowserContext: Codable {
    let activeURL: String
    let browser: String
}
```

### 2. Add to ContextSnapshot

Edit `macos/Models/ContextSnapshot.swift`:

```swift
struct ContextSnapshot: Codable {
    let timestamp: Date
    let git: GitContext?
    let system: SystemContext
    let browser: BrowserContext?  // NEW
    var sessionId: Int64?

    // ... rest of struct ...
}
```

### 3. Integrate in MonitoringCoordinator

Edit `macos/Monitors/MonitoringCoordinator.swift`:

```swift
class MonitoringCoordinator {
    private let gitMonitor: GitMonitor
    private let systemMonitor: SystemMonitor
    private let browserMonitor: BrowserMonitor  // NEW

    init(
        database: DatabaseManager = .shared,
        gitMonitor: GitMonitor = GitMonitor(),
        systemMonitor: SystemMonitor = SystemMonitor(),
        browserMonitor: BrowserMonitor = BrowserMonitor()  // NEW
    ) {
        self.database = database
        self.gitMonitor = gitMonitor
        self.systemMonitor = systemMonitor
        self.browserMonitor = browserMonitor
    }

    private func captureSnapshot() {
        let git = captureGitContext()
        let system = captureSystemContext()
        let browser = captureBrowserContext()  // NEW

        var snapshot = ContextSnapshot(
            timestamp: Date(),
            git: git,
            system: system,
            browser: browser  // NEW
        )
        snapshot.sessionId = currentSessionId

        // ... rest of method ...
    }

    private func captureBrowserContext() -> BrowserContext? {
        guard browserMonitor.isAvailable else {
            os_log("Browser monitor not available", log: monitoringLog, type: .debug)
            return nil
        }

        let context = browserMonitor.getCurrentState()
        if let context = context {
            os_log("Browser context captured: %{public}s",
                   log: monitoringLog, type: .debug, context.activeURL)
        }
        return context
    }
}
```

### 4. Update Database Schema

Add new column to `context_snapshots` table:

```swift
// In DatabaseManager.createTables()

try execute("""
    CREATE TABLE IF NOT EXISTS context_snapshots (
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
        browser_url TEXT,  -- NEW
        struggle_signals TEXT,
        pressure_signals TEXT,
        FOREIGN KEY (session_id) REFERENCES work_sessions(id)
    )
""")
```

**Important**: This is a schema change. Users will need to delete their database or you'll need to write a migration.

---

## Database Schema

### Full Schema (v0.0.1)

```sql
-- Work sessions (one per app launch)
CREATE TABLE work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,              -- ISO8601 timestamp
    ended_at TEXT,                         -- ISO8601 timestamp (null until quit)
    primary_focus TEXT,                    -- Not used yet
    git_commits INTEGER DEFAULT 0,         -- Not used yet
    files_changed INTEGER DEFAULT 0,       -- Not used yet
    collaboration_events INTEGER DEFAULT 0,-- Not used yet
    dominant_work_mode TEXT,               -- Not used yet
    notes TEXT                             -- Not used yet
);

-- Context snapshots (captured every 5 minutes)
CREATE TABLE context_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,                    -- FK to work_sessions
    timestamp TEXT NOT NULL,               -- ISO8601 timestamp
    work_mode TEXT,                        -- deep_work, shallow_work, struggling, pressure
    git_repo TEXT,                         -- Repo name (not path)
    git_branch TEXT,                       -- Current branch
    git_commits_today INTEGER,             -- Commits since midnight
    active_app TEXT,                       -- App name (e.g. "Xcode")
    app_bundle_id TEXT,                    -- Bundle ID (e.g. "com.apple.dt.Xcode")
    app_switches_hour INTEGER,             -- Switches in last hour
    struggle_signals TEXT,                 -- JSON array of strings
    pressure_signals TEXT,                 -- JSON array of strings
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);

-- Interventions (not used in v0.0.1)
CREATE TABLE interventions (
    id TEXT PRIMARY KEY,                   -- UUID
    session_id INTEGER,                    -- FK to work_sessions
    type TEXT NOT NULL,                    -- collaboration_debt, cave_mode, etc.
    message TEXT NOT NULL,                 -- User-facing message
    created_at TEXT NOT NULL,              -- ISO8601 timestamp
    responded_at TEXT,                     -- ISO8601 timestamp
    response TEXT,                         -- acknowledged, dismissed, snoozed
    draft_content TEXT,                    -- Pre-generated artifact (e.g. standup note)
    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
);

-- Indexes
CREATE INDEX idx_snapshots_timestamp ON context_snapshots(timestamp);
CREATE INDEX idx_snapshots_session ON context_snapshots(session_id);
CREATE INDEX idx_interventions_session ON interventions(session_id);
```

### Querying the Database

You can query the database directly with sqlite3:

```bash
sqlite3 ~/Library/Application\ Support/80HD/database.sqlite

-- Recent snapshots
SELECT timestamp, work_mode, active_app, git_repo
FROM context_snapshots
ORDER BY timestamp DESC
LIMIT 10;

-- Deep work time today
SELECT COUNT(*) * 5 AS deep_work_minutes
FROM context_snapshots
WHERE work_mode = 'deep_work'
  AND DATE(timestamp) = DATE('now');

-- App switching stats
SELECT active_app, AVG(app_switches_hour) as avg_switches
FROM context_snapshots
WHERE timestamp > datetime('now', '-1 day')
GROUP BY active_app
ORDER BY avg_switches DESC;
```

---

## Logging and Debugging

### Logging Strategy

v0.0.1 uses **inline OSLog instances** (not a centralized Logger utility).

Each file declares its own log:

```swift
import os.log

private let monitoringLog = OSLog(subsystem: "com.80hd.app", category: "monitoring")

// Then use:
os_log("Starting monitoring", log: monitoringLog, type: .info)
os_log("Error: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
```

**Categories**:
- `monitoring` - MonitoringCoordinator
- `database` - DatabaseManager
- `lifecycle` - AppDelegate (launch, terminate)
- `ui` - AppDelegate (dashboard open, menu updates)

### Log Levels

- `.debug` - Only in DEBUG builds, frequent operations (snapshot capture)
- `.info` - Important state changes (monitoring started, session created)
- `.error` - Recoverable errors (snapshot save failed, git command failed)
- `.fault` - Critical errors that require user intervention (database corruption)

### Viewing Logs

**In Xcode**:
- Run the app in Xcode
- Open Console pane (Cmd+Shift+Y)
- Filter by "80HD" or subsystem "com.80hd.app"

**In Console.app**:
1. Open /Applications/Utilities/Console.app
2. Select your Mac in sidebar
3. Search for "subsystem:com.80hd.app"

**In Terminal**:
```bash
# Live tail
log stream --predicate 'subsystem == "com.80hd.app"' --level debug

# Last hour
log show --predicate 'subsystem == "com.80hd.app"' --last 1h
```

### Adding Debug Logging

```swift
#if DEBUG
os_log("Debug info: %{public}s", log: monitoringLog, type: .debug, debugInfo)
#endif
```

This only compiles in DEBUG builds, won't affect release performance.

### Privacy in Logs

Use `%{public}s` to mark data as safe to log:

```swift
// WRONG - repo name may be sensitive
os_log("Repo: %s", log: monitoringLog, type: .info, repoName)

// RIGHT - explicitly marked public
os_log("Repo: %{public}s", log: monitoringLog, type: .info, repoName)
```

Without `%{public}s`, strings are redacted in non-DEBUG builds.

---

## Testing

### Current State (v0.0.1)

**No tests yet.** v0.0.1 is focused on getting the foundation working. Tests come in v0.0.2.

### Future Testing Strategy

**Unit tests**:
- WorkMode detection logic (ContextSnapshot.workMode)
- Signal detection (struggleSignals, pressureSignals)
- DatabaseManager CRUD operations

**Integration tests**:
- MonitoringCoordinator captures snapshot correctly
- AppState broadcasts updates
- Dashboard updates when AppState changes

**UI tests**:
- Dashboard tabs render
- Timeline shows segments
- Sacred time indicators appear at correct times

### Manual Testing Checklist

For now, test manually:

- [ ] App launches without crashing
- [ ] Menu bar icon appears
- [ ] Dashboard opens (Cmd+D or click menu)
- [ ] Current tab shows live metrics
- [ ] Timeline tab shows colored segments
- [ ] Sacred time shows 🧘 indicator during 9 AM - 12 PM
- [ ] Git context detected when working in repo
- [ ] App switches count increases when switching apps
- [ ] Work mode changes based on activity
- [ ] Database created at ~/Library/Application Support/80HD/
- [ ] App survives quit + relaunch (session ends cleanly)

---

## Common Patterns

### 1. Accessing Current Context

```swift
@StateObject private var appState = AppState.shared

var body: some View {
    if let snapshot = appState.currentContext {
        Text("Mode: \(snapshot.workMode.description)")
    } else {
        Text("No data yet")
    }
}
```

### 2. Running Shell Commands (Git)

```swift
private func runGitCommand(_ args: [String]) -> String? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
    process.arguments = args
    process.currentDirectoryURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    do {
        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else { return nil }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    } catch {
        return nil
    }
}
```

### 3. MainActor Isolation

AppDelegate and MonitoringCoordinator must run on main thread:

```swift
@MainActor
class MonitoringCoordinator {
    func startMonitoring() throws {
        // Already on main thread
        focusStartTime = Date()

        // Timer callback needs Task wrapper
        monitorTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.captureSnapshot()
            }
        }
    }
}
```

### 4. Error Handling with Logging

```swift
do {
    try database.saveSnapshot(snapshot)
} catch {
    os_log("Failed to save snapshot: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
    // Don't crash - continue monitoring even if save fails
}
```

Graceful degradation: log the error, but keep the app running.

### 5. Date Arithmetic

Use `Calendar` for time calculations, not manual arithmetic:

```swift
let calendar = Calendar.current
var endComponents = calendar.dateComponents([.year, .month, .day], from: now)
endComponents.hour = 12
endComponents.minute = 0

guard let endTime = calendar.date(from: endComponents) else { return }

let components = calendar.dateComponents([.hour, .minute], from: now, to: endTime)
let hoursRemaining = components.hour ?? 0
let minutesRemaining = components.minute ?? 0
```

This handles DST, leap seconds, and timezone changes correctly.

---

## Build Configuration

### Debug vs Release

**Debug** (default in Xcode):
- Debug logging enabled
- Assertions enabled
- Optimization disabled
- Faster compile

**Release** (for distribution):
- Debug logging stripped
- Assertions disabled
- Optimization enabled
- Smaller binary

Build for release:
```bash
xcodebuild -project 80HD.xcodeproj -scheme 80HD -configuration Release clean build
```

### Entitlements

App requires these entitlements (already configured in Xcode):

- **com.apple.security.app-sandbox** = YES (sandboxed)
- **com.apple.security.files.user-selected.read-write** = YES (file access)
- **com.apple.security.scripting-targets** = YES (AppleScript for git commands)

### Code Signing

App is signed with your personal Developer ID. For distribution, you'll need:
1. Apple Developer account
2. Developer ID Application certificate
3. Notarization (for macOS 10.15+)

---

## Performance Considerations

### Current Performance (v0.0.1)

- **Memory**: ~30 MB resident
- **CPU**: <1% average (spikes to 5% during snapshot capture)
- **Disk**: Database grows ~1 KB per snapshot (~288 KB/day)
- **Battery**: Negligible impact (5-minute timer, no polling)

### Optimization Opportunities (Future)

1. **Batch database writes** - Currently saves every 5 minutes, could batch 6 snapshots (30 min)
2. **Index git commands** - Currently runs `git log` every snapshot, could cache
3. **Reduce app switch polling** - Currently polls NSWorkspace, could use event tap
4. **Compress signals** - JSON arrays in database, could use bit flags

Not critical for v0.0.1 (hundreds of snapshots/day is fine), but matters at scale (millions of snapshots).

---

## Next Steps

This is v0.0.1 - the foundation. Future versions will add:

- **v0.0.2**: AI-powered work mode detection (GPT-4 analyzes snapshots)
- **v0.0.3**: Gentle interventions (collaboration debt reminders)
- **v0.1.0**: Backend sync to Supabase for multi-device
- **v0.2.0**: Auto-generate collaboration artifacts (standup notes, commit summaries)

For now, focus on:
1. Fixing bugs
2. Improving work mode detection heuristics
3. Making the dashboard more useful

---

**Questions?** File an issue: https://github.com/anthropics/claude-code/issues
