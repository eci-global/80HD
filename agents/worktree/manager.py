"""
Git worktree management for task isolation.

Creates and manages git worktrees for each task, allowing parallel
execution without conflicts.
"""

import subprocess
import re
from pathlib import Path
from typing import Optional, Tuple
from dataclasses import dataclass, asdict
import json

from spec.task_schema import Task


@dataclass
class WorktreeInfo:
    """Information about a git worktree."""
    task_id: str
    worktree_path: Path
    branch_name: str
    base_branch: str = "main"
    status: str = "active"


class WorktreeManager:
    """Manages git worktree creation and removal."""
    
    def __init__(self, repo_root: Optional[Path] = None, worktrees_base: str = "worktrees"):
        """
        Initialize worktree manager.
        
        Args:
            repo_root: Path to repository root (defaults to parent of agents/)
            worktrees_base: Base directory name for worktrees
        """
        if repo_root is None:
            repo_root = Path(__file__).parent.parent.parent
        self.repo_root = Path(repo_root)
        self.worktrees_base = self.repo_root / worktrees_base
        self.worktrees_base.mkdir(exist_ok=True)
    
    def ensure_worktree(
        self,
        task: Task,
        jira_id: Optional[str] = None
    ) -> Tuple[WorktreeInfo, bool]:
        """
        Ensure worktree exists for a task, creating if needed.
        
        Args:
            task: Task object
            jira_id: Optional Jira ticket ID (e.g., "ITPLAT01-1234")
            
        Returns:
            Tuple of (WorktreeInfo, created_new) where created_new is True if worktree was just created
        """
        # Generate branch name
        branch_name = self._generate_branch_name(task, jira_id)
        
        # Check if worktree already exists
        worktree_path = self.worktrees_base / task.id
        
        if worktree_path.exists():
            # Worktree exists, verify it's valid
            try:
                self._verify_worktree(worktree_path, branch_name)
                return WorktreeInfo(
                    task_id=task.id,
                    worktree_path=worktree_path,
                    branch_name=branch_name
                ), False
            except Exception as e:
                print(f"Warning: Existing worktree invalid: {e}")
                # Remove invalid worktree
                self.remove_worktree(task.id)
        
        # Create new worktree
        return self._create_worktree(task, branch_name), True
    
    def _generate_branch_name(self, task: Task, jira_id: Optional[str] = None) -> str:
        """
        Generate branch name following AGENTS.md conventions.
        
        Format: {type}/{JIRA-ID}-{kebab-case-description}
        """
        # Determine branch type from action type
        action_to_type = {
            "IMPLEMENT": "feature",
            "DOCUMENT": "docs",
            "VERIFY": "test",
            "STANDARDIZE": "chore"
        }
        branch_type = action_to_type.get(task.action_type.value, "feature")
        
        # Generate description from task title
        description = task.title.lower()
        description = re.sub(r'[^a-z0-9\s-]', '', description)
        description = re.sub(r'\s+', '-', description)
        description = description[:50]  # Limit length
        
        # Use Jira ID if provided, otherwise use task ID
        if jira_id:
            return f"{branch_type}/{jira_id}-{description}"
        else:
            # Fallback: use task ID as identifier
            return f"{branch_type}/{task.id.lower()}-{description}"
    
    def _create_worktree(self, task: Task, branch_name: str) -> WorktreeInfo:
        """Create a new git worktree for the task."""
        worktree_path = self.worktrees_base / task.id
        
        # Create worktree
        try:
            # Create worktree from main branch
            subprocess.run(
                ["git", "worktree", "add", str(worktree_path), "main"],
                cwd=self.repo_root,
                check=True,
                capture_output=True
            )
            
            # Checkout new branch in worktree
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=worktree_path,
                check=True,
                capture_output=True
            )
            
            print(f"Created worktree: {worktree_path} on branch {branch_name}")
            
            return WorktreeInfo(
                task_id=task.id,
                worktree_path=worktree_path,
                branch_name=branch_name
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"Failed to create worktree for {task.id}: {e.stderr.decode()}"
            )
    
    def _verify_worktree(self, worktree_path: Path, expected_branch: str) -> None:
        """Verify worktree is valid and on expected branch."""
        if not worktree_path.exists():
            raise ValueError(f"Worktree path does not exist: {worktree_path}")
        
        # Check current branch
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=worktree_path,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise ValueError(f"Worktree is not a valid git repository: {worktree_path}")
        
        current_branch = result.stdout.strip()
        if current_branch != expected_branch:
            print(f"Warning: Worktree on branch {current_branch}, expected {expected_branch}")
    
    def remove_worktree(self, task_id: str, force: bool = False) -> None:
        """
        Remove worktree for a task.
        
        Args:
            task_id: Task ID
            force: Force removal even if there are uncommitted changes
        """
        worktree_path = self.worktrees_base / task_id
        
        if not worktree_path.exists():
            print(f"Worktree does not exist: {worktree_path}")
            return
        
        try:
            # Remove worktree
            cmd = ["git", "worktree", "remove"]
            if force:
                cmd.append("--force")
            cmd.append(str(worktree_path))
            
            subprocess.run(
                cmd,
                cwd=self.repo_root,
                check=True,
                capture_output=True
            )
            
            print(f"Removed worktree: {worktree_path}")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"Failed to remove worktree for {task_id}: {e.stderr.decode()}"
            )
    
    def list_worktrees(self) -> list[WorktreeInfo]:
        """List all active worktrees."""
        worktrees = []
        
        try:
            result = subprocess.run(
                ["git", "worktree", "list"],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=True
            )
            
            # Parse worktree list output
            # Format: "/path/to/worktree  [branch-name]"
            for line in result.stdout.strip().split('\n'):
                parts = line.strip().split()
                if len(parts) >= 2:
                    path = Path(parts[0])
                    branch = parts[1].strip('[]')
                    
                    # Check if this is one of our managed worktrees
                    if self.worktrees_base in path.parents:
                        task_id = path.name
                        worktrees.append(WorktreeInfo(
                            task_id=task_id,
                            worktree_path=path,
                            branch_name=branch
                        ))
        except subprocess.CalledProcessError:
            pass
        
        return worktrees


def ensure_worktree_for_task(
    task: Task,
    jira_id: Optional[str] = None
) -> Tuple[WorktreeInfo, bool]:
    """
    Convenience function to ensure worktree exists for a task.
    
    Args:
        task: Task object
        jira_id: Optional Jira ticket ID
        
    Returns:
        Tuple of (WorktreeInfo, created_new)
    """
    manager = WorktreeManager()
    return manager.ensure_worktree(task, jira_id)

