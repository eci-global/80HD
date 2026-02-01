# Two-Claude Pattern Shell Aliases
# Add these to your .zshrc or .bashrc
#
# Installation:
#   cat .claude/skills/two-claude-review/scripts/shell-aliases.sh >> ~/.zshrc
#   source ~/.zshrc

# ============================================================================
# Two-Claude Pattern Aliases
# ============================================================================

# Quick launch Claude in each worktree
alias plan='cd ~/Projects/80HD-planning && claude'
alias review='cd ~/Projects/80HD-review && claude'
alias analyze='cd ~/Projects/80HD-analysis && claude'
alias main='cd ~/Projects/80HD && claude'

# Navigate to worktrees without launching Claude
alias cdplan='cd ~/Projects/80HD-planning'
alias cdreview='cd ~/Projects/80HD-review'
alias cdanalyze='cd ~/Projects/80HD-analysis'
alias cdmain='cd ~/Projects/80HD'

# Two-Claude workflow helpers
alias two-claude-start='bash ~/Projects/80HD/.claude/skills/two-claude-review/scripts/two-claude-start.sh'
alias two-claude-stop='bash ~/Projects/80HD/.claude/skills/two-claude-review/scripts/two-claude-stop.sh'
alias plan2review='bash ~/Projects/80HD/.claude/skills/two-claude-review/scripts/plan-to-review.sh'

# Git worktree management
alias worktree-list='cd ~/Projects/80HD && git worktree list'
alias worktree-prune='cd ~/Projects/80HD && git worktree prune'

# ============================================================================
# Optional: Enhanced prompt showing worktree
# ============================================================================

# For zsh users (add this AFTER oh-my-zsh initialization if using oh-my-zsh)
function git_worktree_prompt() {
  if git rev-parse --git-dir > /dev/null 2>&1; then
    local worktree=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
    case $worktree in
      *-planning)
        echo " 🟢"
        ;;
      *-review)
        echo " 🔵"
        ;;
      *-analysis)
        echo " 🟠"
        ;;
    esac
  fi
}

# Uncomment to add worktree indicator to prompt
# PROMPT='%{$fg[cyan]%}%~%{$reset_color%}$(git_worktree_prompt)$(git_prompt_info) $ '

# For bash users
# PS1='\[\033[01;34m\]\w\[\033[00m\]$(git_worktree_prompt) \$ '
