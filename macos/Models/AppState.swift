import SwiftUI
import Combine

/// Global application state - single source of truth.
///
/// All UI components observe this state for updates.
/// State is updated by monitors and the main app delegate.
@MainActor
class AppState: ObservableObject {
    /// Shared singleton instance
    static let shared = AppState()

    // MARK: - Published State

    /// Current context snapshot
    @Published var currentContext: ContextSnapshot?

    /// Current work session
    @Published var currentSession: WorkSession?

    /// Current work mode
    @Published var workMode: WorkMode = .unknown

    /// Current collaboration debt level
    @Published var collaborationDebt: CollaborationDebtLevel = .low

    /// Hours since last visible update
    @Published var hoursSinceLastUpdate: Double = 0

    /// Number of commits today
    @Published var commitsToday: Int = 0

    /// Active interventions waiting for response
    @Published var pendingInterventions: [Intervention] = []

    /// Whether monitoring is active
    @Published var isMonitoring: Bool = true

    /// Focus start time (for duration tracking)
    @Published var focusStartTime: Date?

    // MARK: - Computed Properties

    /// Focus duration as formatted string
    var focusDurationString: String {
        guard let start = focusStartTime else { return "0h 0m" }

        let duration = Date().timeIntervalSince(start)
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60

        return "\(hours)h \(minutes)m"
    }

    /// Whether we're in sacred focus time (9am-12pm)
    var isInSacredTime: Bool {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour >= 9 && hour < 12
    }

    /// Whether we're in collaborative time (2pm+)
    var isInCollaborativeTime: Bool {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour >= 14
    }

    // MARK: - Initialization

    private init() {
        focusStartTime = Date()
    }

    // MARK: - State Updates

    /// Update state from a new context snapshot
    func update(from snapshot: ContextSnapshot) {
        currentContext = snapshot
        workMode = snapshot.workMode

        // Update commits count
        if let git = snapshot.git {
            commitsToday = git.commitsToday
        }

        // Update collaboration debt
        updateCollaborationDebt()
    }

    /// Start a new work session
    func startSession(_ session: WorkSession) {
        currentSession = session
        focusStartTime = session.startedAt
    }

    /// End current session
    func endSession() {
        if var session = currentSession {
            session.endedAt = Date()
            currentSession = session
        }
    }

    /// Reset focus timer
    func resetFocusTimer() {
        focusStartTime = Date()
    }

    // MARK: - Private Methods

    private func updateCollaborationDebt() {
        // Calculate based on hours since last update and work intensity
        let intensity = currentSession?.workIntensity ?? 0.5
        collaborationDebt = CollaborationDebtLevel.calculate(
            hoursSinceUpdate: hoursSinceLastUpdate,
            workIntensity: intensity
        )
    }
}

// MARK: - Intervention Model

/// An intervention (nudge) from 80HD
struct Intervention: Identifiable, Codable {
    let id: UUID
    let type: InterventionType
    let message: String
    let createdAt: Date
    var respondedAt: Date?
    var response: InterventionResponse?
    var draftContent: String?

    init(
        type: InterventionType,
        message: String,
        draftContent: String? = nil
    ) {
        self.id = UUID()
        self.type = type
        self.message = message
        self.createdAt = Date()
        self.draftContent = draftContent
    }
}

/// User response to an intervention
enum InterventionResponse: String, Codable {
    case approved = "approved"
    case dismissed = "dismissed"
    case snoozed = "snoozed"
}
