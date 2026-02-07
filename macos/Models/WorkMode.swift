import SwiftUI

/// Work modes that 80HD detects from context signals.
///
/// Each mode has different intervention strategies:
/// - Deep Focus: Don't interrupt, monitor silently
/// - Struggling: Offer help, suggest posting question
/// - Pressure: Offer to handle comms, don't interrupt work
/// - Communication: No nudges, collaboration already happening
/// - Normal: Standard monitoring, nudges okay if appropriate
/// - Unknown: Not enough data to determine
enum WorkMode: String, Codable {
    case deepFocus = "deep_focus"
    case struggling = "struggling"
    case pressure = "pressure"
    case communication = "communication"
    case normal = "normal"
    case unknown = "unknown"

    // MARK: - Display Properties

    var description: String {
        switch self {
        case .deepFocus: return "Deep Focus"
        case .struggling: return "Struggling"
        case .pressure: return "Pressure Mode"
        case .communication: return "Communicating"
        case .normal: return "Normal"
        case .unknown: return "Unknown"
        }
    }

    var color: Color {
        switch self {
        case .deepFocus: return .blue
        case .struggling: return .orange
        case .pressure: return .red
        case .communication: return .green
        case .normal: return .secondary
        case .unknown: return .gray
        }
    }

    var icon: String {
        switch self {
        case .deepFocus: return "brain"
        case .struggling: return "questionmark.circle"
        case .pressure: return "exclamationmark.triangle"
        case .communication: return "bubble.left.and.bubble.right"
        case .normal: return "checkmark.circle"
        case .unknown: return "questionmark"
        }
    }

    // MARK: - Intervention Strategy

    /// Whether interventions are allowed in this mode
    var allowsIntervention: Bool {
        switch self {
        case .deepFocus: return false  // Never interrupt deep focus
        case .struggling: return true  // Help is welcome
        case .pressure: return true   // Offer to handle comms
        case .communication: return false  // Already collaborating
        case .normal: return true
        case .unknown: return false
        }
    }

    /// The type of intervention appropriate for this mode
    var interventionType: InterventionType? {
        switch self {
        case .deepFocus: return nil
        case .struggling: return .helpOffer
        case .pressure: return .commsHandling
        case .communication: return nil
        case .normal: return .updateSuggestion
        case .unknown: return nil
        }
    }

    // MARK: - Detection Logic

    /// Detect work mode from a context snapshot
    static func detect(from snapshot: ContextSnapshot) -> WorkMode {
        // Check for communication mode first
        if snapshot.isCollaborating {
            return .communication
        }

        // Check for pressure signals (2+ signals = pressure mode)
        if snapshot.pressureSignals.count >= 2 {
            return .pressure
        }

        // Check for struggle signals (2+ signals = struggling)
        if snapshot.struggleSignals.count >= 2 {
            return .struggling
        }

        // Check for deep focus
        if isDeepFocus(snapshot) {
            return .deepFocus
        }

        // Default to normal if we have enough data
        if snapshot.git != nil || snapshot.system.isFocusApp {
            return .normal
        }

        return .unknown
    }

    /// Detect deep focus state
    private static func isDeepFocus(_ snapshot: ContextSnapshot) -> Bool {
        // Conditions for deep focus:
        // 1. In a focus app (IDE, terminal, etc.)
        // 2. Low app switching
        // 3. Not checking communications

        guard snapshot.system.isFocusApp else { return false }
        guard !snapshot.system.isHighSwitchingRate else { return false }

        // If we have git data, check for steady progress
        if let git = snapshot.git {
            // Active coding with commits or uncommitted changes
            if git.uncommittedChanges || git.commitsToday > 0 {
                return true
            }
        }

        // In focus app with low switching = likely deep focus
        return snapshot.system.appSwitchesLastHour < 10
    }
}

// MARK: - Intervention Types

/// Types of interventions 80HD can make
enum InterventionType: String, Codable {
    /// Suggest posting an update about progress
    case updateSuggestion = "update_suggestion"

    /// Offer help when struggling is detected
    case helpOffer = "help_offer"

    /// Offer to handle communications during pressure mode
    case commsHandling = "comms_handling"

    /// Reminder for upcoming meeting/1:1
    case meetingPrep = "meeting_prep"

    var description: String {
        switch self {
        case .updateSuggestion: return "Update Suggestion"
        case .helpOffer: return "Help Offer"
        case .commsHandling: return "Handle Comms"
        case .meetingPrep: return "Meeting Prep"
        }
    }
}
