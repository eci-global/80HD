# Email Body Formatting Guide

Best practices for formatting email bodies using HTML. Convert Markdown-style patterns to professional HTML emails.

## Base Template

Every email should use this base structure:

```html
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             font-size: 14px;
             line-height: 1.6;
             color: #333;">

<!-- Email content here -->

</body>
</html>
```

## Structure Elements

### Paragraphs

```html
<p>This is a paragraph with proper spacing.</p>

<p>This is another paragraph. Line height ensures readability.</p>
```

### Headings

Use H3 for sections (H2 is too large, H1 is inappropriate for emails):

```html
<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Section Title</h3>
```

### Bullet Lists (Unordered)

```html
<ul style="margin: 10px 0; padding-left: 20px;">
  <li>First item</li>
  <li>Second item</li>
  <li><strong>Key Item:</strong> With description</li>
</ul>
```

### Numbered Lists (Ordered)

```html
<ol style="margin: 10px 0; padding-left: 20px;">
  <li>First step</li>
  <li>Second step</li>
  <li>Third step</li>
</ol>
```

### Tables

```html
<table style="border-collapse: collapse; margin: 15px 0; width: 100%;">
  <tr style="background-color: #f5f5f5;">
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Header 1</th>
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Header 2</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 1</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 2</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 3</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Data 4</td>
  </tr>
</table>
```

### Key-Value Pairs (without borders)

```html
<table style="margin: 10px 0;">
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Status:</strong></td>
    <td style="padding: 4px 0;">On Track</td>
  </tr>
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Due Date:</strong></td>
    <td style="padding: 4px 0;">February 15, 2026</td>
  </tr>
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Owner:</strong></td>
    <td style="padding: 4px 0;">John Smith</td>
  </tr>
</table>
```

### Blockquotes

```html
<blockquote style="border-left: 3px solid #2c5aa0; margin: 15px 0; padding: 10px 20px; background-color: #f9f9f9;">
  <p style="margin: 0;">Important note or quote that needs emphasis.</p>
</blockquote>
```

### Horizontal Rule

```html
<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
```

## Inline Formatting

### Bold

```html
<strong>Important term</strong>
```

### Emphasis/Italics

```html
<em>Emphasized text</em>
```

### Monospace/Code

```html
<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace;">function_name()</code>
```

### Links

```html
<a href="https://example.com" style="color: #2c5aa0; text-decoration: underline;">Link text</a>
```

### Highlighting

```html
<span style="background-color: #fff3cd; padding: 2px 4px;">Highlighted text</span>
```

## Layout Patterns

### Summary → Details → Request

Standard business email structure:

```html
<p>Hi [Name],</p>

<p>[Brief context or purpose]</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Summary</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li><strong>Point 1:</strong> Value</li>
  <li><strong>Point 2:</strong> Value</li>
</ul>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Details</h3>
<p>[Expanded explanation if needed]</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Request</h3>
<ol style="margin: 10px 0; padding-left: 20px;">
  <li>Action item 1</li>
  <li>Action item 2</li>
</ol>

<p>Thanks,<br>[Your name]</p>
```

### Status Update

```html
<p>Hi Team,</p>

<p>Here's the status update for [Project Name].</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Progress</h3>
<table style="margin: 10px 0;">
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Completion:</strong></td>
    <td style="padding: 4px 0;">75%</td>
  </tr>
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Status:</strong></td>
    <td style="padding: 4px 0;">On Track</td>
  </tr>
  <tr>
    <td style="padding: 4px 16px 4px 0;"><strong>Target:</strong></td>
    <td style="padding: 4px 0;">February 15, 2026</td>
  </tr>
</table>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Completed This Week</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li>Task A completed</li>
  <li>Task B completed</li>
</ul>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Blockers</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li>Waiting on approval from [Team]</li>
</ul>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Next Week</h3>
<ol style="margin: 10px 0; padding-left: 20px;">
  <li>Start task C</li>
  <li>Complete testing</li>
</ol>

<p>Best regards,<br>[Your name]</p>
```

### Meeting Notes

