# Handoff to Claude Code

**Status:** Ready for Implementation  
**Date:** February 1, 2026  
**Phase:** Pre-Development → Phase 1

## Executive Summary

This document provides everything Claude Code needs to begin implementing 80HD, a native macOS collaboration agent for ADHD professionals.

**What We're Building:** Native Swift menu bar app that monitors work context, learns patterns, and proactively suggests collaboration touchpoints with minimal friction.

**Why:** Travis (ADHD, Platform Enablement Lead) enters hyperfocus "cave mode," does great work, but collaboration is invisible. This causes trust issues and anxiety. We're making collaboration easier than not collaborating.

**Success Metrics:**
1. Trust increases (with teams, leadership)
2. Anxiety decreases (about collaboration, cave mode)

---

## Complete Context Available

All project documentation is in `/mnt/user-data/outputs/80HD/`:

```
80HD/
├── README.md                   # Project overview
├── ARCHITECTURE.md             # System design, tech stack
├── REQUIREMENTS.md             # Travis's work patterns, needs
├── DESIGN_DECISIONS.md         # Why we made specific choices
├── BUILD_PLAN.md               # 7-phase implementation roadmap
├── CONTEXT_MODEL.md            # How 80HD interprets behavior
├── DATA_SCHEMA.md              # SQLite database design
├── INTEGRATION_SPEC.md         # Tool integration details
└── HANDOFF_TO_CLAUDE_CODE.md   # This document
```

**Read these first:**
1. README.md - Understand the mission
2. REQUIREMENTS.md - Understand Travis
3. ARCHITECTURE.md - Understand the system
4. BUILD_PLAN.md - Know the plan

---

## Critical Context About Travis

### Physical Setup
```
LEFT Monitor (Horizontal):
├── Desktop 1: Claude Code (where focus happens)
└── Desktop 2: Teams + Outlook (comms hub)

RIGHT Monitor (Vertical):
├── Top: Firefox → Safari (browsers)
└── Bottom: Terminals
```

**Key Pattern:** Hours on Desktop 1 with no Desktop 2 checks = Deep focus, don't interrupt

### Daily Schedule
```
8:00-9:00 AM:  House time (NOT work, ignore)
9:00-12:00 PM: SACRED FOCUS (protect aggressively)
12:00-2:00 PM: Tapering (gentle nudges okay)
2:00 PM+:      Collaborative time (full intervention)
```

### Work Modes to Detect
```
Deep Focus:
├── Desktop 1 for 2+ hours
├── Steady commits
├── Low app switching
└── Don't interrupt

Struggling:
├── No commits for 2+ hours
├── High browser switching (20+/15min)
├── Heavy Firecrawl MCP usage (5+/15min)
├── Long Claude Code conversations (30+ messages)
└── Suggest posting question

Pressure:
├── Commits to main (not feature branch)
├── Ignoring Desktop 2 (4+ hours)
├── Working off-hours
└── Offer to handle comms
```

### Tools Used
- **VCS:** Azure DevOps + GitHub
- **Project Mgmt:** Linear (source of truth) → syncs to GitHub Issues + Jira
- **Communication:** Teams (primary), Outlook
- **Browser:** Migrating Firefox → Safari
- **IDE:** Claude Code
- **Docs:** Confluence

### What We Post (Multi-Channel Strategy)
1. **GitHub Discussions** - Technical depth
2. **Teams** - Awareness (2 sentences + link)
3. **Linear** - Project status
4. **Confluence** - ADRs, documentation

**Why all channels:** Fights Travis's fear of being ignored. One channel = easy to miss. Multiple = impossible to ignore.

---

## Technology Stack Summary

**Language:** Swift 5.9+  
**UI:** SwiftUI (macOS 14+)  
**Database:** SQLite + SQLCipher  
**Browser:** Safari App Extension  
**AI:** Anthropic Claude API  
**Integrations:** MCP servers (Model Context Protocol)

**Why Swift:** Native macOS integration, system access, single codebase with Safari extension, trusted by users.

---

## Phase 1 Implementation Plan (Week 1)

### Goal
Working menu bar app with basic monitoring.

