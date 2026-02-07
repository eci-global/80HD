import Foundation
import SQLite3
import os.log

// MARK: - Logging

private let databaseLog = OSLog(subsystem: "com.80hd.app", category: "database")

/// Manages SQLite database for persistent storage.
///
/// Stores:
/// - Work sessions
/// - Context snapshots (every 5 minutes)
/// - Interventions and responses
/// - Learned patterns (future)
///
/// Location: ~/Library/Application Support/80HD/database.sqlite
///
/// Privacy: All data is local only. Never synced to cloud.
class DatabaseManager {
    /// Shared singleton instance
    static let shared = DatabaseManager()

    /// SQLite database pointer
    private var db: OpaquePointer?

    /// Database file path
    private let dbPath: URL

    // MARK: - Initialization

    private init() {
        // Create app support directory
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("80HD")

        do {
            try FileManager.default.createDirectory(
                at: appSupport,
                withIntermediateDirectories: true
            )
            os_log("Created app support directory at %{public}s", log: databaseLog, type: .info, appSupport.path)
        } catch {
            os_log("Failed to create app support directory: %{public}s", log: databaseLog, type: .error, error.localizedDescription)
            // Continue anyway - openDatabase will fail with more specific error
        }

        dbPath = appSupport.appendingPathComponent("database.sqlite")

        openDatabase()
        createTables()

        os_log("Database initialized at %{public}s", log: databaseLog, type: .info, dbPath.path)
    }

    deinit {
        sqlite3_close(db)
    }

    // MARK: - Database Setup

