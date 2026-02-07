import AppKit
import Foundation

/// Monitors system-level activity.
///
/// Tracks:
/// - Active (frontmost) application
/// - Application switches per hour
/// - Whether "focus" apps are active (Claude Code, VS Code, Xcode)
///
/// Privacy: Only captures app names and bundle IDs, never window content or keystrokes.
class SystemMonitor: ContextMonitor {
    let name = "system"

    /// Apps considered "focus" apps (deep work indicators)
    private let focusApps: Set<String> = [
        "com.apple.Terminal",
        "com.googlecode.iterm2",
        "com.microsoft.VSCode",
        "com.apple.dt.Xcode",
        "dev.warp.Warp-Stable",
        "com.todesktop.230313mzl4w4u92"  // Claude Code
    ]

    /// Apps considered "communication" apps
    private let communicationApps: Set<String> = [
        "com.microsoft.teams",
        "com.microsoft.teams2",
        "com.microsoft.Outlook",
        "com.apple.mail",
        "com.tinyspeck.slackmacgap"
    ]

    /// Track app switches
    private var appSwitchHistory: [(app: String, time: Date)] = []
    private var lastActiveApp: String?

    var isAvailable: Bool {
        // System monitoring is always available on macOS
        return true
    }

    func capture() async -> MonitorResult? {
        let context = getCurrentState()
        return .system(context)
    }

    /// Get current system state
    func getCurrentState() -> SystemContext {
        let workspace = NSWorkspace.shared
        let frontApp = workspace.frontmostApplication

        let bundleID = frontApp?.bundleIdentifier ?? "unknown"
        let appName = frontApp?.localizedName ?? "unknown"

        // Track app switch
        if bundleID != lastActiveApp {
            appSwitchHistory.append((bundleID, Date()))
            lastActiveApp = bundleID

            // Keep only last hour of history
            let oneHourAgo = Date().addingTimeInterval(-3600)
            appSwitchHistory = appSwitchHistory.filter { $0.time > oneHourAgo }
        }

        return SystemContext(
            activeApp: appName,
            bundleID: bundleID,
            isFocusApp: focusApps.contains(bundleID),
            isCommunicationApp: communicationApps.contains(bundleID),
            appSwitchesLastHour: appSwitchHistory.count,
            runningApps: getRunningAppNames()
        )
    }

    /// Get list of currently running app names (for context)
    private func getRunningAppNames() -> [String] {
        return NSWorkspace.shared.runningApplications
            .filter { $0.activationPolicy == .regular } // Only regular apps
            .compactMap { $0.localizedName }
    }

    /// Calculate app switches in the last N minutes
    func appSwitchesInLast(minutes: Int) -> Int {
        let cutoff = Date().addingTimeInterval(-Double(minutes * 60))
        return appSwitchHistory.filter { $0.time > cutoff }.count
    }
}

/// System context
struct SystemContext: Codable, Equatable {
    let activeApp: String
    let bundleID: String
    let isFocusApp: Bool
    let isCommunicationApp: Bool
    let appSwitchesLastHour: Int
    let runningApps: [String]

    /// High switching rate indicates distraction or multitasking
    var isHighSwitchingRate: Bool {
        return appSwitchesLastHour > 20
    }
}
