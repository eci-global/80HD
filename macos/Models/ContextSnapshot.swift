import Foundation

/// A point-in-time capture of Travis's work context.
///
/// Snapshots are captured every 5 minutes and stored in SQLite.
/// They form the basis for:
/// - Work mode detection (Deep Focus, Struggling, Pressure)
/// - Collaboration debt calculation
/// - Pattern learning over time
/// - Intervention decision making
struct ContextSnapshot: Codable, Equatable {
    /// When this snapshot was captured
    let timestamp: Date

    /// Git repository context (nil if no repo active)
    let git: GitContext?

    /// System/application context
    let system: SystemContext

    /// Browser context (Phase 2)
    var browser: BrowserContext?

    /// Communication context (Phase 3)
    var communication: CommunicationContext?

    /// Derived work mode based on all signals
    var workMode: WorkMode {
        return WorkMode.detect(from: self)
    }

    /// Database ID (set after saving)
    var id: Int64?

    /// Session ID this snapshot belongs to
    var sessionId: Int64?

    // MARK: - Convenience Initializers

    init(
        timestamp: Date = Date(),
        git: GitContext?,
        system: SystemContext,
        browser: BrowserContext? = nil,
        communication: CommunicationContext? = nil
    ) {
        self.timestamp = timestamp
        self.git = git
        self.system = system
        self.browser = browser
        self.communication = communication
    }
}

// MARK: - Time Window Queries

extension ContextSnapshot {
    /// Check if this snapshot is within sacred focus time (9am-12pm)
    var isDuringSacredTime: Bool {
        let hour = Calendar.current.component(.hour, from: timestamp)
        return hour >= 9 && hour < 12
    }

    /// Check if this snapshot is during house time (8am-9am)
    var isDuringHouseTime: Bool {
        let hour = Calendar.current.component(.hour, from: timestamp)
        return hour >= 8 && hour < 9
    }

    /// Check if this snapshot is during collaborative time (2pm+)
    var isDuringCollaborativeTime: Bool {
        let hour = Calendar.current.component(.hour, from: timestamp)
        return hour >= 14
    }

    /// Check if this snapshot is during tapering time (12pm-2pm)
    var isDuringTaperingTime: Bool {
        let hour = Calendar.current.component(.hour, from: timestamp)
        return hour >= 12 && hour < 14
    }
}

// MARK: - Signal Detection

extension ContextSnapshot {
    /// Struggle signals present in this snapshot
    var struggleSignals: [String] {
        var signals: [String] = []

        // No commits for 2+ hours
        if let hoursSinceCommit = git?.hoursSinceLastCommit, hoursSinceCommit > 2 {
            signals.append("no_commits_2h")
        }

        // High app switching (distraction indicator)
        if system.appSwitchesLastHour > 20 {
            signals.append("high_app_switching")
        }

        // High browser switching (research loop)
        if let browserSwitches = browser?.switchesLast15Min, browserSwitches > 20 {
            signals.append("high_browser_switching")
        }

        return signals
    }

    /// Pressure signals present in this snapshot
    var pressureSignals: [String] {
        var signals: [String] = []

        // Commits to main (bypassing feature branch)
        if git?.hasCommitsToMain == true {
            signals.append("commits_to_main")
        }

        // Not on feature branch during active development
        if let git = git, !git.isOnFeatureBranch && git.uncommittedChanges {
            signals.append("not_feature_branch")
        }

        // Off-hours work (before 9am or after 6pm)
        let hour = Calendar.current.component(.hour, from: timestamp)
        if hour < 9 || hour >= 18 {
            signals.append("off_hours_work")
        }

        return signals
    }

    /// Whether this snapshot indicates active collaboration
    var isCollaborating: Bool {
        return system.isCommunicationApp || (communication?.inCall == true)
    }
}
