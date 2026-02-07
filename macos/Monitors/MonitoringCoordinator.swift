import Foundation
import os.log

// MARK: - Logging

private let monitoringLog = OSLog(subsystem: "com.80hd.app", category: "monitoring")

/// Coordinates all monitoring activities and snapshot capture.
///
/// Responsibilities:
/// - Aggregate data from all monitors
/// - Capture snapshots on schedule
/// - Handle monitor failures gracefully
/// - Update AppState with latest context
///
/// Separation of concerns: AppDelegate handles lifecycle,
/// MonitoringCoordinator handles monitoring.
@MainActor
class MonitoringCoordinator {
    // MARK: - Properties

    /// Database for persistence
    private let database: DatabaseManager

    /// Monitors
    private let gitMonitor: GitMonitor
    private let systemMonitor: SystemMonitor

    /// Timer for periodic snapshots
    private var monitorTimer: Timer?

    /// Current session ID
    private var currentSessionId: Int64?

    /// Monitoring state
    private(set) var isMonitoring = false

    // MARK: - Initialization

    init(
        database: DatabaseManager = .shared,
        gitMonitor: GitMonitor = GitMonitor(),
        systemMonitor: SystemMonitor = SystemMonitor()
    ) {
        self.database = database
        self.gitMonitor = gitMonitor
        self.systemMonitor = systemMonitor
    }

    // MARK: - Lifecycle

    /// Start monitoring with periodic snapshots
    func startMonitoring(interval: TimeInterval = 300) throws {
        guard !isMonitoring else {
            os_log("Monitoring already active, skipping start", log: monitoringLog, type: .info)
            return
        }

        os_log("Starting monitoring (interval: %.0fs)", log: monitoringLog, type: .info, interval)

        // Verify database health before starting
        do {
            let health = try database.verifyDatabase()
            guard health.isHealthy else {
                os_log("Database health check failed: %{public}s", log: monitoringLog, type: .error, health.summary)
                throw MonitoringError.databaseUnhealthy(health.summary)
            }
            os_log("Database health check passed", log: monitoringLog, type: .debug)
        } catch let error as DatabaseError {
            os_log("Database verification failed: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
            throw error
        }

        // Run database cleanup (async, non-blocking)
        Task.detached(priority: .utility) {
            do {
                try await Task.sleep(for: .seconds(5)) // Wait 5 seconds after startup
                try self.database.cleanupOldData()
            } catch {
                os_log("Database cleanup failed: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
                // Non-fatal - continue monitoring
            }
        }

        // Create a new session
        do {
            currentSessionId = try database.createSession()
            os_log("Started work session %lld", log: monitoringLog, type: .info, currentSessionId ?? 0)
        } catch {
            os_log("Failed to create work session: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
            throw MonitoringError.sessionCreationFailed(error.localizedDescription)
        }

        // Capture initial snapshot
        captureSnapshot()

        // Schedule periodic monitoring every 5 minutes (300 seconds)
        monitorTimer = Timer.scheduledTimer(
            withTimeInterval: interval,
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                self?.captureSnapshot()
            }
        }

        // Ensure timer fires even when menu is open
        if let timer = monitorTimer {
            RunLoop.current.add(timer, forMode: .common)
            os_log("Timer scheduled with .common run loop mode", log: monitoringLog, type: .debug)
        }

        isMonitoring = true
        os_log("Monitoring started successfully (interval: %.0fs)", log: monitoringLog, type: .info, interval)
    }

    /// Stop monitoring and end session
    func stopMonitoring() {
        guard isMonitoring else {
            os_log("Monitoring not active, skipping stop", log: monitoringLog, type: .info)
            return
        }

        os_log("Stopping monitoring", log: monitoringLog, type: .info)

        monitorTimer?.invalidate()
        monitorTimer = nil

        // End current session
        if let sessionId = currentSessionId {
            do {
                try database.endSession(id: sessionId)
                os_log("Ended work session %lld", log: monitoringLog, type: .info, sessionId)
            } catch {
                os_log("Failed to end session %lld: %{public}s", log: monitoringLog, type: .error, sessionId, error.localizedDescription)
                // Don't crash - monitoring stops anyway
            }
        }

        isMonitoring = false
        currentSessionId = nil
        os_log("Monitoring stopped successfully", log: monitoringLog, type: .info)
    }

    // MARK: - Snapshot Capture

    /// Capture a snapshot from all monitors
    private func captureSnapshot() {
        os_log("Capturing snapshot", log: monitoringLog, type: .debug)

        // Gather context from monitors
        let git = captureGitContext()
        let system = captureSystemContext()

        // Build snapshot
        var snapshot = ContextSnapshot(
            timestamp: Date(),
            git: git,
            system: system
        )
        snapshot.sessionId = currentSessionId

        // Update global state
        AppState.shared.update(from: snapshot)

        // Save to database
        do {
            try database.saveSnapshot(snapshot)
        } catch {
            os_log("Failed to save snapshot: %{public}s", log: monitoringLog, type: .error, error.localizedDescription)
            // Don't crash - continue monitoring even if save fails
        }

        // Log snapshot summary (will be removed in Phase 4)
        logSnapshot(snapshot)
    }

    // MARK: - Monitor Capture with Graceful Degradation

    private func captureGitContext() -> GitContext? {
        guard gitMonitor.isAvailable else {
            os_log("Git monitor not available (no git repo)", log: monitoringLog, type: .debug)
            return nil
        }

        let context = gitMonitor.getCurrentState()
        if let context = context {
            os_log("Git context captured: %{public}s/%{public}s (%d commits today)",
                   log: monitoringLog, type: .debug,
                   context.repoName, context.branch, context.commitsToday)
        }
        return context
    }

    private func captureSystemContext() -> SystemContext {
        // SystemMonitor is always available and shouldn't fail
        let context = systemMonitor.getCurrentState()
        os_log("System context captured: %{public}s (switches: %d)",
               log: monitoringLog, type: .debug,
               context.activeApp, context.appSwitchesLastHour)
        return context
    }

    // MARK: - Logging

    private func logSnapshot(_ snapshot: ContextSnapshot) {
        let time = formatTime(snapshot.timestamp)
        print("[\(time)] Snapshot captured:")
        print("  - Work mode: \(snapshot.workMode.description)")
        print("  - Active app: \(snapshot.system.activeApp)")

        if let git = snapshot.git {
            print("  - Git repo: \(git.repoName)")
            print("  - Branch: \(git.branch)")
            print("  - Commits today: \(git.commitsToday)")
        }

        if snapshot.isDuringSacredTime {
            print("  - 🛡️ Sacred Time (9-12 AM)")
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

// MARK: - Errors

enum MonitoringError: Error, LocalizedError {
    case databaseUnhealthy(String)
    case sessionCreationFailed(String)

    var errorDescription: String? {
        switch self {
        case .databaseUnhealthy(let details):
            return "Database is unhealthy and monitoring cannot start:\n\(details)"
        case .sessionCreationFailed(let details):
            return "Failed to create work session: \(details)"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .databaseUnhealthy:
            return "Delete the database file at ~/Library/Application Support/80HD/database.sqlite and restart the app."
        case .sessionCreationFailed:
            return "Check database permissions and try restarting the app."
        }
    }
}
