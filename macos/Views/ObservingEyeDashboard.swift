import SwiftUI

/// The Observing Eye Dashboard - "Finance tracker for focus"
///
/// Shows where Travis's attention goes without judgment.
/// Three tabs:
/// - Today's Attention: Timeline view of work modes throughout the day
/// - Current Session: Live stats for the active session
/// - History: Past sessions (last 7 days)
///
/// This is v0.0.1 - pure observation, no AI, no interventions.
struct ObservingEyeDashboard: View {
    @StateObject private var appState = AppState.shared
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            // Tab selector
            tabSelector

            Divider()

            // Tab content
            TabView(selection: $selectedTab) {
                TodaysAttentionTab()
                    .tag(0)

                CurrentSessionTab()
                    .tag(1)

                HistoryTab()
                    .tag(2)
            }
            .tabViewStyle(.automatic)
        }
        .frame(minWidth: 700, minHeight: 500)
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            Image(systemName: "eye")
                .font(.title2)
                .foregroundColor(.accentColor)

            VStack(alignment: .leading, spacing: 2) {
                Text("The Observing Eye")
                    .font(.headline)

                Text("Where did your attention go?")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Current work mode indicator
            if let context = appState.currentContext {
                WorkModeBadge(mode: context.workMode)
            }

            // Sacred time indicator
            if appState.isInSacredTime {
                HStack(spacing: 4) {
                    Image(systemName: "shield.fill")
                        .foregroundColor(.blue)
                    Text("Sacred Time")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(6)
            }
        }
        .padding()
    }

    // MARK: - Tab Selector

    private var tabSelector: some View {
        HStack(spacing: 0) {
            TabButton(title: "Today's Attention", index: 0, selectedIndex: $selectedTab)
            TabButton(title: "Current Session", index: 1, selectedIndex: $selectedTab)
            TabButton(title: "History", index: 2, selectedIndex: $selectedTab)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}

// MARK: - Tab Button

struct TabButton: View {
    let title: String
    let index: Int
    @Binding var selectedIndex: Int

    var isSelected: Bool {
        selectedIndex == index
    }

    var body: some View {
        Button(action: { selectedIndex = index }) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                .foregroundColor(isSelected ? .primary : .secondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(
                    isSelected ? Color.accentColor.opacity(0.1) : Color.clear
                )
                .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Work Mode Badge

struct WorkModeBadge: View {
    let mode: WorkMode

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: mode.icon)
                .font(.caption)
            Text(mode.description)
                .font(.caption)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(mode.color)
        .cornerRadius(8)
    }
}

// MARK: - Tab 1: Today's Attention

/// Timeline view showing where attention went throughout the day
struct TodaysAttentionTab: View {
    @StateObject private var viewModel = TimelineViewModel()
    @StateObject private var appState = AppState.shared

    var body: some View {
        VStack(spacing: 16) {
            // Header stats
            timelineHeader

            Divider()

            // Timeline visualization
            if viewModel.segments.isEmpty {
                emptyState
            } else {
                ScrollView {
                    VStack(spacing: 20) {
                        timelineChart
                        segmentDetails
                    }
                    .padding()
                }
            }
        }
        .padding()
        .onAppear {
            viewModel.loadTodaysSnapshots()
        }
        .onChange(of: appState.currentContext) {
            // Refresh timeline when new snapshot arrives
            viewModel.loadTodaysSnapshots()
        }
    }

    // MARK: - Header

    private var timelineHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Today's Attention")
                    .font(.title3)
                    .fontWeight(.semibold)

                Text("\(viewModel.segments.count) work periods tracked")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Time range
            Text("\(viewModel.startTime) → \(viewModel.currentTime)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Timeline Chart

    private var timelineChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Work Mode Timeline")
                .font(.caption)
                .foregroundColor(.secondary)

            // Horizontal timeline bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background with sacred time zones
                    timelineBackground(width: geometry.size.width)
                        .zIndex(0)

                    // Work mode segments
                    HStack(spacing: 0) {
                        ForEach(viewModel.segments) { segment in
                            TimelineSegment(
                                segment: segment,
                                totalWidth: geometry.size.width,
                                startOfDay: viewModel.startOfDay,
                                endOfDay: viewModel.endOfDay
                            )
                        }
                    }
                    .zIndex(1)

                    // Sacred time boundary markers (always on top)
                    sacredTimeBoundaryMarkers(width: geometry.size.width)
                        .zIndex(2)
                }
            }
            .frame(height: 75)
            .cornerRadius(8)

            // Time labels
            timeLabels
        }
    }

    private func timelineBackground(width: CGFloat) -> some View {
        HStack(spacing: 0) {
            // House time (8-9 AM) - gray
            Rectangle()
                .fill(Color.gray.opacity(0.1))
                .frame(width: width * 0.1) // 1 hour of 10 hour day

            // Sacred time (9-12 PM) - enhanced blue with border and tooltip
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [Color.blue.opacity(0.15), Color.blue.opacity(0.25)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    Rectangle()
                        .stroke(Color.blue.opacity(0.4), lineWidth: 2)
                )
                .frame(width: width * 0.3) // 3 hours
                .help("🧘 Sacred Time (9 AM - 12 PM)\nThis is your protected focus window. No interruptions.")

            // Tapering time (12-2 PM) - orange
            Rectangle()
                .fill(Color.orange.opacity(0.05))
                .frame(width: width * 0.2) // 2 hours

            // Collaborative time (2-6 PM) - green
            Rectangle()
                .fill(Color.green.opacity(0.05))
                .frame(width: width * 0.4) // 4 hours
        }
    }

    private func sacredTimeBoundaryMarkers(width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            // 9 AM marker (start of sacred time)
            VStack(spacing: 2) {
                Rectangle()
                    .fill(Color.blue.opacity(0.6))
                    .frame(width: 2)

                Text("🧘 9 AM")
                    .font(.caption2)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(4)
                    .offset(y: -6)
            }
            .frame(maxHeight: .infinity)
            .offset(x: width * 0.1) // 9 AM position

            // 12 PM marker (end of sacred time)
            VStack(spacing: 2) {
                Rectangle()
                    .fill(Color.blue.opacity(0.6))
                    .frame(width: 2)

                Text("12 PM")
                    .font(.caption2)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(4)
                    .offset(y: -6)
            }
            .frame(maxHeight: .infinity)
            .offset(x: width * 0.4) // 12 PM position (10% + 30%)
        }
    }

    private var timeLabels: some View {
        HStack {
            Text("8 AM")
                .font(.caption2)
                .foregroundColor(.secondary)

            Spacer()

            Text("12 PM")
                .font(.caption2)
                .foregroundColor(.secondary)

            Spacer()

            Text("6 PM")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Segment Details

    private var segmentDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Work Mode Breakdown")
                .font(.caption)
                .foregroundColor(.secondary)

            ForEach(viewModel.modeBreakdown, id: \.mode) { item in
                HStack {
                    Circle()
                        .fill(item.mode.color)
                        .frame(width: 8, height: 8)

                    Text(item.mode.description)
                        .font(.caption)

                    Spacer()

                    Text(item.percentage)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(item.duration)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Activity Yet Today")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Start working and the timeline will appear as snapshots are captured every 5 minutes.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Tab 2: Current Session

/// Live stats for the current work session
struct CurrentSessionTab: View {
    @StateObject private var appState = AppState.shared
    @StateObject private var viewModel = CurrentSessionViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Live metrics card
                liveMetricsCard

                // Current context card
                currentContextCard

                // Work mode explanation card
                workModeExplanationCard
            }
            .padding()
        }
        .onAppear {
            viewModel.startUpdating()
        }
        .onDisappear {
            viewModel.stopUpdating()
        }
    }

    // MARK: - Live Metrics Card

    private var liveMetricsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Live Metrics")
                .font(.headline)
                .foregroundColor(.primary)

            HStack(spacing: 24) {
                // Session duration
                MetricView(
                    icon: "clock.fill",
                    label: "Session Duration",
                    value: viewModel.sessionDuration,
                    color: .blue
                )

                Divider()

                // Commits today
                MetricView(
                    icon: "square.and.pencil",
                    label: "Commits Today",
                    value: "\(appState.commitsToday)",
                    color: .green
                )

                Divider()

                // App switches per hour
                MetricView(
                    icon: "arrow.left.arrow.right",
                    label: "App Switches/Hour",
                    value: viewModel.appSwitchesPerHour.map { "\($0)" } ?? "—",
                    color: viewModel.appSwitchesColor
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Current Context Card

    private var currentContextCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Current Context")
                .font(.headline)
                .foregroundColor(.primary)

            VStack(spacing: 12) {
                // Git context
                if let git = appState.currentContext?.git {
                    ContextRow(
                        icon: "square.and.arrow.up.on.square",
                        label: "Repository",
                        value: git.repoName
                    )

                    ContextRow(
                        icon: "arrow.branch",
                        label: "Branch",
                        value: git.branch,
                        valueColor: git.isOnFeatureBranch ? .primary : .orange
                    )
                } else {
                    ContextRow(
                        icon: "square.and.arrow.up.on.square",
                        label: "Repository",
                        value: "No active repository",
                        valueColor: .secondary
                    )
                }

                Divider()

                // Active application
                if let system = appState.currentContext?.system {
                    ContextRow(
                        icon: "app.fill",
                        label: "Active App",
                        value: system.activeApp,
                        valueColor: system.isFocusApp ? .blue : .primary
                    )

                    if system.isFocusApp {
                        HStack(spacing: 4) {
                            Image(systemName: "brain")
                                .font(.caption)
                                .foregroundColor(.blue)
                            Text("Focus app detected")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.leading, 28)
                    }
                } else {
                    ContextRow(
                        icon: "app.fill",
                        label: "Active App",
                        value: "Unknown",
                        valueColor: .secondary
                    )
                }

                Divider()

                // Current work mode
                HStack {
                    Image(systemName: "brain.head.profile")
                        .foregroundColor(.secondary)
                        .frame(width: 20)

                    Text("Work Mode")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Spacer()

                    WorkModeBadge(mode: appState.workMode)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Work Mode Explanation Card

    private var workModeExplanationCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Why This Mode?")
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                Text("Signals contributing to work mode detection")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if let context = appState.currentContext {
                VStack(alignment: .leading, spacing: 12) {
                    // System activity signals
                    SignalSection(
                        title: "System Activity",
                        signals: viewModel.getSystemSignals(from: context)
                    )

                    // Git activity signals
                    if context.git != nil {
                        SignalSection(
                            title: "Git Activity",
                            signals: viewModel.getGitSignals(from: context)
                        )
                    }

                    // Struggle signals
                    if !context.struggleSignals.isEmpty {
                        SignalSection(
                            title: "Struggle Signals",
                            signals: context.struggleSignals.map { signal in
                                SignalItem(
                                    icon: "exclamationmark.triangle.fill",
                                    text: viewModel.formatSignal(signal),
                                    color: .orange
                                )
                            }
                        )
                    }

                    // Pressure signals
                    if !context.pressureSignals.isEmpty {
                        SignalSection(
                            title: "Pressure Signals",
                            signals: context.pressureSignals.map { signal in
                                SignalItem(
                                    icon: "exclamationmark.circle.fill",
                                    text: viewModel.formatSignal(signal),
                                    color: .red
                                )
                            }
                        )
                    }
                }
            } else {
                Text("No context data available yet")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
}

// MARK: - Tab 3: History

/// Past sessions from the last 7 days
struct HistoryTab: View {
    @State private var sessions: [WorkSessionSummary] = []
    @State private var selectedSession: WorkSessionSummary?
    @State private var sessionSnapshots: [ContextSnapshot] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            if isLoading {
                loadingView
            } else if let error = error {
                errorView(message: error)
            } else if sessions.isEmpty {
                emptyStateView
            } else {
                HStack(spacing: 0) {
                    // Session list (left sidebar)
                    sessionListView
                        .frame(width: 250)

                    Divider()

                    // Session detail (right pane)
                    if let selected = selectedSession {
                        sessionDetailView(session: selected)
                    } else {
                        selectPromptView
                    }
                }
            }
        }
        .onAppear {
            loadSessions()
        }
    }

    // MARK: - Session List

    private var sessionListView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Last 7 Days")
                .font(.headline)
                .padding()

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(sessions) { session in
                        SessionRow(
                            session: session,
                            isSelected: selectedSession?.id == session.id
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectSession(session)
                        }

                        Divider()
                    }
                }
            }
        }
        .background(Color(NSColor.controlBackgroundColor))
    }

    // MARK: - Session Detail

    private func sessionDetailView(session: WorkSessionSummary) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(session.dateString)
                            .font(.title2)
                            .fontWeight(.semibold)

                        Spacer()

                        Text(session.dominantMode.description)
                            .font(.caption)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                            .background(session.dominantMode.color.opacity(0.2))
                            .foregroundColor(session.dominantMode.color)
                            .cornerRadius(8)
                    }

                    Text(session.timeRange)
                        .font(.body)
                        .foregroundColor(.secondary)
                }

                // Stats
                HStack(spacing: 24) {
                    StatItem(
                        icon: "clock",
                        label: "Duration",
                        value: session.durationString
                    )

                    StatItem(
                        icon: "checkmark.circle",
                        label: "Commits",
                        value: "\(session.totalCommits)"
                    )

                    StatItem(
                        icon: "arrow.left.arrow.right",
                        label: "Switches",
                        value: "\(session.totalSwitches)"
                    )

                    StatItem(
                        icon: "camera.metering.spot",
                        label: "Snapshots",
                        value: "\(session.snapshotCount)"
                    )
                }

                // Repositories
                if !session.repositories.isEmpty && !session.repositories.contains("") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Repositories")
                            .font(.headline)

                        ForEach(session.repositories.filter { !$0.isEmpty }, id: \.self) { repo in
                            HStack {
                                Image(systemName: "folder.badge.gearshape")
                                    .foregroundColor(.secondary)
                                Text(repo)
                                    .font(.body)
                            }
                        }
                    }
                }

                // Timeline
                if !sessionSnapshots.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Session Timeline")
                            .font(.headline)

                        SessionTimelineView(
                            snapshots: sessionSnapshots,
                            startTime: session.startedAt,
                            endTime: session.endedAt ?? Date()
                        )
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Loading & Empty States

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)

            Text("Loading sessions...")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Error Loading Sessions")
                .font(.title2)
                .fontWeight(.semibold)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var emptyStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Sessions Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Keep 80HD running to build your work history")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var selectPromptView: some View {
        VStack(spacing: 12) {
            Image(systemName: "hand.tap")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("Select a Session")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Click a session on the left to view details")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    private func loadSessions() {
        isLoading = true
        error = nil

        do {
            sessions = try DatabaseManager.shared.getRecentSessions(days: 7)
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    private func selectSession(_ session: WorkSessionSummary) {
        selectedSession = session

        // Load snapshots for this session
        do {
            sessionSnapshots = try DatabaseManager.shared.getSnapshotsForSession(sessionId: session.id)
        } catch {
            sessionSnapshots = []
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let session: WorkSessionSummary
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Circle()
                    .fill(session.dominantMode.color)
                    .frame(width: 8, height: 8)

                Text(session.isToday ? "Today" : relativeDateString)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text(session.durationString)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(session.timeRange)
                .font(.body)
                .fontWeight(isSelected ? .semibold : .regular)

            HStack(spacing: 12) {
                if session.totalCommits > 0 {
                    Label("\(session.totalCommits)", systemImage: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if session.totalSwitches > 0 {
                    Label("\(session.totalSwitches)", systemImage: "arrow.left.arrow.right")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isSelected ? Color.accentColor.opacity(0.1) : Color.clear)
    }

    private var relativeDateString: String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInYesterday(session.startedAt) {
            return "Yesterday"
        } else if let days = calendar.dateComponents([.day], from: session.startedAt, to: now).day, days < 7 {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return formatter.string(from: session.startedAt)
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .none
            return formatter.string(from: session.startedAt)
        }
    }
}

// MARK: - Stat Item

struct StatItem: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .foregroundColor(.secondary)
                    .font(.caption)

                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Session Timeline View

struct SessionTimelineView: View {
    let snapshots: [ContextSnapshot]
    let startTime: Date
    let endTime: Date

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.1))
                    .frame(height: 40)

                // Segments
                HStack(spacing: 0) {
                    ForEach(segments, id: \.id) { segment in
                        TimelineSegment(
                            segment: segment,
                            totalWidth: geometry.size.width,
                            startOfDay: startTime,
                            endOfDay: endTime
                        )
                    }
                }
            }
        }
        .frame(height: 40)
    }

    private var segments: [WorkSegment] {
        guard !snapshots.isEmpty else { return [] }

        var result: [WorkSegment] = []

        for i in 0..<snapshots.count {
            let snapshot = snapshots[i]
            let start = snapshot.timestamp
            let end = i < snapshots.count - 1 ? snapshots[i + 1].timestamp : endTime

            let segment = WorkSegment(
                startTime: start,
                endTime: end,
                mode: snapshot.workMode,
                activeApp: snapshot.system.activeApp,
                gitRepo: snapshot.git?.repoName
            )

            result.append(segment)
        }

        return result
    }
}

