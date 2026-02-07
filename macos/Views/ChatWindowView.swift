import SwiftUI

/// Chat interface for interacting with 80HD.
///
/// Users can:
/// - Ask "Should I share something?"
/// - Request "Draft an update for the team"
/// - Get suggestions based on current context
///
/// Phase 1: Basic chat skeleton with echo responses
/// Future: Claude API integration for intelligent responses
struct ChatWindowView: View {
    @State private var messageText = ""
    @State private var messages: [ChatMessage] = [
        ChatMessage(
            text: "Hi Travis! I'm 80HD, your collaboration agent. I'm monitoring your work context and will help you stay visible without the friction.\n\nAsk me things like:\n• \"Should I share something?\"\n• \"Draft an update for the team\"\n• \"How long since my last update?\"",
            isUser: false
        )
    ]
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            // Messages
            messagesView

            Divider()

            // Input
            inputView
        }
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Subviews

    private var headerView: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(.accentColor)

            Text("80HD")
                .font(.headline)

            Spacer()

            // Status indicator
            HStack(spacing: 4) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                Text("Monitoring")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }

    private var messagesView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(messages) { message in
                        ChatBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) { _ in
                // Scroll to bottom when new message added
                if let lastMessage = messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var inputView: some View {
        HStack(spacing: 12) {
            TextField("Ask 80HD...", text: $messageText)
                .textFieldStyle(.plain)
                .padding(10)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
                .focused($isInputFocused)
                .onSubmit {
                    sendMessage()
                }

            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(messageText.isEmpty ? .secondary : .accentColor)
            }
            .buttonStyle(.plain)
            .disabled(messageText.isEmpty)
        }
        .padding()
    }

    // MARK: - Actions

    private func sendMessage() {
        guard !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        let userMessage = ChatMessage(text: messageText, isUser: true)
        messages.append(userMessage)

        let query = messageText.lowercased()
        messageText = ""

        // Generate response based on query
        // Phase 1: Simple pattern matching
        // Future: Claude API integration
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let response = generateResponse(for: query)
            messages.append(response)
        }
    }

    private func generateResponse(for query: String) -> ChatMessage {
        // Simple pattern matching for Phase 1
        // This will be replaced with Claude API in Phase 4

        if query.contains("share") || query.contains("update") || query.contains("post") {
            return ChatMessage(
                text: "Based on your recent work, here's what I'd suggest sharing:\n\n📝 **Draft Update:**\n\"Working on the 80HD native app - got the menu bar and basic monitoring working. Next up: enhanced git tracking.\"\n\n[In Phase 4, I'll generate this from your actual context and post to GitHub + Teams + Linear]",
                isUser: false
            )
        }

        if query.contains("how long") || query.contains("last update") || query.contains("debt") {
            return ChatMessage(
                text: "⏱️ **Collaboration Status:**\n• Time since last visible update: ~2 hours\n• Work intensity: Medium\n• Collaboration debt: LOW\n\nYou're doing fine! No urgent need to post unless you want to.",
                isUser: false
            )
        }

        if query.contains("stuck") || query.contains("help") || query.contains("struggling") {
            return ChatMessage(
                text: "I notice you might be working through something challenging. Would you like me to:\n\n1. Draft a question for the team?\n2. Summarize what you've tried?\n3. Just keep monitoring (no action needed)?\n\n[In Phase 4, I'll detect struggle patterns automatically]",
                isUser: false
            )
        }

        if query.contains("status") || query.contains("context") {
            return ChatMessage(
                text: "📊 **Current Context:**\n• You've been in deep work mode\n• Focus time: tracking...\n• Active app: monitored\n• Git activity: monitored\n\n[In Phase 2, I'll show much more detail here]",
                isUser: false
            )
        }

        // Default response
        return ChatMessage(
            text: "I understand you said: \"\(query)\"\n\nI'm still learning! In future phases, I'll be able to:\n• Generate updates from your work context\n• Post to multiple channels\n• Detect when you're struggling\n• Suggest the right time to share\n\nFor now, try asking \"Should I share something?\" or \"How long since my last update?\"",
            isUser: false
        )
    }
}

// MARK: - Supporting Types

/// A single chat message
struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isUser: Bool
    let timestamp = Date()
}

/// Chat bubble view for displaying messages
struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.isUser {
                Spacer(minLength: 60)
            } else {
                // 80HD avatar
                Image(systemName: "brain.head.profile")
                    .font(.title3)
                    .foregroundColor(.accentColor)
                    .frame(width: 24, height: 24)
            }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.isUser ? "You" : "80HD")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(.init(message.text)) // .init enables Markdown rendering
                    .padding(12)
                    .background(message.isUser ? Color.accentColor : Color(NSColor.controlBackgroundColor))
                    .foregroundColor(message.isUser ? .white : .primary)
                    .cornerRadius(12)
            }

            if !message.isUser {
                Spacer(minLength: 60)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ChatWindowView()
        .frame(width: 600, height: 500)
}
