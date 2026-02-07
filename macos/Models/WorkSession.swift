import Foundation

/// Represents a continuous work session.
///
/// A session starts when 80HD launches or when Travis returns from
/// being away, and ends when 80HD quits or Travis is idle for
/// an extended period.
///
/// Sessions track:
/// - Total duration
/// - Focus quality
/// - Git activity summary
/// - Collaboration events
struct WorkSession: Codable, Identifiable {
    /// Database ID
    var id: Int64?

    /// When the session started
    let startedAt: Date

    /// When the session ended (nil if ongoing)
    var endedAt: Date?

    /// Primary focus during this session (repo name, project, etc.)
    var primaryFocus: String?

    /// Total git commits during this session
    var gitCommits: Int

    /// Total files changed during this session
    var filesChanged: Int

    /// Number of collaboration events (updates posted, messages sent)
    var collaborationEvents: Int

    /// Dominant work mode during this session
    var dominantWorkMode: WorkMode?

    /// Notes about this session (generated or manual)
    var notes: String?

    // MARK: - Computed Properties

    /// Duration of this session
    var duration: TimeInterval {
        let end = endedAt ?? Date()
        return end.timeIntervalSince(startedAt)
    }

    /// Duration as formatted string
    var durationString: String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    /// Whether this session is still active
    var isActive: Bool {
        return endedAt == nil
    }

    /// Work intensity (0.0 - 1.0) based on activity
    var workIntensity: Double {
        var intensity = 0.0

        // Factor in commits (up to 0.4)
        intensity += min(Double(gitCommits) * 0.05, 0.4)

        // Factor in files changed (up to 0.3)
        intensity += min(Double(filesChanged) / 50.0, 0.3)

        // Factor in duration (up to 0.3)
        let hours = duration / 3600
        if hours > 2 {
            intensity += 0.3
        } else {
            intensity += hours * 0.15
        }

        return min(intensity, 1.0)
    }

    // MARK: - Initializer

    init(
        id: Int64? = nil,
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        primaryFocus: String? = nil,
        gitCommits: Int = 0,
        filesChanged: Int = 0,
        collaborationEvents: Int = 0,
        dominantWorkMode: WorkMode? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.primaryFocus = primaryFocus
        self.gitCommits = gitCommits
        self.filesChanged = filesChanged
        self.collaborationEvents = collaborationEvents
        self.dominantWorkMode = dominantWorkMode
        self.notes = notes
    }
}

// MARK: - Work Session Summary

/// Summary of a work session for history display
struct WorkSessionSummary: Identifiable {
    let id: Int64
    let startedAt: Date
    let endedAt: Date?
    let snapshotCount: Int
    let repositories: [String]
    let totalCommits: Int
    let totalSwitches: Int
    let dominantMode: WorkMode

    var duration: TimeInterval {
        let end = endedAt ?? Date()
        return end.timeIntervalSince(startedAt)
    }

    var durationString: String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    var timeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        let start = formatter.string(from: startedAt)

        if let end = endedAt {
            let endStr = formatter.string(from: end)
            return "\(start) - \(endStr)"
        } else {
            return "\(start) - now"
        }
    }

    var dateString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: startedAt)
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(startedAt)
    }
}

// MARK: - Collaboration Debt

/// Tracks collaboration debt level
enum CollaborationDebtLevel: String, Codable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"

    var color: SwiftUI.Color {
        switch self {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }

    /// Calculate debt level from hours and intensity
    static func calculate(hoursSinceUpdate: Double, workIntensity: Double) -> CollaborationDebtLevel {
        let score = hoursSinceUpdate * workIntensity

        switch score {
        case 0..<24:
            return .low
        case 24..<48:
            return .medium
        default:
            return .high
        }
    }
}

import SwiftUI