    private func openDatabase() {
        if sqlite3_open(dbPath.path, &db) != SQLITE_OK {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to open database at %{public}s: %{public}s", log: databaseLog, type: .fault, dbPath.path, errorMessage)
            fatalError("Failed to open database at \(dbPath.path): \(errorMessage). Check file permissions and disk space.")
        }

        os_log("Opened database at %{public}s", log: databaseLog, type: .info, dbPath.path)

        // Enable foreign keys - critical for data integrity
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, "PRAGMA foreign_keys = ON", -1, &stmt, nil) == SQLITE_OK {
            sqlite3_step(stmt)
            sqlite3_finalize(stmt)
            os_log("Enabled foreign key constraints", log: databaseLog, type: .debug)
        } else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to enable foreign keys: %{public}s", log: databaseLog, type: .fault, errorMessage)
            fatalError("Failed to enable foreign keys: \(errorMessage)")
        }
    }

    private func createTables() {
        do {
            os_log("Creating database schema", log: databaseLog, type: .info)

            // Work sessions table
            try execute("""
                CREATE TABLE IF NOT EXISTS work_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    primary_focus TEXT,
                    git_commits INTEGER DEFAULT 0,
                    files_changed INTEGER DEFAULT 0,
                    collaboration_events INTEGER DEFAULT 0,
                    dominant_work_mode TEXT,
                    notes TEXT
                )
            """)

            // Context snapshots table
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
                    struggle_signals TEXT,
                    pressure_signals TEXT,
                    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
                )
            """)

            // Interventions table
            try execute("""
                CREATE TABLE IF NOT EXISTS interventions (
                    id TEXT PRIMARY KEY,
                    session_id INTEGER,
                    type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    responded_at TEXT,
                    response TEXT,
                    draft_content TEXT,
                    FOREIGN KEY (session_id) REFERENCES work_sessions(id)
                )
            """)

            // Indexes for common queries
            try execute("CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON context_snapshots(timestamp)")
            try execute("CREATE INDEX IF NOT EXISTS idx_snapshots_session ON context_snapshots(session_id)")
            try execute("CREATE INDEX IF NOT EXISTS idx_snapshots_workmode ON context_snapshots(work_mode)")
            try execute("CREATE INDEX IF NOT EXISTS idx_interventions_session ON interventions(session_id)")

            os_log("Database schema created successfully", log: databaseLog, type: .info)
        } catch {
            os_log("Failed to create database tables: %{public}s", log: databaseLog, type: .fault, error.localizedDescription)
            fatalError("Failed to create database tables: \(error). Database may be corrupted. Delete \(dbPath.path) and restart the app.")
        }
    }

    // MARK: - Session Operations

    /// Create a new work session
    func createSession() throws -> Int64 {
        let sql = """
            INSERT INTO work_sessions (started_at)
            VALUES (?)
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare session creation: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        let now = ISO8601DateFormatter().string(from: Date())
        sqlite3_bind_text(stmt, 1, now, -1, SQLITE_TRANSIENT)

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to execute session creation: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.executeFailed(errorMessage)
        }

        let sessionId = sqlite3_last_insert_rowid(db)
        os_log("Created work session %lld at %{public}s", log: databaseLog, type: .info, sessionId, now)
        return sessionId
    }

    /// End a work session
    func endSession(id: Int64) throws {
        let sql = """
            UPDATE work_sessions
            SET ended_at = ?
            WHERE id = ?
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare session end: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        let now = ISO8601DateFormatter().string(from: Date())
        sqlite3_bind_text(stmt, 1, now, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(stmt, 2, id)

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to execute session end: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.executeFailed(errorMessage)
        }

        os_log("Ended work session %lld at %{public}s", log: databaseLog, type: .info, id, now)
    }

    // MARK: - Snapshot Operations

    /// Save a context snapshot
    func saveSnapshot(_ snapshot: ContextSnapshot) throws {
        let sql = """
            INSERT INTO context_snapshots (
                session_id, timestamp, work_mode,
                git_repo, git_branch, git_commits_today,
                active_app, app_bundle_id, app_switches_hour,
                struggle_signals, pressure_signals
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare snapshot save: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        // Bind values
        if let sessionId = snapshot.sessionId {
            sqlite3_bind_int64(stmt, 1, sessionId)
        } else {
            sqlite3_bind_null(stmt, 1)
        }

        let timestamp = ISO8601DateFormatter().string(from: snapshot.timestamp)
        sqlite3_bind_text(stmt, 2, timestamp, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(stmt, 3, snapshot.workMode.rawValue, -1, SQLITE_TRANSIENT)

        // Git context
        if let git = snapshot.git {
            sqlite3_bind_text(stmt, 4, git.repoName, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 5, git.branch, -1, SQLITE_TRANSIENT)
            sqlite3_bind_int(stmt, 6, Int32(git.commitsToday))
        } else {
            sqlite3_bind_null(stmt, 4)
            sqlite3_bind_null(stmt, 5)
            sqlite3_bind_null(stmt, 6)
        }

        // System context
        sqlite3_bind_text(stmt, 7, snapshot.system.activeApp, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(stmt, 8, snapshot.system.bundleID, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(stmt, 9, Int32(snapshot.system.appSwitchesLastHour))

        // Signals as JSON arrays
        let struggleJson = try? JSONEncoder().encode(snapshot.struggleSignals)
        let pressureJson = try? JSONEncoder().encode(snapshot.pressureSignals)

        if let json = struggleJson {
            sqlite3_bind_text(stmt, 10, String(data: json, encoding: .utf8), -1, SQLITE_TRANSIENT)
        } else {
            sqlite3_bind_null(stmt, 10)
        }

        if let json = pressureJson {
            sqlite3_bind_text(stmt, 11, String(data: json, encoding: .utf8), -1, SQLITE_TRANSIENT)
        } else {
            sqlite3_bind_null(stmt, 11)
        }

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to save snapshot: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.executeFailed(errorMessage)
        }

        os_log("Saved snapshot for session %{public}@ at %{public}s (mode: %{public}s)",
               log: databaseLog, type: .debug,
               snapshot.sessionId.map { String($0) } ?? "none",
               ISO8601DateFormatter().string(from: snapshot.timestamp),
               snapshot.workMode.rawValue)
    }

    /// Get recent snapshots
    func getRecentSnapshots(hours: Int = 24) throws -> [ContextSnapshot] {
        os_log("Fetching snapshots from last %d hours", log: databaseLog, type: .debug, hours)

        let sql = """
            SELECT timestamp, work_mode, git_repo, git_branch, git_commits_today,
                   active_app, app_bundle_id, app_switches_hour
            FROM context_snapshots
            WHERE timestamp > datetime('now', '-\(hours) hours')
            ORDER BY timestamp DESC
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare snapshot query: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        var snapshots: [ContextSnapshot] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            // Parse timestamp
            guard let timestampStr = sqlite3_column_text(stmt, 0),
                  let timestamp = ISO8601DateFormatter().date(from: String(cString: timestampStr)) else {
                continue
            }

            // Build git context if available
            var gitContext: GitContext?
            if let repoName = sqlite3_column_text(stmt, 2) {
                let branch: String
                if let branchPtr = sqlite3_column_text(stmt, 3) {
                    branch = String(cString: branchPtr)
                } else {
                    branch = "unknown"
                }

                gitContext = GitContext(
                    repoPath: "",
                    repoName: String(cString: repoName),
                    branch: branch,
                    commitsToday: Int(sqlite3_column_int(stmt, 4)),
                    uncommittedChanges: false,
                    hasCommitsToMain: false,
                    lastCommitTime: nil
                )
            }

            // Build system context
            let activeApp: String
            if let activeAppPtr = sqlite3_column_text(stmt, 5) {
                activeApp = String(cString: activeAppPtr)
            } else {
                activeApp = "unknown"
            }

            let bundleID: String
            if let bundleIDPtr = sqlite3_column_text(stmt, 6) {
                bundleID = String(cString: bundleIDPtr)
            } else {
                bundleID = "unknown"
            }

            let systemContext = SystemContext(
                activeApp: activeApp,
                bundleID: bundleID,
                isFocusApp: false,
                isCommunicationApp: false,
                appSwitchesLastHour: Int(sqlite3_column_int(stmt, 7)),
                runningApps: []
            )

            let snapshot = ContextSnapshot(
                timestamp: timestamp,
                git: gitContext,
                system: systemContext
            )

            snapshots.append(snapshot)
        }

        os_log("Retrieved %d snapshots from last %d hours", log: databaseLog, type: .debug, snapshots.count, hours)
        return snapshots
    }

    // MARK: - Intervention Operations

    /// Save an intervention
    func saveIntervention(_ intervention: Intervention, sessionId: Int64?) throws {
        let sql = """
            INSERT INTO interventions (
                id, session_id, type, message, created_at, draft_content
            ) VALUES (?, ?, ?, ?, ?, ?)
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }

        sqlite3_bind_text(stmt, 1, intervention.id.uuidString, -1, SQLITE_TRANSIENT)

        if let sessionId = sessionId {
            sqlite3_bind_int64(stmt, 2, sessionId)
        } else {
            sqlite3_bind_null(stmt, 2)
        }

        sqlite3_bind_text(stmt, 3, intervention.type.rawValue, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(stmt, 4, intervention.message, -1, SQLITE_TRANSIENT)

        let timestamp = ISO8601DateFormatter().string(from: intervention.createdAt)
        sqlite3_bind_text(stmt, 5, timestamp, -1, SQLITE_TRANSIENT)

        if let draft = intervention.draftContent {
            sqlite3_bind_text(stmt, 6, draft, -1, SQLITE_TRANSIENT)
        } else {
            sqlite3_bind_null(stmt, 6)
        }

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw DatabaseError.executeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Record intervention response
    func recordInterventionResponse(id: UUID, response: InterventionResponse) throws {
        let sql = """
            UPDATE interventions
            SET responded_at = ?, response = ?
            WHERE id = ?
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }

        let now = ISO8601DateFormatter().string(from: Date())
        sqlite3_bind_text(stmt, 1, now, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(stmt, 2, response.rawValue, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(stmt, 3, id.uuidString, -1, SQLITE_TRANSIENT)

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw DatabaseError.executeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    // MARK: - Session Queries

    /// Get work sessions from the last N days
    func getRecentSessions(days: Int = 7) throws -> [WorkSessionSummary] {
        os_log("Fetching work sessions from last %d days", log: databaseLog, type: .debug, days)

        let sql = """
            SELECT
                ws.id,
                ws.started_at,
                ws.ended_at,
                COUNT(cs.id) as snapshot_count,
                GROUP_CONCAT(DISTINCT cs.git_repo) as repos,
                SUM(cs.git_commits_today) as total_commits,
                SUM(cs.app_switches_hour) as total_switches
            FROM work_sessions ws
            LEFT JOIN context_snapshots cs ON ws.id = cs.session_id
            WHERE ws.started_at > datetime('now', '-\(days) days')
            GROUP BY ws.id
            ORDER BY ws.started_at DESC
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare session query: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        var sessions: [WorkSessionSummary] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            let sessionId = sqlite3_column_int64(stmt, 0)

            guard let startedAtStr = sqlite3_column_text(stmt, 1),
                  let startedAt = ISO8601DateFormatter().date(from: String(cString: startedAtStr)) else {
                continue
            }

            var endedAt: Date?
            if let endedAtStr = sqlite3_column_text(stmt, 2) {
                endedAt = ISO8601DateFormatter().date(from: String(cString: endedAtStr))
            }

            let snapshotCount = Int(sqlite3_column_int(stmt, 3))

            var repos: [String] = []
            if let reposStr = sqlite3_column_text(stmt, 4) {
                repos = String(cString: reposStr).components(separatedBy: ",")
            }

            let totalCommits = Int(sqlite3_column_int(stmt, 5))
            let totalSwitches = Int(sqlite3_column_int(stmt, 6))

            // Get dominant work mode for this session
            let dominantMode = try? getDominantWorkMode(sessionId: sessionId)

            let session = WorkSessionSummary(
                id: sessionId,
                startedAt: startedAt,
                endedAt: endedAt,
                snapshotCount: snapshotCount,
                repositories: repos,
                totalCommits: totalCommits,
                totalSwitches: totalSwitches,
                dominantMode: dominantMode ?? .unknown
            )

            sessions.append(session)
        }

        os_log("Retrieved %d sessions from last %d days", log: databaseLog, type: .debug, sessions.count, days)
        return sessions
    }

    /// Get dominant work mode for a session
    private func getDominantWorkMode(sessionId: Int64) throws -> WorkMode {
        let sql = """
            SELECT work_mode, COUNT(*) as count
            FROM context_snapshots
            WHERE session_id = ?
            GROUP BY work_mode
            ORDER BY count DESC
            LIMIT 1
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }

        sqlite3_bind_int64(stmt, 1, sessionId)

        if sqlite3_step(stmt) == SQLITE_ROW,
           let modeStr = sqlite3_column_text(stmt, 0) {
            let modeRawValue = String(cString: modeStr)
            return WorkMode(rawValue: modeRawValue) ?? .unknown
        }

        return .unknown
    }

    /// Get snapshots for a specific session
    func getSnapshotsForSession(sessionId: Int64) throws -> [ContextSnapshot] {
        os_log("Fetching snapshots for session %lld", log: databaseLog, type: .debug, sessionId)

        let sql = """
            SELECT timestamp, work_mode, git_repo, git_branch, git_commits_today,
                   active_app, app_bundle_id, app_switches_hour
            FROM context_snapshots
            WHERE session_id = ?
            ORDER BY timestamp ASC
        """

        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            os_log("Failed to prepare snapshot query: %{public}s", log: databaseLog, type: .error, errorMessage)
            throw DatabaseError.prepareFailed(errorMessage)
        }

        sqlite3_bind_int64(stmt, 1, sessionId)

        var snapshots: [ContextSnapshot] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let timestampStr = sqlite3_column_text(stmt, 0),
                  let timestamp = ISO8601DateFormatter().date(from: String(cString: timestampStr)) else {
                continue
            }

            // Build git context if available
            var gitContext: GitContext?
            if let repoName = sqlite3_column_text(stmt, 2) {
                let branch: String
                if let branchPtr = sqlite3_column_text(stmt, 3) {
                    branch = String(cString: branchPtr)
                } else {
                    branch = "unknown"
                }

                gitContext = GitContext(
                    repoPath: "",
                    repoName: String(cString: repoName),
                    branch: branch,
                    commitsToday: Int(sqlite3_column_int(stmt, 4)),
                    uncommittedChanges: false,
                    hasCommitsToMain: false,
                    lastCommitTime: nil
                )
            }

            // Build system context
            let activeApp: String
            if let activeAppPtr = sqlite3_column_text(stmt, 5) {
                activeApp = String(cString: activeAppPtr)
            } else {
                activeApp = "unknown"
            }

            let bundleID: String
            if let bundleIDPtr = sqlite3_column_text(stmt, 6) {
                bundleID = String(cString: bundleIDPtr)
            } else {
                bundleID = "unknown"
            }

            let systemContext = SystemContext(
                activeApp: activeApp,
                bundleID: bundleID,
                isFocusApp: false,
                isCommunicationApp: false,
                appSwitchesLastHour: Int(sqlite3_column_int(stmt, 7)),
                runningApps: []
            )

            let snapshot = ContextSnapshot(
                timestamp: timestamp,
                git: gitContext,
                system: systemContext
            )

            snapshots.append(snapshot)
        }

        os_log("Retrieved %d snapshots for session %lld", log: databaseLog, type: .debug, snapshots.count, sessionId)
        return snapshots
    }

    // MARK: - Statistics

    /// Get total number of snapshots in database
    func getSnapshotCount() -> Int {
        let sql = "SELECT COUNT(*) FROM context_snapshots"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            os_log("Failed to prepare snapshot count query", log: databaseLog, type: .error)
            return 0
        }

        guard sqlite3_step(stmt) == SQLITE_ROW else {
            os_log("Failed to execute snapshot count query", log: databaseLog, type: .error)
            return 0
        }

        return Int(sqlite3_column_int(stmt, 0))
    }

    /// Get database file size in bytes
    func getDatabaseSize() -> Int64 {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: dbPath.path)
            if let fileSize = attributes[.size] as? Int64 {
                return fileSize
            }
        } catch {
            os_log("Failed to get database file size: %{public}s", log: databaseLog, type: .error, error.localizedDescription)
        }
        return 0
    }

    // MARK: - Cleanup

    /// Delete old data (keep last 30 days)
    func cleanupOldData() throws {
        os_log("Starting database cleanup (30-day retention)", log: databaseLog, type: .info)

        // Keep all sessions and interventions (for learning)
        // Only clean up snapshots (high volume)
        try execute("""
            DELETE FROM context_snapshots
            WHERE timestamp < datetime('now', '-30 days')
        """)

        // Vacuum to reclaim space
        try execute("VACUUM")

        os_log("Database cleanup complete", log: databaseLog, type: .info)
    }

    // MARK: - Verification

    /// Verify database health and schema integrity
    func verifyDatabase() throws -> DatabaseHealth {
        var health = DatabaseHealth()

        // Check foreign keys are enabled
        let fkQuery = "PRAGMA foreign_keys"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, fkQuery, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed("Failed to check foreign keys: \(String(cString: sqlite3_errmsg(db)))")
        }
        defer { sqlite3_finalize(stmt) }

        if sqlite3_step(stmt) == SQLITE_ROW {
            health.foreignKeysEnabled = sqlite3_column_int(stmt, 0) == 1
        }

        // Check table existence
        let tables = ["work_sessions", "context_snapshots", "interventions"]
        for table in tables {
            let tableQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
            var tableStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, tableQuery, -1, &tableStmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed("Failed to check table \(table): \(String(cString: sqlite3_errmsg(db)))")
            }
            defer { sqlite3_finalize(tableStmt) }

            sqlite3_bind_text(tableStmt, 1, table, -1, SQLITE_TRANSIENT)

            if sqlite3_step(tableStmt) == SQLITE_ROW {
                health.tablesPresent.append(table)
            } else {
                health.missingTables.append(table)
            }
        }

        // Check index existence
        let indexes = ["idx_snapshots_timestamp", "idx_snapshots_session", "idx_interventions_session"]
        for index in indexes {
            let indexQuery = "SELECT name FROM sqlite_master WHERE type='index' AND name=?"
            var indexStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, indexQuery, -1, &indexStmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed("Failed to check index \(index): \(String(cString: sqlite3_errmsg(db)))")
            }
            defer { sqlite3_finalize(indexStmt) }

            sqlite3_bind_text(indexStmt, 1, index, -1, SQLITE_TRANSIENT)

            if sqlite3_step(indexStmt) == SQLITE_ROW {
                health.indexesPresent.append(index)
            } else {
                health.missingIndexes.append(index)
            }
        }

        // Check integrity
        let integrityQuery = "PRAGMA integrity_check"
        var integrityStmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, integrityQuery, -1, &integrityStmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed("Failed to check integrity: \(String(cString: sqlite3_errmsg(db)))")
        }
        defer { sqlite3_finalize(integrityStmt) }

        if sqlite3_step(integrityStmt) == SQLITE_ROW {
            let result = String(cString: sqlite3_column_text(integrityStmt, 0))
            health.integrityCheck = result
        }

        return health
    }

    // MARK: - Helpers

    @discardableResult
    private func execute(_ sql: String) throws -> Bool {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed("Failed to prepare SQL: \(String(cString: sqlite3_errmsg(db)))\nSQL: \(sql)")
        }

        let result = sqlite3_step(stmt)
        guard result == SQLITE_DONE || result == SQLITE_ROW else {
            throw DatabaseError.executeFailed("Failed to execute SQL: \(String(cString: sqlite3_errmsg(db)))\nSQL: \(sql)")
        }

        return true
    }
}

// MARK: - Errors

enum DatabaseError: Error, LocalizedError {
    case notConnected
    case prepareFailed(String)
    case executeFailed(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Database not connected. Ensure the database file exists and is accessible."
        case .prepareFailed(let message):
            return "Failed to prepare SQL statement: \(message)"
        case .executeFailed(let message):
            return "Failed to execute SQL statement: \(message)"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .notConnected:
            return "Restart the application. If the problem persists, delete the database file and restart."
        case .prepareFailed, .executeFailed:
            return "Check the database file integrity. If corrupted, delete the database file and restart."
        }
    }
}

// MARK: - Database Health

/// Result of database verification
struct DatabaseHealth {
    var foreignKeysEnabled: Bool = false
    var tablesPresent: [String] = []
    var missingTables: [String] = []
    var indexesPresent: [String] = []
    var missingIndexes: [String] = []
    var integrityCheck: String = ""

    var isHealthy: Bool {
        return foreignKeysEnabled &&
               missingTables.isEmpty &&
               missingIndexes.isEmpty &&
               integrityCheck == "ok"
    }

    var summary: String {
        var lines: [String] = []
        lines.append("Database Health Check:")
        lines.append("  Foreign Keys: \(foreignKeysEnabled ? "✅" : "❌")")
        lines.append("  Tables: \(tablesPresent.count)/3 present")
        if !missingTables.isEmpty {
            lines.append("  Missing tables: \(missingTables.joined(separator: ", "))")
        }
        lines.append("  Indexes: \(indexesPresent.count)/3 present")
        if !missingIndexes.isEmpty {
            lines.append("  Missing indexes: \(missingIndexes.joined(separator: ", "))")
        }
        lines.append("  Integrity: \(integrityCheck)")
        return lines.joined(separator: "\n")
    }
}

// MARK: - SQLITE_TRANSIENT

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
