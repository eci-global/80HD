# 80HD Knowledge Base

This knowledge base contains documentation, guides, and troubleshooting resources for the 80HD interruption shield system. It serves both internal team members and end users.

## Structure

```
knowledge-base/
├── getting-started/     # Onboarding and introduction materials
├── how-to/             # Step-by-step guides for common tasks
├── troubleshooting/    # Problem-solving guides
├── team/               # Internal team documentation
└── assets/             # Screenshots, diagrams, and images
```

## Writing Articles

### Article Template

Each article should include frontmatter with metadata:

```markdown
---
title: Your Article Title
category: getting-started | how-to | troubleshooting | team
tags: [relevant, tags, here]
author: Your Name
date: YYYY-MM-DD
---

# Your Article Title

Introduction paragraph explaining what this article covers.

## Section 1

Content...

## Section 2

Content...

---

**Last Updated:** YYYY-MM-DD
**Maintainer:** Your Name
```

### Style Guidelines

1. **Use clear, descriptive titles** - Users should know what they'll learn from the title alone
2. **Include code examples** - Show, don't just tell
3. **Add troubleshooting sections** - Anticipate common issues
4. **Use screenshots sparingly** - They can become outdated quickly
5. **Link to related articles** - Help users navigate to related content
6. **Keep it current** - Update the "Last Updated" date when making changes

### Categories

- **getting-started**: First-time setup, introductions, "what is" content
- **how-to**: Task-oriented guides ("How to connect Microsoft 365", "How to customize your digest")
- **troubleshooting**: Problem-solving guides organized by symptom
- **team**: Internal documentation for developers, operators, and team members

## Integration with AI Chatbot

Articles in this knowledge base are:

1. **Embedded into vector database** - Using the existing PGVector pipeline
2. **Searchable via semantic search** - The chatbot can find relevant articles based on user queries
3. **Surfaced in responses** - The chatbot will reference and quote from articles when answering questions
4. **Shareable as Markdown** - Raw files can be shared directly in Teams/Slack

## Adding New Articles

1. Create your article in the appropriate category directory
2. Follow the article template and style guidelines
3. Save images/screenshots to the `assets/` directory
4. The article will be automatically ingested and embedded (when the pipeline is set up)
5. Test by asking the chatbot questions related to your article

## Current Articles

### Team Documentation

- [Configure Claude Code to Use Vertex AI](./team/configure-claude-code-vertex-ai.md) - Official cross-platform setup for Claude Code with Google Cloud Vertex AI (macOS, Linux, Windows)

## Roadmap

Future articles to add:

### Getting Started
- What is 80HD?
- First-time setup guide
- Understanding focus modes
- Customizing your digest

### How-To
- Connect Microsoft 365
- Connect Slack
- Manage escalations
- Set up Web Push notifications
- Configure digest preferences
- Using the Focus Pager PWA

### Troubleshooting
- Notifications not working
- OAuth connection errors
- Missing messages in digest
- Web Push subscription issues

### Team
- Deploying Edge Functions
- Adding new connectors
- Working with the queue system
- Understanding the embedding pipeline
- LiteLLM complexity router setup
- Monitoring and observability

## Contributing

When adding or updating articles:

1. Keep technical accuracy as the top priority
2. Use the actual 80HD codebase as reference
3. Include real examples from your configuration when possible
4. Test all commands and code snippets before publishing
5. Update this README when adding new articles

---

**Maintained by:** 80HD Team
**Last Updated:** 2026-01-17
