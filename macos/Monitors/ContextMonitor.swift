import Foundation

/// Protocol for all context monitors.
///
/// Each monitor captures a specific aspect of Travis's work context:
/// - GitMonitor: Repository activity (commits, branches, changes)
/// - SystemMonitor: Active application, window focus
/// - BrowserMonitor: Safari tab activity (Phase 2)
/// - TeamsMonitor: Communication status (Phase 3)
///
/// Monitors must be:
/// - Non-blocking (async where needed)
/// - Privacy-respecting (metadata only, never content)
/// - Fault-tolerant (graceful degradation if unavailable)
protocol ContextMonitor {
    /// Unique identifier for this monitor
    var name: String { get }

    /// Whether this monitor is currently available
    var isAvailable: Bool { get }

    /// Capture current state
    /// Returns nil if monitoring is unavailable or fails
    func capture() async -> MonitorResult?
}

/// Result from any monitor - wraps the specific context type
enum MonitorResult {
    case git(GitContext)
    case system(SystemContext)
    case browser(BrowserContext)
    case communication(CommunicationContext)

    var monitorName: String {
        switch self {
        case .git: return "git"
        case .system: return "system"
        case .browser: return "browser"
        case .communication: return "communication"
        }
    }
}

/// Browser context (Phase 2 - Safari extension)
struct BrowserContext: Codable, Equatable {
    let activeDomain: String?
    let tabCount: Int
    let switchesLast15Min: Int
    let domainsVisited: [String]
}

/// Communication context (Phase 3 - Teams/Outlook)
struct CommunicationContext: Codable, Equatable {
    let teamsStatus: String // available, busy, dnd, away
    let inCall: Bool
    let messagesSentToday: Int
    let hoursSinceLastMessage: Double
    let inMeeting: Bool
}

/// Aggregates results from all monitors into a single snapshot
class ContextAggregator {
    private let monitors: [ContextMonitor]

    init(monitors: [ContextMonitor]) {
        self.monitors = monitors
    }

    /// Gather context from all available monitors in parallel
    func gatherSnapshot() async -> [MonitorResult] {
        await withTaskGroup(of: MonitorResult?.self) { group in
            for monitor in monitors {
                group.addTask {
                    await monitor.capture()
                }
            }

            var results: [MonitorResult] = []
            for await result in group {
                if let result = result {
                    results.append(result)
                }
            }
            return results
        }
    }
}
