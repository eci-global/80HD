import SwiftUI

/// Menu bar popover view (alternative to NSMenu).
///
/// This view can be used if we want a richer menu bar experience
/// than NSMenu provides. For Phase 1, we're using NSMenu directly
/// in AppDelegate, but this is here for future enhancement.
struct MenuBarView: View {
    @ObservedObject var appState = AppState.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Status header
            statusHeader

            Divider()

            // Quick stats
            statsSection

            Divider()

            // Quick actions
            actionsSection
        }
        .padding()
        .frame(width: 280)
    }

    private var statusHeader: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(.accentColor)

            VStack(alignment: .leading) {
                Text("80HD")
                    .font(.headline)

                Text(appState.workMode.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Work mode indicator
            Circle()
                .fill(appState.workMode.color)
                .frame(width: 10, height: 10)
        }
    }

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            StatRow(
                icon: "clock",
                label: "Focus time",
                value: appState.focusDurationString
            )

            StatRow(
                icon: "arrow.triangle.branch",
                label: "Commits today",
                value: "\(appState.commitsToday)"
            )

            StatRow(
                icon: "bubble.left.and.bubble.right",
                label: "Collaboration debt",
                value: appState.collaborationDebt.rawValue,
                valueColor: appState.collaborationDebt.color
            )
        }
    }

    private var actionsSection: some View {
        VStack(spacing: 8) {
            Button(action: { /* Open chat */ }) {
                Label("Chat with 80HD", systemImage: "message")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            Button(action: { /* Open settings */ }) {
                Label("Settings", systemImage: "gear")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            Divider()

            Button(action: { NSApp.terminate(nil) }) {
                Label("Quit", systemImage: "power")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
        }
    }
}

/// A single stat row in the menu bar view
struct StatRow: View {
    let icon: String
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Image(systemName: icon)
                .frame(width: 20)
                .foregroundColor(.secondary)

            Text(label)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .fontWeight(.medium)
                .foregroundColor(valueColor)
        }
        .font(.callout)
    }
}

// MARK: - Preview

#Preview {
    MenuBarView()
}
