import SwiftUI
import AppKit
import Combine
import os.log

// MARK: - Logging

private let lifecycleLog = OSLog(subsystem: "com.80hd.app", category: "lifecycle")
private let uiLog = OSLog(subsystem: "com.80hd.app", category: "ui")

/// AppDelegate handles the menu bar setup and app lifecycle.
///
/// Key responsibilities:
/// - Create and manage the menu bar status item
/// - Open/close windows (chat, settings)
/// - Coordinate app launch and termination
///
/// Note: Monitoring is delegated to MonitoringCoordinator
class AppDelegate: NSObject, NSApplicationDelegate {

    // MARK: - Properties

    /// The menu bar status item (always visible)
    private var statusItem: NSStatusItem!

    /// Reference to the dashboard window (created on demand)
    private var dashboardWindow: NSWindow?

    /// Monitoring coordinator
    private var coordinator: MonitoringCoordinator?

    /// Tracks focus duration for menu display
    private var focusStartTime: Date?

    /// Timer for updating sacred time status
    private var sacredTimeTimer: Timer?

    /// Timer for updating database stats
    private var statsTimer: Timer?

    /// Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - App Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        os_log("Application launching", log: lifecycleLog, type: .info)

        setupMenuBar()

        // Initialize coordinator on main actor
        Task { @MainActor in
            startSacredTimeTimer()
            startDatabaseStatsTimer()
            coordinator = MonitoringCoordinator()
            observeAppState()

            // Start monitoring with error handling
            do {
                try coordinator?.startMonitoring()
                focusStartTime = Date()
                os_log("80HD launched successfully", log: lifecycleLog, type: .info)
            } catch {
                os_log("Failed to start monitoring: %{public}s", log: lifecycleLog, type: .fault, error.localizedDescription)

                // Show alert to user
                let alert = NSAlert()
                alert.messageText = "Failed to Start Monitoring"
                alert.informativeText = error.localizedDescription
                if let recoverySuggestion = (error as? LocalizedError)?.recoverySuggestion {
                    alert.informativeText += "\n\n\(recoverySuggestion)"
                }
                alert.alertStyle = .critical
                alert.addButton(withTitle: "Quit")
                alert.runModal()

                os_log("Terminating app due to startup failure", log: lifecycleLog, type: .fault)
                NSApplication.shared.terminate(nil)
            }
        }
    }

    // MARK: - State Observation

    @MainActor
    private func observeAppState() {
        // Subscribe to app state changes to update menu bar
        AppState.shared.$currentContext
            .sink { [weak self] snapshot in
                if let snapshot = snapshot {
                    self?.updateMenuBar(with: snapshot)
                }
            }
            .store(in: &cancellables)
    }

    func applicationWillTerminate(_ notification: Notification) {
        os_log("Application terminating", log: lifecycleLog, type: .info)
        coordinator?.stopMonitoring()
        sacredTimeTimer?.invalidate()
        statsTimer?.invalidate()
        os_log("80HD shutdown complete", log: lifecycleLog, type: .info)
    }

    // MARK: - Menu Bar Setup

    private func setupMenuBar() {
        os_log("Setting up menu bar", log: lifecycleLog, type: .debug)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            // Using brain icon to represent 80HD
            button.image = NSImage(systemSymbolName: "brain.head.profile", accessibilityDescription: "80HD")
        }

        statusItem.menu = buildMenu()
        os_log("Menu bar setup complete", log: lifecycleLog, type: .debug)
    }

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()

        // Status lines (will be updated dynamically)
        let focusItem = NSMenuItem(title: "Deep work (0h 0m)", action: nil, keyEquivalent: "")
        focusItem.tag = 100 // Tag for updating later
        menu.addItem(focusItem)

        let debtItem = NSMenuItem(title: "Collaboration debt: LOW", action: nil, keyEquivalent: "")
        debtItem.tag = 101
        menu.addItem(debtItem)

        menu.addItem(NSMenuItem.separator())

        // Sacred Time indicator
        let sacredTimeItem = NSMenuItem(title: "Sacred time: Not active", action: nil, keyEquivalent: "")
        sacredTimeItem.tag = 102
        menu.addItem(sacredTimeItem)

        // Sacred Time explanation (disabled, educational)
        let explainItem = NSMenuItem(title: "9 AM - 12 PM is protected focus time", action: nil, keyEquivalent: "")
        explainItem.isEnabled = false
        explainItem.tag = 103
        menu.addItem(explainItem)

        menu.addItem(NSMenuItem.separator())

        // Database stats (will be updated dynamically)
        let snapshotCountItem = NSMenuItem(title: "Snapshots: ...", action: nil, keyEquivalent: "")
        snapshotCountItem.tag = 104
        menu.addItem(snapshotCountItem)

        let dbSizeItem = NSMenuItem(title: "Database: ...", action: nil, keyEquivalent: "")
        dbSizeItem.tag = 105
        menu.addItem(dbSizeItem)

        menu.addItem(NSMenuItem.separator())

        // Actions
        let dashboardItem = NSMenuItem(title: "Dashboard", action: #selector(openDashboard), keyEquivalent: "d")
        dashboardItem.target = self
        menu.addItem(dashboardItem)

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(openSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(NSMenuItem.separator())

        // Data management
        let clearDataItem = NSMenuItem(title: "Clear All Data...", action: #selector(clearAllData), keyEquivalent: "")
        clearDataItem.target = self
        menu.addItem(clearDataItem)

        menu.addItem(NSMenuItem.separator())

        // Quit
        let quitItem = NSMenuItem(title: "Quit 80HD", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quitItem)

        return menu
    }

    // MARK: - Menu Actions

    @objc private func openDashboard() {
        os_log("Opening dashboard window", log: uiLog, type: .info)

        if dashboardWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered,
                defer: false
            )
            window.title = "80HD - The Observing Eye"
            window.contentView = NSHostingView(rootView: ObservingEyeDashboard())
            window.center()
            window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 700, height: 500)

            dashboardWindow = window
            os_log("Dashboard window created", log: uiLog, type: .debug)
        }

        dashboardWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func openSettings() {
        // Open the Settings scene
        if #available(macOS 14.0, *) {
            NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
        } else {
            NSApp.sendAction(Selector(("showPreferencesWindow:")), to: nil, from: nil)
        }
    }

    @MainActor
    @objc private func clearAllData() {
        os_log("Clear all data requested", log: lifecycleLog, type: .info)

        let alert = NSAlert()
        alert.messageText = "Clear All Data?"
        alert.informativeText = "This will delete all work sessions, snapshots, and history. The app will restart monitoring from scratch.\n\nThis action cannot be undone."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Clear All Data")
        alert.addButton(withTitle: "Cancel")

        let response = alert.runModal()

        guard response == .alertFirstButtonReturn else {
            os_log("Clear all data cancelled", log: lifecycleLog, type: .info)
            return
        }

        // Stop monitoring
        coordinator?.stopMonitoring()

        // Delete database file
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("80HD")

        let dbPath = appSupport.appendingPathComponent("database.sqlite")

        do {
            try FileManager.default.removeItem(at: dbPath)
            os_log("Database deleted successfully", log: lifecycleLog, type: .info)

            // Restart monitoring
            Task { @MainActor in
                coordinator = MonitoringCoordinator()
                try? coordinator?.startMonitoring()
                focusStartTime = Date()
                os_log("Monitoring restarted with fresh database", log: lifecycleLog, type: .info)
            }

            // Show success message
            let success = NSAlert()
            success.messageText = "Data Cleared"
            success.informativeText = "All data has been deleted. Monitoring restarted with a fresh database."
            success.alertStyle = .informational
            success.addButton(withTitle: "OK")
            success.runModal()

        } catch {
            os_log("Failed to delete database: %{public}s", log: lifecycleLog, type: .error, error.localizedDescription)

            let errorAlert = NSAlert()
            errorAlert.messageText = "Clear Data Failed"
            errorAlert.informativeText = "Could not delete database file: \(error.localizedDescription)"
            errorAlert.alertStyle = .critical
            errorAlert.addButton(withTitle: "OK")
            errorAlert.runModal()
        }
    }

    // MARK: - Menu Updates

    @MainActor
    private func updateMenuBar(with snapshot: ContextSnapshot) {
        guard let menu = statusItem.menu else {
            os_log("Menu not available for update", log: uiLog, type: .debug)
            return
        }

        // Update focus duration
        if let focusItem = menu.item(withTag: 100) {
            let duration = focusDurationString()
            let mode = snapshot.workMode.description
            focusItem.title = "\(mode) (\(duration))"
            os_log("Updated focus item: %{public}s", log: uiLog, type: .debug, focusItem.title)
        }

        // Update collaboration debt
        if let debtItem = menu.item(withTag: 101) {
            let debt = AppState.shared.collaborationDebt
            debtItem.title = "Collaboration debt: \(debt.rawValue)"
        }

        // Update database stats
        updateDatabaseStats()
    }

    @MainActor
    private func updateDatabaseStats() {
        guard let menu = statusItem.menu else { return }

        let snapshotCount = DatabaseManager.shared.getSnapshotCount()
        let dbSize = DatabaseManager.shared.getDatabaseSize()

        // Update snapshot count (tag 104)
        if let snapshotItem = menu.item(withTag: 104) {
            snapshotItem.title = "Snapshots: \(snapshotCount)"
        }

        // Update database size (tag 105)
        if let dbSizeItem = menu.item(withTag: 105) {
            dbSizeItem.title = "Database: \(formatBytes(dbSize))"
        }
    }

    // MARK: - Sacred Time Management

    @MainActor
    private func startSacredTimeTimer() {
        // Update every minute to keep sacred time status current
        let timer = Timer(timeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateSacredTimeStatus()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        sacredTimeTimer = timer

        // Update immediately
        updateSacredTimeStatus()
    }

    @MainActor
    private func startDatabaseStatsTimer() {
        // Update database stats every 5 minutes
        let timer = Timer(timeInterval: 300.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateDatabaseStats()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        statsTimer = timer

        // Update immediately
        updateDatabaseStats()
    }

    @MainActor
    private func updateSacredTimeStatus() {
        guard let menu = statusItem.menu else { return }

        let status = getSacredTimeStatus()

        // Update sacred time indicator (tag 102)
        if let sacredTimeItem = menu.item(withTag: 102) {
            sacredTimeItem.title = status.title
        }

        // Update menu bar button title if in sacred time
        if let button = statusItem.button {
            if status.isActive {
                button.title = " \(status.indicator)"
            } else {
                button.title = ""
            }
        }
    }

    private func getSacredTimeStatus() -> (isActive: Bool, title: String, indicator: String) {
        let calendar = Calendar.current
        let now = Date()
        let hour = calendar.component(.hour, from: now)

        // Sacred time is 9 AM - 12 PM
        let isActive = hour >= 9 && hour < 12

        if isActive {
            // Calculate time remaining using proper date arithmetic
            var endComponents = calendar.dateComponents([.year, .month, .day], from: now)
            endComponents.hour = 12
            endComponents.minute = 0

            guard let endTime = calendar.date(from: endComponents) else {
                return (isActive: true, title: "🧘 Sacred time: Active", indicator: "🧘")
            }

            let components = calendar.dateComponents([.hour, .minute], from: now, to: endTime)
            let hoursRemaining = components.hour ?? 0
            let minutesRemaining = components.minute ?? 0

            let timeString: String
            if hoursRemaining > 0 {
                timeString = "\(hoursRemaining)h \(minutesRemaining)m remaining"
            } else {
                timeString = "\(minutesRemaining)m remaining"
            }

            return (
                isActive: true,
                title: "🧘 Sacred time: Active (\(timeString))",
                indicator: "🧘"
            )
        } else {
            // Calculate time until sacred time starts (if before 9 AM)
            if hour < 9 {
                var startComponents = calendar.dateComponents([.year, .month, .day], from: now)
                startComponents.hour = 9
                startComponents.minute = 0

                guard let startTime = calendar.date(from: startComponents) else {
                    return (isActive: false, title: "Sacred time: Not active", indicator: "")
                }

                let components = calendar.dateComponents([.hour, .minute], from: now, to: startTime)
                let hoursUntilStart = components.hour ?? 0
                let minsUntilStart = components.minute ?? 0

                let timeString: String
                if hoursUntilStart > 0 {
                    timeString = " (starts in \(hoursUntilStart)h \(minsUntilStart)m)"
                } else {
                    timeString = " (starts in \(minsUntilStart)m)"
                }

                return (
                    isActive: false,
                    title: "Sacred time: Not active\(timeString)",
                    indicator: ""
                )
            } else {
                // After 12 PM - show when it ended
                return (
                    isActive: false,
                    title: "Sacred time: Not active (ended at 12 PM)",
                    indicator: ""
                )
            }
        }
    }

    // MARK: - Helpers

    private func focusDurationString() -> String {
        guard let start = focusStartTime else { return "0h 0m" }

        let duration = Date().timeIntervalSince(start)
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60

        return "\(hours)h \(minutes)m"
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let kb = Double(bytes) / 1024.0
        let mb = kb / 1024.0

        if mb >= 1.0 {
            return String(format: "%.1f MB", mb)
        } else if kb >= 1.0 {
            return String(format: "%.1f KB", kb)
        } else {
            return "\(bytes) bytes"
        }
    }
}
