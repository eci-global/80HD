# 80HD Architecture

## System Overview

80HD is a native macOS application with three primary components:

```
80HD.app (Native Swift Application)
├── Main App (Menu Bar + Chat Interface)
│   ├── Menu Bar Status Item (always visible)
│   ├── Chat Window (on-demand SwiftUI interface)
│   └── Settings Panel (configuration)
│
├── Background Service (always monitoring)
│   ├── Context Monitors (system, apps, browser, tools)
│   ├── Pattern Learning Engine (behavioral analysis)
│   ├── Intervention Decision Logic (when to nudge)
│   └── Artifact Generation (draft updates, posts)
│
├── Safari Extension (browser monitoring)
│   ├── Tab tracking (active, switches, domains)
│   ├── Shared with main app via App Groups
│   └── Native Swift implementation
│
└── Data Layer
    ├── SQLite database (encrypted, local)
    ├── macOS Keychain (OAuth tokens)
    └── UserDefaults/App Groups (ephemeral state)
```

## Technology Stack

### Core Technologies
- **Language:** Swift 5.9+
- **UI Framework:** SwiftUI (macOS 14+)
- **Database:** SQLite with SQLite.swift wrapper
- **Browser Integration:** Safari App Extension (Swift)
- **AI Provider:** Anthropic Claude API
- **Auth:** OAuth 2.0 with macOS Keychain storage

### Integration Layer
- **MCP Servers:** Model Context Protocol for tool integrations
  - Linear (official MCP server)
  - GitHub (community MCP server)
  - Microsoft Graph (custom MCP server - to build)
  - System Activity (custom MCP server - to build)
  - Azure DevOps (custom MCP server - to build)

### System APIs
- **macOS APIs:**
  - NSWorkspace (active app, window tracking)
  - NSUserDefaults (shared state via App Groups)
  - Keychain Services (secure token storage)
  - NSDistributedNotificationCenter (system events)
  - CGEventTap (optional: mouse/keyboard activity)
  - Network.framework (API requests)

## Architecture Patterns

### 1. Separation of Concerns

Four distinct layers with clear boundaries:

```swift
// UI Layer
MenuBarView (SwiftUI)
ChatWindowView (SwiftUI)
SettingsView (SwiftUI)

// Application Logic Layer
AgentBrain (decision making)
PatternLearner (behavioral analysis)
InterventionEngine (when to act)
ArtifactGenerator (content creation)

// Data Layer
DatabaseManager (SQLite operations)
KeychainManager (secure storage)
CacheManager (ephemeral state)

// Integration Layer
MCPServerManager (tool integrations)
APIClient (direct API calls)
SystemMonitor (macOS activity)
```

### 2. Event-Driven Architecture

React to events, minimize polling:

```swift
// Timer-based (every 5 minutes)
Timer.publish(every: 300, on: .main, in: .common)
    .sink { _ in
        contextAggregator.gatherSnapshot()
        evaluateInterventions()
    }

// Event-based (immediate)
NotificationCenter.default.publisher(for: NSWorkspace.didActivateApplicationNotification)
    .sink { notification in
        handleAppSwitch(notification)
    }

// Git hooks (real-time)
watchGitDirectory()
    .sink { commit in
        recordCommit(commit)
    }
```

### 3. Async/Await Pattern

All operations non-blocking:

```swift
func gatherContext() async {
    async let git = gitMonitor.getCurrentState()
    async let browser = browserMonitor.getActiveTab()
    async let teams = teamsMonitor.getStatus()
    async let system = systemMonitor.getActivity()
    
    let context = await ContextSnapshot(
        git: git,
        browser: browser,
        teams: teams,
        system: system
    )
    
    await database.save(context)
}
```

### 4. State Management

Global state with clear ownership:

```swift
@MainActor
class AppState: ObservableObject {
    @Published var currentContext: ContextSnapshot?
    @Published var collaborationDebt: DebtScore = .low
    @Published var workMode: WorkMode = .unknown
    @Published var activeInterventions: [Intervention] = []
    
    // Single source of truth
    static let shared = AppState()
}
```

## Component Architecture

### Menu Bar Interface

```swift
class MenuBarController {
    private var statusItem: NSStatusItem!
    
    func setup() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(named: "MenuBarIcon")
        statusItem.menu = buildMenu()
    }
    
    func buildMenu() -> NSMenu {
        let menu = NSMenu()
        menu.addItem(statusLine())  // "Deep work (3h 24m)"
        menu.addItem(debtLine())    // "Collaboration debt: MEDIUM"
        menu.addItem(NSMenuItem.separator())
        menu.addItem(chatMenuItem())     // "Chat"
        menu.addItem(settingsMenuItem()) // "Settings"
        menu.addItem(quitMenuItem())     // "Quit"
        return menu
    }
}
```

### Context Aggregator