// MARK: - Timeline Components

/// Individual timeline segment representing a work period
struct TimelineSegment: View {
    let segment: WorkSegment
    let totalWidth: CGFloat
    let startOfDay: Date
    let endOfDay: Date

    @State private var isHovering = false

    var body: some View {
        let width = segmentWidth()

        Rectangle()
            .fill(segment.mode.color)
            .frame(width: width)
            .overlay(
                Rectangle()
                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
            )
            .overlay(
                // Hover tooltip
                Group {
                    if isHovering {
                        tooltipView
                    }
                }
            )
            .onHover { hovering in
                isHovering = hovering
            }
    }

    private func segmentWidth() -> CGFloat {
        let totalDuration = endOfDay.timeIntervalSince(startOfDay)
        let segmentDuration = segment.endTime.timeIntervalSince(segment.startTime)
        return totalWidth * (segmentDuration / totalDuration)
    }

    private var tooltipView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(segment.mode.description)
                .font(.caption)
                .fontWeight(.semibold)

            Text(segment.timeRange)
                .font(.caption2)

            if let app = segment.activeApp {
                Text("App: \(app)")
                    .font(.caption2)
            }

            if let repo = segment.gitRepo {
                Text("Repo: \(repo)")
                    .font(.caption2)
            }
        }
        .padding(8)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(6)
        .shadow(radius: 4)
        .offset(y: -70)
    }
}