### Deliverables
- [ ] Xcode project structure
- [ ] Menu bar icon and basic menu
- [ ] SQLite database (encrypted)
- [ ] Basic Git monitoring
- [ ] Active app detection
- [ ] Simple chat window skeleton
- [ ] Data models

### Step-by-Step Implementation

#### Step 1: Create Xcode Project

```bash
# Create new macOS App project
# Name: 80HD
# Organization: com.80hd
# Interface: SwiftUI
# Language: Swift
# Include: Menu Bar App template
```

**Project Structure:**
```
80HD/
├── 80HD.xcodeproj
├── 80HD/
│   ├── App/
│   │   ├── 80HDApp.swift (main entry point)
│   │   └── AppDelegate.swift (menu bar setup)
│   ├── Views/
│   │   ├── MenuBarView.swift
│   │   └── ChatWindowView.swift
│   ├── Monitors/
│   │   ├── ContextMonitor.swift (protocol)
│   │   ├── GitMonitor.swift
│   │   └── SystemMonitor.swift
│   ├── Models/
│   │   ├── ContextSnapshot.swift
│   │   └── WorkSession.swift
│   ├── Database/
│   │   └── DatabaseManager.swift
│   └── Resources/
│       └── Assets.xcassets (menu bar icon)
└── 80HDTests/
```

#### Step 2: Add Dependencies

**Package.swift** or SPM dependencies:
```swift
dependencies: [
    .package(url: "https://github.com/stephencelis/SQLite.swift", from: "0.15.0"),
    .package(url: "https://github.com/sqlcipher/sqlcipher", from: "4.5.0")
]
```

#### Step 3: Implement Menu Bar

**AppDelegate.swift:**
```swift
import SwiftUI
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var chatWindow: NSWindow?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create menu bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "brain.head.profile", accessibilityDescription: "80HD")
        }
        
        // Create menu
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Deep work (0h 0m)", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Collaboration debt: LOW", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Chat", action: #selector(openChat), keyEquivalent: "c"))
        menu.addItem(NSMenuItem(title: "Settings", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        
        statusItem.menu = menu
    }
    
    @objc func openChat() {
        if chatWindow == nil {
            chatWindow = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 600, height: 400),
                styleMask: [.titled, .closable, .resizable],
                backing: .buffered,
                defer: false
            )
            chatWindow?.title = "80HD Chat"
            chatWindow?.contentView = NSHostingView(rootView: ChatWindowView())
            chatWindow?.center()
        }
        chatWindow?.makeKeyAndOrderFront(nil)
    }
    
    @objc func openSettings() {
        // TODO: Implement settings
    }
}
```

#### Step 4: Set up Database

**DatabaseManager.swift:**
```swift
import SQLite
import Foundation

class DatabaseManager {
    static let shared = DatabaseManager()
    private var db: Connection?
    
    private let workSessions = Table("work_sessions")
    private let id = Expression<Int64>("id")
    private let startedAt = Expression<Date>("started_at")
    private let endedAt = Expression<Date?>("ended_at")
    private let primaryFocus = Expression<String?>("primary_focus")
    private let gitCommits = Expression<Int>("git_commits")
    
    init() {
        do {
            let path = FileManager.default
                .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("80HD")
            
            try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
            
            let dbPath = path.appendingPathComponent("database.sqlite").path
            db = try Connection(dbPath)
            
            try createTables()
        } catch {
            print("Database initialization failed: \(error)")
        }
    }
    
    private func createTables() throws {
        try db?.run(workSessions.create(ifNotExists: true) { t in
            t.column(id, primaryKey: .autoincrement)
            t.column(startedAt)
            t.column(endedAt)
            t.column(primaryFocus)
            t.column(gitCommits, defaultValue: 0)
        })
    }
    
    func createSession() throws -> Int64 {
        guard let db = db else { throw DatabaseError.notConnected }
        
        let insert = workSessions.insert(
            startedAt <- Date()
        )
        
        return try db.run(insert)
    }
    
    func endSession(id sessionId: Int64) throws {
        guard let db = db else { throw DatabaseError.notConnected }
        
        let session = workSessions.filter(id == sessionId)
        try db.run(session.update(endedAt <- Date()))
    }
}

enum DatabaseError: Error {
    case notConnected
}
```