```swift
class ContextAggregator {
    let monitors: [ContextMonitor] = [
        GitMonitor(),
        BrowserMonitor(),
        TeamsMonitor(),
        OutlookMonitor(),
        LinearMonitor(),
        SystemMonitor()
    ]
    
    func gatherSnapshot() async -> ContextSnapshot {
        // Run all monitors in parallel
        let results = await withTaskGroup(of: MonitorResult.self) { group in
            for monitor in monitors {
                group.addTask {
                    await monitor.capture()
                }
            }
            
            var collected: [MonitorResult] = []
            for await result in group {
                collected.append(result)
            }
            return collected
        }
        
        return ContextSnapshot(results: results)
    }
}
```

### Pattern Learning Engine

```swift
class PatternLearner {
    func analyzeWorkMode(history: [ContextSnapshot]) -> WorkMode {
        // Detect patterns
        let focusDuration = calculateFocusDuration(history)
        let appSwitching = calculateSwitchingRate(history)
        let commitRate = calculateCommitRate(history)
        
        // Classify mode
        if focusDuration > 2.hours && commitRate > 0.5 && appSwitching < 5 {
            return .deepFocus
        } else if commitRate < 0.1 && appSwitching > 20 {
            return .struggling
        } else if hasCommitsToMain(history) && ignoringComms(history) {
            return .pressure
        }
        
        return .normal
    }
    
    func learnInterventionTiming(intervention: Intervention, outcome: Outcome) {
        // Update model based on user response
        if outcome == .approved && intervention.timingMinutes == 240 {
            // Learn: "4 hour mark is good"
            interventionModel.reinforcePattern(.fourHourMark)
        } else if outcome == .dismissed && intervention.timingMinutes == 60 {
            // Learn: "Too early"
            interventionModel.weakenPattern(.oneHourMark)
        }
    }
}
```

### Intervention Engine

```swift
class InterventionEngine {
    func evaluateNeed(context: ContextSnapshot) async -> Intervention? {
        // Check time window
        if context.inSacredFocusTime() {
            return nil  // Don't interrupt 9am-12pm
        }
        
        // Check struggle signals
        if context.isStruggling() && context.durationStruggling > 2.hours {
            return Intervention(
                type: .helpOffer,
                message: "Been researching for a bit. Want to post a question?",
                timing: .now
            )
        }
        
        // Check collaboration debt
        if context.collaborationDebt == .high && context.isGoodTimingForUpdate() {
            let draft = await artifactGenerator.createUpdate(context)
            return Intervention(
                type: .updateSuggestion,
                message: "Ready to share progress?",
                draft: draft,
                timing: .now
            )
        }
        
        return nil
    }
}
```

### Artifact Generator

```swift
class ArtifactGenerator {
    let claudeAPI: ClaudeAPIClient
    
    func createUpdate(context: ContextSnapshot) async -> Artifact {
        let prompt = """
        Generate a collaboration update based on this context:
        
        Work done:
        - \(context.git.commitsSummary)
        - \(context.linear.updatesSummary)
        
        Style: Technical but approachable
        Audience: Platform team + stakeholders
        Channels: GitHub Discussion, Teams, Linear
        
        Create:
        1. GitHub Discussion (technical depth)
        2. Teams post (awareness, 2 sentences + link)
        3. Linear comment (project status)
        """
        
        let response = await claudeAPI.generate(prompt: prompt)
        
        return Artifact(
            githubDiscussion: response.githubDiscussion,
            teamsPost: response.teamsPost,
            linearComment: response.linearComment
        )
    }
}
```

## Data Flow

### Context Gathering Flow

```
Every 5 minutes:
1. Timer fires
2. ContextAggregator.gatherSnapshot()
3. Each monitor captures state (parallel)
4. Results aggregated into ContextSnapshot
5. Snapshot saved to SQLite
6. PatternLearner analyzes trends
7. InterventionEngine evaluates need
8. If intervention needed, notify user
```

### Intervention Flow

```
1. User receives notification
2. User clicks "View Draft" or dismisses
3. If approved:
   a. ArtifactGenerator creates content
   b. MCPServerManager posts to channels
   c. Track engagement over time
4. If dismissed:
   a. Record dismissal
   b. Learn from timing/context
   c. Adjust future interventions
5. Record outcome in database
```

### Learning Flow

```
1. Intervention occurs at time T
2. User responds (approve/dismiss/snooze)
3. PatternLearner records:
   - Time of day
   - Work mode
   - Collaboration debt level
   - User response
4. Over time, learns:
   - Best times for nudges
   - Which work modes allow interruption
   - Optimal debt threshold before nudging
5. Adjusts future decision-making
```

## Security & Privacy

### Data Storage

```
Local Only:
├── SQLite database (~/Library/Application Support/80HD/database.sqlite)
│   └── Encrypted at rest using SQLCipher
├── macOS Keychain (OAuth tokens, API keys)
│   └── Encrypted by macOS
└── UserDefaults (App Groups for Safari extension)
    └── Ephemeral state only, no sensitive data

Never Stored:
├── Message content (email, Teams, Slack)
├── Document content (files, docs)
├── Meeting titles/details
├── Full URLs (domains only)
├── Passwords
└── Keystrokes
```

