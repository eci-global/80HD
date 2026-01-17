"""
Environment setup for worktrees.

Handles copying .env.example and managing environment variables per worktree.
"""

import shutil
from pathlib import Path
from typing import Optional


class EnvSetup:
    """Manages environment setup for worktrees."""
    
    def __init__(self, repo_root: Optional[Path] = None):
        """
        Initialize environment setup.
        
        Args:
            repo_root: Path to repository root
        """
        if repo_root is None:
            repo_root = Path(__file__).parent.parent.parent
        self.repo_root = Path(repo_root)
        self.env_example = self.repo_root / ".env.example"
    
    def setup_worktree_env(self, worktree_path: Path) -> None:
        """
        Set up environment for a worktree.
        
        Copies .env.example to .env.local in the worktree if it doesn't exist.
        
        Args:
            worktree_path: Path to worktree directory
        """
        worktree_path = Path(worktree_path)
        env_local = worktree_path / ".env.local"
        
        if env_local.exists():
            print(f".env.local already exists in {worktree_path}")
            return
        
        if not self.env_example.exists():
            print(f"Warning: .env.example not found at {self.env_example}")
            return
        
        # Copy .env.example to .env.local
        shutil.copy2(self.env_example, env_local)
        print(f"Copied .env.example to {env_local}")
        
        # Add note about worktree-specific env
        with open(env_local, 'a', encoding='utf-8') as f:
            f.write("\n# Worktree-specific environment variables\n")
            f.write("# This file is specific to this worktree and will not be committed\n")
    
    def cleanup_worktree_env(self, worktree_path: Path) -> None:
        """
        Clean up environment files for a worktree.
        
        Args:
            worktree_path: Path to worktree directory
        """
        worktree_path = Path(worktree_path)
        env_local = worktree_path / ".env.local"
        
        if env_local.exists():
            env_local.unlink()
            print(f"Removed {env_local}")


def setup_env_for_worktree(worktree_path: Path) -> None:
    """
    Convenience function to set up environment for a worktree.
    
    Args:
        worktree_path: Path to worktree directory
    """
    setup = EnvSetup()
    setup.setup_worktree_env(worktree_path)

