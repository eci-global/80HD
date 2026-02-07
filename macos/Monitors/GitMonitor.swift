import Foundation

/// Monitors Git repository activity.
///
/// Tracks:
/// - Current repository and branch
/// - Commits today (by Travis)
/// - Uncommitted changes
/// - Whether commits are going to main (pressure signal)
///
/// Privacy: Only captures metadata (counts, branch names), never commit content or diffs.
class GitMonitor: ContextMonitor {
    let name = "git"

    /// Known repository paths to check
    /// TODO: Make this configurable in settings
    private var repoPaths: [String] = []

    /// Cache of discovered repositories
    private var discoveredRepos: [String] = []

    /// Last known active repository
    private var lastActiveRepo: String?

    var isAvailable: Bool {
        // Git is available if we can find at least one repo
        return !discoverRepositories().isEmpty
    }

    init() {
        // Initialize with common paths
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        repoPaths = [
            "\(home)/Projects",
            "\(home)/Code",
            "\(home)/code",
            "\(home)/src",
            "\(home)/Developer"
        ]
    }

    func capture() async -> MonitorResult? {
        guard let context = getCurrentState() else {
            return nil
        }
        return .git(context)
    }

    /// Get current Git state
    func getCurrentState() -> GitContext? {
        // Find active repository (most recently modified)
        let repos = discoverRepositories()
        guard let activeRepo = findMostRecentlyActiveRepo(repos) else {
            return nil
        }

        lastActiveRepo = activeRepo

        return GitContext(
            repoPath: activeRepo,
            repoName: URL(fileURLWithPath: activeRepo).lastPathComponent,
            branch: getCurrentBranch(activeRepo),
            commitsToday: getCommitsToday(activeRepo),
            uncommittedChanges: hasUncommittedChanges(activeRepo),
            hasCommitsToMain: hasRecentCommitsToMain(activeRepo),
            lastCommitTime: getLastCommitTime(activeRepo)
        )
    }

    // MARK: - Repository Discovery

    private func discoverRepositories() -> [String] {
        var repos: [String] = []
        let fileManager = FileManager.default

        for basePath in repoPaths {
            guard fileManager.fileExists(atPath: basePath) else { continue }

            // Check if base path itself is a repo
            if fileManager.fileExists(atPath: "\(basePath)/.git") {
                repos.append(basePath)
            }

            // Check immediate subdirectories
            if let contents = try? fileManager.contentsOfDirectory(atPath: basePath) {
                for item in contents {
                    let itemPath = "\(basePath)/\(item)"
                    if fileManager.fileExists(atPath: "\(itemPath)/.git") {
                        repos.append(itemPath)
                    }
                }
            }
        }

        discoveredRepos = repos
        return repos
    }

    private func findMostRecentlyActiveRepo(_ repos: [String]) -> String? {
        // Find repo with most recent git activity
        var mostRecent: (path: String, date: Date)?

        for repo in repos {
            if let date = getLastGitActivityDate(repo) {
                if mostRecent == nil || date > mostRecent!.date {
                    mostRecent = (repo, date)
                }
            }
        }

        return mostRecent?.path ?? repos.first
    }

    private func getLastGitActivityDate(_ repoPath: String) -> Date? {
        let gitPath = "\(repoPath)/.git"
        let fileManager = FileManager.default

        // Check various git files that change with activity
        let filesToCheck = [
            "\(gitPath)/index",
            "\(gitPath)/HEAD",
            "\(gitPath)/FETCH_HEAD"
        ]

        var latestDate: Date?

        for file in filesToCheck {
            if let attrs = try? fileManager.attributesOfItem(atPath: file),
               let modDate = attrs[.modificationDate] as? Date {
                if latestDate == nil || modDate > latestDate! {
                    latestDate = modDate
                }
            }
        }

        return latestDate
    }

    // MARK: - Git Commands

    private func getCurrentBranch(_ repoPath: String) -> String {
        let headPath = "\(repoPath)/.git/HEAD"

        guard let content = try? String(contentsOfFile: headPath, encoding: .utf8) else {
            return "unknown"
        }

        // Parse "ref: refs/heads/branch-name"
        if content.hasPrefix("ref: refs/heads/") {
            return content
                .replacingOccurrences(of: "ref: refs/heads/", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // Detached HEAD state
        return "detached"
    }

    private func getCommitsToday(_ repoPath: String) -> Int {
        // Get commits since midnight by Travis
        // Note: Using "Travis" as author - should match git config
        let output = runGitCommand(
            in: repoPath,
            args: ["log", "--since=midnight", "--oneline", "--author=Travis"]
        )

        let lines = output.components(separatedBy: "\n").filter { !$0.isEmpty }
        return lines.count
    }

    private func hasUncommittedChanges(_ repoPath: String) -> Bool {
        let output = runGitCommand(in: repoPath, args: ["status", "--porcelain"])
        return !output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func hasRecentCommitsToMain(_ repoPath: String) -> Bool {
        // Check if there are commits to main/master in the last hour
        // This is a pressure signal - bypassing feature branch workflow
        let output = runGitCommand(
            in: repoPath,
            args: ["log", "main", "--since=1 hour ago", "--oneline", "--author=Travis"]
        )

        if output.isEmpty {
            // Try "master" if "main" doesn't exist
            let masterOutput = runGitCommand(
                in: repoPath,
                args: ["log", "master", "--since=1 hour ago", "--oneline", "--author=Travis"]
            )
            return !masterOutput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }

        return !output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func getLastCommitTime(_ repoPath: String) -> Date? {
        let output = runGitCommand(
            in: repoPath,
            args: ["log", "-1", "--format=%ct", "--author=Travis"]
        )

        guard let timestamp = Double(output.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        return Date(timeIntervalSince1970: timestamp)
    }

    // MARK: - Helpers

    private func runGitCommand(in repoPath: String, args: [String]) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = ["-C", repoPath] + args
        process.environment = ["GIT_TERMINAL_PROMPT": "0"] // Disable prompts

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8) ?? ""
        } catch {
            return ""
        }
    }
}

/// Git repository context
struct GitContext: Codable, Equatable {
    let repoPath: String
    let repoName: String
    let branch: String
    let commitsToday: Int
    let uncommittedChanges: Bool
    let hasCommitsToMain: Bool  // Pressure signal
    let lastCommitTime: Date?

    /// Time since last commit in hours
    var hoursSinceLastCommit: Double? {
        guard let lastCommit = lastCommitTime else { return nil }
        return Date().timeIntervalSince(lastCommit) / 3600
    }

    /// Whether we're on a feature branch (not main/master)
    var isOnFeatureBranch: Bool {
        return branch != "main" && branch != "master"
    }
}