### OAuth Flow

```swift
class OAuthManager {
    func authenticate(service: Service) async throws -> Token {
        // 1. Start local callback server
        let server = LocalCallbackServer(port: 8080)
        try await server.start()
        
        // 2. Open browser to OAuth URL
        let authURL = service.authorizationURL(redirectURI: "http://localhost:8080/callback")
        NSWorkspace.shared.open(authURL)
        
        // 3. Wait for callback
        let code = try await server.waitForCallback()
        
        // 4. Exchange code for token
        let token = try await service.exchangeCode(code)
        
        // 5. Store in Keychain
        try KeychainManager.shared.store(token: token, for: service)
        
        // 6. Shutdown server
        await server.stop()
        
        return token
    }
}
```

### API Communication

```
All API calls:
├── HTTPS only (TLS 1.3)
├── Tokens from Keychain
├── Auto-refresh on expiration
├── Rate limiting respected
└── Errors logged locally only
```

## Scalability Considerations

### Database Performance

```swift
// Use indexes for common queries
CREATE INDEX idx_sessions_started ON work_sessions(started_at);
CREATE INDEX idx_interventions_session ON interventions(session_id);
CREATE INDEX idx_snapshots_timestamp ON context_snapshots(timestamp);

// Periodic cleanup
func cleanupOldData() async {
    // Keep last 90 days of snapshots
    await database.execute(
        "DELETE FROM context_snapshots WHERE timestamp < datetime('now', '-90 days')"
    )
    
    // Keep all interventions (for learning)
    // Keep all sessions (for trends)
}
```

### Memory Management

```swift
// Don't hold entire history in memory
class ContextHistory {
    private let database: DatabaseManager
    
    func recent(hours: Int) async -> [ContextSnapshot] {
        // Query database, don't cache
        return await database.snapshots(since: Date().addingTimeInterval(-Double(hours * 3600)))
    }
}
```

### Background Processing

```swift
// Use DispatchQueue for heavy work
DispatchQueue.global(qos: .userInitiated).async {
    // Analyze patterns
    let patterns = patternLearner.analyze(history)
    
    DispatchQueue.main.async {
        // Update UI on main thread
        self.updateUI(with: patterns)
    }
}
```

## Error Handling

### Graceful Degradation

```swift
// If one monitor fails, others continue
func gatherSnapshot() async -> ContextSnapshot {
    var results: [MonitorResult] = []
    
    for monitor in monitors {
        do {
            let result = try await monitor.capture()
            results.append(result)
        } catch {
            logger.warning("Monitor \(monitor.name) failed: \(error)")
            // Continue with other monitors
        }
    }
    
    return ContextSnapshot(results: results)
}
```

### Retry Logic

```swift
func apiCall(retries: Int = 3) async throws -> Response {
    for attempt in 1...retries {
        do {
            return try await performAPICall()
        } catch let error as APIError where error.isRetryable {
            if attempt < retries {
                await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                continue
            }
            throw error
        } catch {
            throw error
        }
    }
    fatalError("Unreachable")
}
```

### User Communication

```swift
// Show user what's happening
func handleError(_ error: Error) {
    switch error {
    case .tokenExpired:
        notify("Please reconnect to \(service.name)")
        
    case .apiDown:
        notify("Can't reach \(service.name) right now. Will try again.")
        
    case .rateLimited:
        notify("Too many requests. Slowing down.")
        
    default:
        notify("Something went wrong. Details logged.")
    }
}
```

## Testing Strategy

### Unit Tests
- Individual monitor logic
- Pattern detection algorithms
- Intervention decision logic
- Database operations

### Integration Tests
- OAuth flow end-to-end
- MCP server communication
- Safari extension ↔ main app
- API client with mock responses

### Manual Testing
- Real work scenarios
- Different work modes
- User flows (approve, dismiss, snooze)
- Monitor accuracy

## Deployment

### Distribution Method
- Phase 1: .app bundle (direct distribution)
- Phase 2: Signed .dmg (notarized by Apple)
- Phase 3: Mac App Store (if appropriate)

### Auto-Updates
- Sparkle framework (if not in App Store)
- Check for updates weekly
- User can disable auto-update

### System Requirements
- macOS 14.0+ (Sonoma)
- Safari 17.0+
- 100MB disk space
- Always-on internet (for MCP/API)

## Future Considerations

### Potential Enhancements
- Multiple user profiles (work vs personal)
- Team insights (aggregated, anonymous)
- Integration with more tools (Slack, Zoom, etc.)
- Mobile companion app (iOS)
- Weekly/monthly reports

### Scaling
- Currently designed for single user
- Database schema supports multi-user
- OAuth per-user already implemented
- Could become team product later