```html
<p>Hi All,</p>

<p>Here are the notes from [Meeting Name] on [Date].</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Attendees</h3>
<p>Alice, Bob, Carol, Dave</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Discussion</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li>Topic A: [Summary of discussion]</li>
  <li>Topic B: [Summary of discussion]</li>
</ul>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Decisions</h3>
<ol style="margin: 10px 0; padding-left: 20px;">
  <li>Decision 1</li>
  <li>Decision 2</li>
</ol>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Action Items</h3>
<table style="border-collapse: collapse; margin: 15px 0; width: 100%;">
  <tr style="background-color: #f5f5f5;">
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Action</th>
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Owner</th>
    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Due</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;">Action item 1</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Alice</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Feb 10</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;">Action item 2</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Bob</td>
    <td style="border: 1px solid #ddd; padding: 8px;">Feb 12</td>
  </tr>
</table>

<p>Let me know if I missed anything.</p>

<p>Thanks,<br>[Your name]</p>
```

### Formal Request

```html
<p>Dear [Recipient Name],</p>

<p>I am writing to request [brief description of request].</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Background</h3>
<p>[Context and justification]</p>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Proposal</h3>
<ul style="margin: 10px 0; padding-left: 20px;">
  <li><strong>What:</strong> [Description]</li>
  <li><strong>Cost:</strong> [Amount]</li>
  <li><strong>Timeline:</strong> [Duration]</li>
  <li><strong>Expected Outcome:</strong> [Benefits]</li>
</ul>

<h3 style="color: #2c5aa0; margin-top: 20px; margin-bottom: 10px;">Recommendation</h3>
<p>[Your recommendation and next steps]</p>

<p>I am happy to provide additional details or schedule a meeting to discuss further.</p>

<p>Respectfully,<br>
[Your Name]<br>
[Your Title]</p>
```

## Signature Blocks

### Casual

```html
<p>Thanks,<br>[Name]</p>
```

### Professional

```html
<p>Best regards,<br>[Name]</p>
```

### Formal

```html
<p>Respectfully,<br>
[Full Name]<br>
[Title]<br>
[Department]</p>
```

### With Contact Info

```html
<p style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd;">
<strong>[Full Name]</strong><br>
[Title] | [Department]<br>
<a href="mailto:email@company.com" style="color: #2c5aa0;">email@company.com</a> |
<a href="tel:+15551234567" style="color: #2c5aa0;">+1 (555) 123-4567</a>
</p>
```

## Markdown to HTML Conversion

When users provide Markdown-style content, convert to HTML:

| Markdown | HTML |
|----------|------|
| `**bold**` | `<strong>bold</strong>` |
| `*italic*` | `<em>italic</em>` |
| `` `code` `` | `<code style="...">code</code>` |
| `[link](url)` | `<a href="url" style="...">link</a>` |
| `# Heading` | `<h3 style="...">Heading</h3>` |
| `- item` | `<ul><li>item</li></ul>` |
| `1. item` | `<ol><li>item</li></ol>` |
| `> quote` | `<blockquote style="...">quote</blockquote>` |
| `---` | `<hr style="...">` |

## AppleScript Escaping

When embedding HTML in AppleScript, escape double quotes:

```applescript
-- Wrong
set content of theMsg to "<p style="color: red;">Text</p>"

-- Correct
set content of theMsg to "<p style=\"color: red;\">Text</p>"
```

For complex HTML, build the string carefully:

```applescript
set htmlContent to "<html><body style=\"font-family: -apple-system, sans-serif;\">"
set htmlContent to htmlContent & "<p>First paragraph</p>"
set htmlContent to htmlContent & "<p>Second paragraph</p>"
set htmlContent to htmlContent & "</body></html>"
set content of theMsg to htmlContent
```

## Email Client Compatibility

### Safe CSS Properties

These work reliably across email clients:
- `font-family`, `font-size`, `font-weight`
- `color`, `background-color`
- `margin`, `padding`
- `border`, `border-collapse`
- `text-align`, `vertical-align`
- `line-height`
- `width` (use percentages or pixels)

### Avoid These

These may not render correctly:
- `flexbox`, `grid`
- `position: absolute/fixed`
- `float` (limited support)
- `box-shadow`, `border-radius` (limited)
- External stylesheets
- `@media` queries
- CSS variables

### Always Use Inline Styles

```html
<!-- Wrong - external CSS stripped -->
<style>.heading { color: blue; }</style>
<h3 class="heading">Title</h3>

<!-- Correct - inline styles -->
<h3 style="color: blue;">Title</h3>
```