#### Step 5: Implement Git Monitor

**GitMonitor.swift:**
```swift
import Foundation

class GitMonitor {
    private var lastCheck: Date = Date()
    
    func getCurrentState() -> GitContext? {
        // Find .git directory from current working directory
        guard let repoPath = findGitRepo() else {
            return nil
        }
        
        return GitContext(
            repo: repoPath,
            branch: getCurrentBranch(repoPath),
            commitsToday: getCommitsToday(repoPath),
            uncommittedChanges: hasUncommittedChanges(repoPath)
        )
    }
    
    private func findGitRepo() -> String? {
        let fileManager = FileManager.default
        let homePath = fileManager.homeDirectoryForCurrentUser.path
        let commonPaths = [
            "\(homePath)/code",
            "\(homePath)/Code",
            "\(homePath)/Projects",
            "\(homePath)/src"
        ]
        
        for path in commonPaths {
            if fileManager.fileExists(atPath: "\(path)/.git") {
                return path
            }
        }
        
        return nil
    }
    
    private func getCurrentBranch(_ repoPath: String) -> String {
        let headPath = "\(repoPath)/.git/HEAD"
        
        guard let content = try? String(contentsOfFile: headPath, encoding: .utf8) else {
            return "unknown"
        }
        
        if content.contains("ref: refs/heads/") {
            return content.components(separatedBy: "refs/heads/").last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "unknown"
        }
        
        return "detached"
    }
    
    private func getCommitsToday(_ repoPath: String) -> Int {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = [
            "-C", repoPath,
            "log",
            "--since=midnight",
            "--oneline",
            "--author=Travis"
        ]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""
            
            return output.components(separatedBy: "\n").filter { !$0.isEmpty }.count
        } catch {
            return 0
        }
    }
    
    private func hasUncommittedChanges(_ repoPath: String) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = ["-C", repoPath, "status", "--porcelain"]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""
            
            return !output.isEmpty
        } catch {
            return false
        }
    }
}

struct GitContext {
    let repo: String
    let branch: String
    let commitsToday: Int
    let uncommittedChanges: Bool
}
```

#### Step 6: Implement System Monitor

**SystemMonitor.swift:**
```swift
import AppKit

class SystemMonitor {
    func getCurrentState() -> SystemContext {
        let workspace = NSWorkspace.shared
        let frontApp = workspace.frontmostApplication
        
        return SystemContext(
            activeApp: frontApp?.localizedName ?? "unknown",
            bundleID: frontApp?.bundleIdentifier ?? "unknown"
        )
    }
}

struct SystemContext {
    let activeApp: String
    let bundleID: String
}
```

#### Step 7: Create Data Models

**ContextSnapshot.swift:**
```swift
import Foundation

struct ContextSnapshot {
    let timestamp: Date
    let git: GitContext?
    let system: SystemContext
    
    // TODO: Add more context as monitors expand
}
```

#### Step 8: Create Chat Window

**ChatWindowView.swift:**
```swift
import SwiftUI

struct ChatWindowView: View {
    @State private var messageText = ""
    @State private var messages: [ChatMessage] = []
    
    var body: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(messages) { message in
                        ChatBubble(message: message)
                    }
                }
                .padding()
            }
            
            // Input
            HStack {
                TextField("Ask 80HD...", text: $messageText)
                    .textFieldStyle(.roundedBorder)
                
                Button("Send") {
                    sendMessage()
                }
                .disabled(messageText.isEmpty)
            }
            .padding()
        }
    }
    
    private func sendMessage() {
        let message = ChatMessage(text: messageText, isUser: true)
        messages.append(message)
        messageText = ""
        
        // TODO: Send to Claude API
        // For now, echo back
        let response = ChatMessage(text: "Got it: \(message.text)", isUser: false)
        messages.append(response)
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isUser: Bool
}

struct ChatBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser { Spacer() }
            
            Text(message.text)
                .padding()
                .background(message.isUser ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(message.isUser ? .white : .primary)
                .cornerRadius(12)
            
            if !message.isUser { Spacer() }
        }
    }
}
```

