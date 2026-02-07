---
name: compose-email
description: Compose and draft emails via Microsoft Outlook on macOS. Use when users want to send emails, compose messages, draft emails, create email with attachments, or write professional correspondence.
---

You have access to Bash tools to execute AppleScript for Outlook. Use this skill when users need to compose emails.

## Contents

- [Overview](#overview) - What this skill does
- [User Experience](#user-experience) - Dead simple email drafting
- [Natural Language Parsing](#natural-language-parsing) - Extract parameters from user input
- [Workflow](#workflow) - AppleScript execution patterns
- [HTML Formatting](#html-formatting) - Professional email structure
- [Attachments](#attachments) - File attachment handling
- [Critical Rules](#critical-rules) - Security and no auto-send
- [Troubleshooting](#troubleshooting) - Common AppleScript errors

## Overview

This skill composes professional emails via Microsoft Outlook on macOS using AppleScript with:
- **HTML formatting** for professional-looking emails (headers, lists, tables)
- **Multiple recipients** (To, CC, BCC) with name and email parsing
- **Attachments** with file validation
- **Draft mode** - emails open for review, never auto-sent

**Before this skill:**
- Users manually compose emails or use plain text AppleScript
- Poor formatting (no structure, no lists, no styling)
- Manual copy/paste of content into Outlook

**After this skill:**
```
User: Send an email to john@example.com about the Q4 report with the attached CSV

Claude: [Opens Outlook draft with formatted email]

✓ Email draft created in Outlook
  To: john@example.com
  Subject: Q4 Report
  Attachments: report.csv

  Review and send when ready.
```

## User Experience

**Design Principles:**
- **Dead simple** - Describe what you want, get a draft
- **Professional formatting** - HTML emails with proper structure
- **Never auto-send** - Always create drafts for review
- **Smart parsing** - Extract recipients, subject, body from natural language
- **Attachment validation** - Check files exist before attaching

## Natural Language Parsing

Extract these parameters from user input:

**Recipients:**
- Patterns: "to [email]", "send to [name]", "email [name] at [address]"
- Multiple: "to john@x.com and jane@y.com"
- CC: "cc [email]", "copy [name]"
- BCC: "bcc [email]"
- Names: "John Smith <john@example.com>" or just "john@example.com"

**Subject:**
- Patterns: "about [topic]", "regarding [topic]", "subject: [topic]"
- Infer from context if not explicit

**Body Content:**
- Main content of the email
- Look for structure: summaries, action items, lists
- Parse Markdown-style formatting into HTML

**Attachments:**
- Patterns: "attach [file]", "with attachment [file]", "include [file]"
- Validate file exists before proceeding

**Tone (optional):**
- "formal" / "professional" - More structured, proper salutations
- "casual" / "friendly" - Conversational tone
- Default: Professional

## Workflow

### Step 1: Parse User Request

Extract recipients, subject, body, and attachments from natural language.

```
User: "Email sarah@company.com about the budget review, mention we're 10% under budget
       and attach the q4-budget.xlsx file"

Parsed:
- To: sarah@company.com
- Subject: Budget Review
- Body: We're 10% under budget (format nicely)
- Attachments: q4-budget.xlsx
```

### Step 2: Validate Attachments (if any)

Check each attachment exists before proceeding:

```bash
# Check file exists
ls -la "/path/to/attachment"
```

If file not found, ask user for correct path.

### Step 3: Build HTML Body

Convert content to well-formatted HTML. See [FORMATTING.md](FORMATTING.md) for patterns.

**Basic structure:**
```html
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">

<p>Hi Sarah,</p>

<p>[Opening paragraph]</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Summary</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li><strong>Budget Status:</strong> 10% under budget</li>
</ul>

<p>Best regards,<br>[Your name]</p>

</body>
</html>
```

### Step 4: Build AppleScript

**Template for creating draft:**

```applescript
tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"[SUBJECT]"}

    -- Set HTML content
    set content of theMsg to "[HTML_BODY]"

    -- Add recipients
    make new to recipient at theMsg with properties {email address:{name:"[NAME]", address:"[EMAIL]"}}

    -- Add CC recipients (if any)
    make new cc recipient at theMsg with properties {email address:{name:"[NAME]", address:"[EMAIL]"}}

    -- Add attachments (if any)
    make new attachment at theMsg with properties {file:POSIX file "[FILE_PATH]"}

    -- Open the draft for review (do NOT send)
    open theMsg
end tell
```

### Step 5: Execute AppleScript

Run the AppleScript via osascript:

```bash
osascript -e 'tell application "Microsoft Outlook"
    activate
    set theMsg to make new outgoing message with properties {subject:"Budget Review"}
    set content of theMsg to "<html><body style=\"font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #333;\"><p>Hi Sarah,</p><p>I wanted to share a quick update on our budget status.</p><h3 style=\"color: #2c5aa0; margin-top: 20px;\">Summary</h3><ul><li><strong>Status:</strong> 10% under budget</li></ul><p>Best regards</p></body></html>"
    make new to recipient at theMsg with properties {email address:{name:"Sarah", address:"sarah@company.com"}}
    make new attachment at theMsg with properties {file:POSIX file "/Users/tedgar/Documents/q4-budget.xlsx"}
    open theMsg
end tell'
```

### Step 6: Confirm to User

```markdown
✓ Email draft created in Outlook

**To:** Sarah <sarah@company.com>
**Subject:** Budget Review
**Attachments:** q4-budget.xlsx

The draft is open in Outlook. Review and send when ready.
```

## HTML Formatting

### Base Styles

Always include these base styles for consistent rendering:

```html
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             font-size: 14px;
             line-height: 1.6;
             color: #333;">
```

### Headings

Use H3 for sections (H2 is too large for emails):

```html
<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Section Title</h3>
```

### Lists

**Bullet lists:**
```html
<ul style="margin: 10px 0; padding-left: 20px;">
  <li><strong>Key Point:</strong> Value or description</li>
  <li><strong>Another Point:</strong> More details</li>
</ul>
```

**Numbered lists:**
```html
<ol style="margin: 10px 0; padding-left: 20px;">
  <li>First action item</li>
  <li>Second action item</li>
</ol>
```

### Tables

For data presentation:

```html
<table style="border-collapse: collapse; margin: 15px 0; width: 100%;">
  <tr style="background-color: #f5f5f5;">
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Column 1</th>
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Column 2</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 1</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 2</td>
  </tr>
</table>
```

### Emphasis

```html
<strong>Bold for key terms</strong>
<em>Italics for emphasis</em>
<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px;">monospace for technical</code>
```

### Links

```html
<a href="https://example.com" style="color: #2c5aa0;">Link text</a>
```

See [FORMATTING.md](FORMATTING.md) for complete formatting reference and templates.

## Attachments

### Validation

Always validate attachments exist before including in AppleScript:

```bash
# Check file exists and is readable
if [ -f "/path/to/file.pdf" ]; then
    echo "File exists"
else
    echo "File not found"
fi
```

### AppleScript Syntax

```applescript
make new attachment at theMsg with properties {file:POSIX file "/absolute/path/to/file.pdf"}
```

**Important:**
- Use absolute paths (not relative)
- Use POSIX file syntax
- Path must not contain unescaped special characters

### Multiple Attachments

```applescript
make new attachment at theMsg with properties {file:POSIX file "/path/to/file1.pdf"}
make new attachment at theMsg with properties {file:POSIX file "/path/to/file2.xlsx"}
```

## Critical Rules

### Security

- **NEVER auto-send emails** - Always create drafts, let user review
- **NEVER include sensitive data in logs** - Don't echo email content to console
- **Validate all file paths** - Prevent path traversal attacks
- **Escape user input** - Prevent AppleScript injection

### Quote Escaping

AppleScript requires escaped quotes in HTML:

```bash
# Wrong - will break
set content of theMsg to "<p style="color: red;">Text</p>"

# Correct - escaped quotes
set content of theMsg to "<p style=\"color: red;\">Text</p>"
```

### Inline CSS Only

Email clients strip external stylesheets. Always use inline styles:

```html
<!-- Wrong - external CSS won't work -->
<link rel="stylesheet" href="style.css">
<p class="highlight">Text</p>

<!-- Correct - inline styles -->
<p style="background-color: yellow;">Text</p>
```

### Outlook Must Be Running

Check Outlook is available before executing:

```bash
# Check if Outlook is installed
if [ -d "/Applications/Microsoft Outlook.app" ]; then
    osascript -e 'tell application "Microsoft Outlook" to activate'
else
    echo "Microsoft Outlook is not installed"
fi
```

### Timeout Handling

AppleScript commands can timeout. Use reasonable timeouts:

```bash
# Add timeout to osascript
timeout 30 osascript -e '...'
```

## Troubleshooting

### "Microsoft Outlook got an error: AppleEvent timed out"

**Cause:** Outlook is busy or not responding.

**Fix:**
1. Ensure Outlook is running and not stuck
2. Try quitting and restarting Outlook
3. Check for modal dialogs blocking Outlook

### "Can't make ... into type file"

**Cause:** File path is incorrect or file doesn't exist.

**Fix:**
1. Verify file exists with `ls -la "/path/to/file"`
2. Use absolute paths, not relative
3. Check for spaces or special characters in path

### "Microsoft Outlook got an error: Can't get outgoing message"

**Cause:** AppleScript syntax error or Outlook not ready.

**Fix:**
1. Ensure Outlook is fully launched
2. Check AppleScript syntax (especially quote escaping)
3. Try running a simpler AppleScript first

### Email Body Shows Raw HTML

**Cause:** Using `plain text content` instead of `content`.

**Fix:** Use `set content of theMsg to "..."` for HTML emails, not `set plain text content`.

### Formatting Looks Wrong

**Cause:** Email client stripping styles or incompatible CSS.

**Fix:**
1. Use only inline CSS
2. Use simple, widely-supported CSS properties
3. Avoid complex layouts (flexbox, grid)
4. Test in Outlook's reading pane

### "System Events got an error: Not authorized"

**Cause:** macOS security permissions not granted.

**Fix:**
1. Go to System Preferences > Security & Privacy > Privacy
2. Add Terminal (or IDE) to "Automation" permissions
3. Allow control of Microsoft Outlook

## Examples

See [EXAMPLES.md](EXAMPLES.md) for complete usage scenarios:
- Simple email with formatting
- Email with attachments
- Vendor request email
- Status update email
- Multi-recipient email with CC

## Further Reading

- [FORMATTING.md](FORMATTING.md) - Complete HTML formatting reference
- [EXAMPLES.md](EXAMPLES.md) - Common email scenarios
- [Outlook AppleScript Reference](https://docs.microsoft.com/en-us/office/client-developer/outlook/outlook-mac-scriptable-overview) - Official documentation
