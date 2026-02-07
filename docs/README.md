# Neon CLI Setup (Ghostty + Starship + eza) on macOS

This guide recreates my high-contrast, pure-black, neon-loud terminal setup:
- **Ghostty** terminal with pure black background + neon palette
- **JetBrains Mono Nerd Font** for icons (Starship + eza)
- **Starship** prompt (high signal for Git + runtimes)
- **eza** as a modern, colorful `ls`
- `.zshrc` wiring for TrueColor + sane defaults

---

## 0) Prereqs
- macOS + Zsh
- Homebrew installed

Verify Homebrew:
```bash
brew --version