#### Step 9: Wire Everything Together

**80HDApp.swift:**
```swift
import SwiftUI

@main
struct HD80App: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}
```

#### Step 10: Add Periodic Monitoring

**AppDelegate.swift** (add to existing):
```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    // ... existing code ...
    
    var monitorTimer: Timer?
    let gitMonitor = GitMonitor()
    let systemMonitor = SystemMonitor()
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // ... existing menu bar code ...
        
        // Start monitoring every 5 minutes
        monitorTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            self?.captureSnapshot()
        }
        
        // Capture initial snapshot
        captureSnapshot()
    }
    
    func captureSnapshot() {
        let git = gitMonitor.getCurrentState()
        let system = systemMonitor.getCurrentState()
        
        let snapshot = ContextSnapshot(
            timestamp: Date(),
            git: git,
            system: system
        )
        
        print("Captured snapshot: \(snapshot)")
        // TODO: Save to database
    }
}
```

### End of Phase 1 Success Criteria

- [ ] App launches
- [ ] Menu bar icon visible
- [ ] Database creates successfully
- [ ] Git monitor detects commits
- [ ] System monitor detects active app
- [ ] Chat window opens and closes
- [ ] Snapshots captured every 5 minutes
- [ ] Travis can test and provide feedback

---

## Important Implementation Notes

### Code Style
- Use Swift naming conventions (camelCase)
- Add comments for complex logic
- Use `// TODO:` for future work
- Handle errors gracefully
- Use async/await where appropriate

### Permissions
You'll need to request permissions for:
- File system access (for Git monitoring)
- Accessibility (for window titles)
- These should be requested at first launch

### Testing
- Test on macOS 14+ (Sonoma)
- Travis will test on his actual Mac
- Don't worry about automated tests initially
- Focus on working features

### Git Workflow
- Work in `feature/phase-1` branch
- Small, focused commits
- Merge to `main` when phase complete
- Tag releases: `v0.1.0` (Phase 1 complete)

---

## Questions to Ask Travis

If you need clarification:
1. **Specific File Paths:** Where are git repos? (~/code, ~/Code, ~/Projects?)
2. **Permissions:** Okay to request Accessibility permissions?
3. **Menu Bar Icon:** Any preference for icon design?
4. **Chat UX:** Any specific preferences for chat window?

---

## Next Steps After Phase 1

1. Travis tests Phase 1 build
2. Gather feedback
3. Fix any issues
4. Move to Phase 2: Enhanced monitoring
   - Desktop tracking
   - Monitor detection
   - Enhanced git monitoring
   - Browser preparation

---

## Resources & References

**Documentation:**
- All docs in `/mnt/user-data/outputs/80HD/`
- Refer to ARCHITECTURE.md for detailed patterns
- Refer to DATA_SCHEMA.md for database structure

**External Resources:**
- SQLite.swift: https://github.com/stephencelis/SQLite.swift
- SwiftUI Docs: https://developer.apple.com/documentation/swiftui
- macOS App Dev: https://developer.apple.com/macos/

**Travis Context:**
- He has ADHD (starting Vyvanse tomorrow)
- Works 9-5 but flexible
- Prefers morning focus
- Weekend work common
- Needs low friction (make it easy)

---

## Communication Protocol

**During Development:**
- Ask questions when stuck
- Explain trade-offs when choices arise
- Show code snippets for Travis to review
- Iterate based on feedback

**Code Reviews:**
- Travis will test manually
- Focus on: Does it work? Is it clear?
- Don't worry about perfect code initially
- Working > Perfect

---

## You're Ready!

Everything you need is documented. Start with Phase 1, Step 1 (Create Xcode Project).

If you have questions, ask Travis. If something's unclear in the docs, ask for clarification.

**Remember:**
- Make it work first
- Test each step
- Travis is your user
- Build for his actual needs
- Privacy first, always

Good luck! Let's build something that actually helps Travis collaborate without the friction.

---

**P.S.:** The ultimate success isn't the code—it's Travis feeling less anxious and more trusted. Keep that in mind throughout.