/// Work segment model
struct WorkSegment: Identifiable {
    let id = UUID()
    let startTime: Date
    let endTime: Date
    let mode: WorkMode
    let activeApp: String?
    let gitRepo: String?

    var timeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "\(formatter.string(from: startTime)) - \(formatter.string(from: endTime))"
    }

    var duration: TimeInterval {
        endTime.timeIntervalSince(startTime)
    }
}

/// View model for timeline data
@MainActor
class TimelineViewModel: ObservableObject {
    @Published var segments: [WorkSegment] = []
    @Published var modeBreakdown: [(mode: WorkMode, percentage: String, duration: String)] = []

    private let database = DatabaseManager.shared

    var startTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: startOfDay)
    }

    var currentTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: Date())
    }

    var startOfDay: Date {
        Calendar.current.startOfDay(for: Date()).addingTimeInterval(8 * 3600) // 8 AM
    }

    var endOfDay: Date {
        Calendar.current.startOfDay(for: Date()).addingTimeInterval(18 * 3600) // 6 PM
    }

    func loadTodaysSnapshots() {
        do {
            let snapshots = try database.getRecentSnapshots(hours: 24)

            // Filter to today only (8 AM onwards)
            let todaySnapshots = snapshots.filter { snapshot in
                snapshot.timestamp >= startOfDay
            }

            // Group consecutive snapshots with same work mode into segments
            var tempSegments: [WorkSegment] = []
            var currentMode: WorkMode?
            var segmentStart: Date?
            var segmentApp: String?
            var segmentRepo: String?

            for snapshot in todaySnapshots.sorted(by: { $0.timestamp < $1.timestamp }) {
                let mode = snapshot.workMode

                if mode != currentMode {
                    // Close previous segment
                    if let start = segmentStart, let prevMode = currentMode {
                        tempSegments.append(WorkSegment(
                            startTime: start,
                            endTime: snapshot.timestamp,
                            mode: prevMode,
                            activeApp: segmentApp,
                            gitRepo: segmentRepo
                        ))
                    }

                    // Start new segment
                    currentMode = mode
                    segmentStart = snapshot.timestamp
                    segmentApp = snapshot.system.activeApp
                    segmentRepo = snapshot.git?.repoName
                }
            }

            // Close final segment
            if let start = segmentStart, let mode = currentMode {
                tempSegments.append(WorkSegment(
                    startTime: start,
                    endTime: Date(),
                    mode: mode,
                    activeApp: segmentApp,
                    gitRepo: segmentRepo
                ))
            }

            segments = tempSegments

            // Calculate mode breakdown
            calculateModeBreakdown()
        } catch {
            print("ERROR: Failed to load snapshots: \(error)")
        }
    }

    private func calculateModeBreakdown() {
        let totalDuration = segments.reduce(0) { $0 + $1.duration }

        // Group by mode
        var modeMap: [WorkMode: TimeInterval] = [:]
        for segment in segments {
            modeMap[segment.mode, default: 0] += segment.duration
        }

        // Convert to breakdown
        modeBreakdown = modeMap.map { mode, duration in
            let percentage = totalDuration > 0 ? (duration / totalDuration) * 100 : 0
            let hours = Int(duration) / 3600
            let minutes = (Int(duration) % 3600) / 60

            return (
                mode: mode,
                percentage: String(format: "%.0f%%", percentage),
                duration: hours > 0 ? "\(hours)h \(minutes)m" : "\(minutes)m"
            )
        }.sorted { $0.1 > $1.1 } // Sort by percentage descending
    }
}

