"""
Metadata store for tracking task worktree state.

Maintains a registry of active worktrees and their metadata.
"""

import json
from pathlib import Path
from typing import Dict, Optional, Any
from datetime import datetime

from .manager import WorktreeInfo


class MetadataStore:
    """Stores and retrieves task metadata."""
    
    def __init__(self, state_dir: Optional[Path] = None):
        """
        Initialize metadata store.
        
        Args:
            state_dir: Directory for state files (defaults to agents/.state)
        """
        if state_dir is None:
            repo_root = Path(__file__).parent.parent.parent
            state_dir = repo_root / "agents" / ".state"
        
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.tasks_file = self.state_dir / "tasks.json"
    
    def register_task(
        self,
        task_id: str,
        worktree_info: WorktreeInfo,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Register a task with its worktree information.
        
        Args:
            task_id: Task ID
            worktree_info: WorktreeInfo object
            metadata: Additional metadata to store
        """
        tasks = self._load_tasks()
        
        tasks[task_id] = {
            "task_id": task_id,
            "worktree_path": str(worktree_info.worktree_path),
            "branch_name": worktree_info.branch_name,
            "base_branch": worktree_info.base_branch,
            "status": worktree_info.status,
            "registered_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self._save_tasks(tasks)
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task metadata by ID."""
        tasks = self._load_tasks()
        return tasks.get(task_id)
    
    def update_task_status(self, task_id: str, status: str) -> None:
        """Update task status."""
        tasks = self._load_tasks()
        if task_id in tasks:
            tasks[task_id]["status"] = status
            tasks[task_id]["updated_at"] = datetime.now().isoformat()
            self._save_tasks(tasks)
    
    def unregister_task(self, task_id: str) -> None:
        """Remove task from registry."""
        tasks = self._load_tasks()
        if task_id in tasks:
            del tasks[task_id]
            self._save_tasks(tasks)
    
    def list_active_tasks(self) -> Dict[str, Dict[str, Any]]:
        """List all active tasks."""
        tasks = self._load_tasks()
        return {tid: task for tid, task in tasks.items() if task.get("status") == "active"}
    
    def _load_tasks(self) -> Dict[str, Dict[str, Any]]:
        """Load tasks from JSON file."""
        if not self.tasks_file.exists():
            return {}
        
        try:
            with open(self.tasks_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    
    def _save_tasks(self, tasks: Dict[str, Dict[str, Any]]) -> None:
        """Save tasks to JSON file."""
        with open(self.tasks_file, 'w', encoding='utf-8') as f:
            json.dump(tasks, f, indent=2, ensure_ascii=False)

