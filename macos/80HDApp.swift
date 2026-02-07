import SwiftUI

/// 80HD - ADHD Collaboration Agent
///
/// A native macOS menu bar app that monitors work context, learns ADHD patterns,
/// and proactively suggests collaboration touchpoints with minimal friction.
///
/// Mission: Make collaboration easier than cave mode.
@main
struct HD80App: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // Menu bar apps don't have a main window - we use Settings scene
        // to satisfy SwiftUI's App protocol requirement
        Settings {
            SettingsView()
        }
    }
}

/// Placeholder settings view - will be expanded in later phases
struct SettingsView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("80HD Settings")
                .font(.title)

            Text("Coming soon...")
                .foregroundColor(.secondary)
        }
        .frame(width: 400, height: 300)
        .padding()
    }
}