// MARK: - Current Session Components

/// Metric display for live stats
struct MetricView: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.primary)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Context row for displaying git/app context
struct ContextRow: View {
    let icon: String
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.secondary)
                .frame(width: 20)

            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(valueColor)
        }
    }
}

/// Signal section for work mode explanation
struct SignalSection: View {
    let title: String
    let signals: [SignalItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)

            ForEach(signals) { signal in
                HStack(spacing: 6) {
                    Image(systemName: signal.icon)
                        .font(.caption)
                        .foregroundColor(signal.color)
                        .frame(width: 16)

                    Text(signal.text)
                        .font(.caption)
                        .foregroundColor(.primary)
                }
            }
        }
    }
}

/// Signal item model
struct SignalItem: Identifiable {
    let id = UUID()
    let icon: String
    let text: String
    let color: Color
}

/// View model for current session tab
@MainActor
class CurrentSessionViewModel: ObservableObject {
    // MARK: - Signal Thresholds (Constants)

    private enum SignalThreshold {
        static let lowSwitchingRate = 10      // App switches/hour
        static let highSwitchingRate = 20     // App switches/hour
        static let recentCommitHours = 1.0    // Hours since commit
        static let staleCommitHours = 2.0     // Hours since commit
    }

    // MARK: - Published State

    @Published var sessionDuration: String = "No active session"
    @Published var appSwitchesPerHour: Int? = nil

    private var timer: Timer?
    private let database = DatabaseManager.shared
    private let appState = AppState.shared

    // MARK: - Computed Properties

    var appSwitchesColor: Color {
        guard let switches = appSwitchesPerHour else { return .secondary }
        return switches > SignalThreshold.highSwitchingRate ? .orange : .secondary
    }

    func startUpdating() {
        updateMetrics()
        let newTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateMetrics()
        }
        RunLoop.main.add(newTimer, forMode: .common)
        timer = newTimer
    }

    func stopUpdating() {
        timer?.invalidate()
        timer = nil
    }

    private func updateMetrics() {
        // Update session duration
        if let start = appState.focusStartTime {
            let duration = Date().timeIntervalSince(start)
            let hours = Int(duration) / 3600
            let minutes = (Int(duration) % 3600) / 60
            sessionDuration = "\(hours)h \(minutes)m"
        } else {
            sessionDuration = "No active session"
        }

        // Update app switches per hour
        if let system = appState.currentContext?.system {
            appSwitchesPerHour = system.appSwitchesLastHour
        } else {
            appSwitchesPerHour = nil
        }
    }

    // MARK: - Signal Formatting

    func getSystemSignals(from context: ContextSnapshot) -> [SignalItem] {
        var signals: [SignalItem] = []

        // Focus app signal
        if context.system.isFocusApp {
            signals.append(SignalItem(
                icon: "checkmark.circle.fill",
                text: "In focus app (\(context.system.activeApp))",
                color: .blue
            ))
        } else {
            signals.append(SignalItem(
                icon: "circle",
                text: "Active app: \(context.system.activeApp)",
                color: .secondary
            ))
        }

        // App switching rate
        let switchRate = context.system.appSwitchesLastHour
        if switchRate < SignalThreshold.lowSwitchingRate {
            signals.append(SignalItem(
                icon: "checkmark.circle.fill",
                text: "Low app switching (\(switchRate)/hour)",
                color: .green
            ))
        } else if switchRate < SignalThreshold.highSwitchingRate {
            signals.append(SignalItem(
                icon: "circle",
                text: "Moderate app switching (\(switchRate)/hour)",
                color: .secondary
            ))
        } else {
            signals.append(SignalItem(
                icon: "exclamationmark.circle.fill",
                text: "High app switching (\(switchRate)/hour)",
                color: .orange
            ))
        }

        // Communication app signal
        if context.system.isCommunicationApp {
            signals.append(SignalItem(
                icon: "bubble.left.and.bubble.right.fill",
                text: "In communication app",
                color: .green
            ))
        }

        return signals
    }

    func getGitSignals(from context: ContextSnapshot) -> [SignalItem] {
        var signals: [SignalItem] = []

        guard let git = context.git else { return signals }

        // Commits today
        if git.commitsToday > 0 {
            signals.append(SignalItem(
                icon: "checkmark.circle.fill",
                text: "\(git.commitsToday) commit\(git.commitsToday == 1 ? "" : "s") today",
                color: .green
            ))
        }

        // Uncommitted changes
        if git.uncommittedChanges {
            signals.append(SignalItem(
                icon: "circle.fill",
                text: "Uncommitted changes detected",
                color: .blue
            ))
        }

        // Feature branch
        if git.isOnFeatureBranch {
            signals.append(SignalItem(
                icon: "checkmark.circle.fill",
                text: "On feature branch (\(git.branch))",
                color: .green
            ))
        } else {
            signals.append(SignalItem(
                icon: "exclamationmark.triangle.fill",
                text: "On \(git.branch) branch",
                color: .orange
            ))
        }

        // Time since last commit
        if let hoursSince = git.hoursSinceLastCommit {
            if hoursSince < SignalThreshold.recentCommitHours {
                signals.append(SignalItem(
                    icon: "checkmark.circle.fill",
                    text: "Recent commit (<1 hour ago)",
                    color: .green
                ))
            } else if hoursSince < SignalThreshold.staleCommitHours {
                signals.append(SignalItem(
                    icon: "circle.fill",
                    text: "Last commit \(Int(hoursSince))h ago",
                    color: .secondary
                ))
            } else {
                signals.append(SignalItem(
                    icon: "clock.fill",
                    text: "Last commit \(Int(hoursSince))h ago",
                    color: .orange
                ))
            }
        }

        return signals
    }

    func formatSignal(_ signal: String) -> String {
        switch signal {
        case "no_commits_2h":
            return "No commits for 2+ hours"
        case "high_app_switching":
            return "High app switching rate (>20/hour)"
        case "high_browser_switching":
            return "High browser switching (research loop)"
        case "commits_to_main":
            return "Committing directly to main branch"
        case "not_feature_branch":
            return "Not on feature branch with changes"
        case "off_hours_work":
            return "Working outside normal hours"
        default:
            return signal.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

// MARK: - Preview

#Preview {
    ObservingEyeDashboard()
        .frame(width: 800, height: 600)
}
