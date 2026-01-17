"""
Type definitions for task objects parsed from plan specs.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum


class ActionType(str, Enum):
    """Types of actions a task can require."""
    IMPLEMENT = "IMPLEMENT"
    DOCUMENT = "DOCUMENT"
    VERIFY = "VERIFY"
    STANDARDIZE = "STANDARDIZE"


class TaskStatus(str, Enum):
    """Status of a task in the pipeline."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"


@dataclass
class FileOperation:
    """Represents a file operation (create/modify)."""
    path: str
    operation: str  # "create" or "modify"
    description: Optional[str] = None


@dataclass
class SuccessCriterion:
    """A success criterion for task completion."""
    description: str
    verification_method: Optional[str] = None  # e.g., "test", "lint", "manual"


@dataclass
class Task:
    """Represents a task parsed from the plan spec."""
    id: str  # e.g., "Q1", "Q2"
    title: str
    category: str  # e.g., "Critical Code Fixes"
    action_type: ActionType
    description: str
    
    # Files involved
    files_to_create: List[FileOperation] = None
    files_to_modify: List[FileOperation] = None
    
    # Implementation details
    implementation_steps: List[str] = None
    integration_points: List[str] = None
    
    # Success criteria
    success_criteria: List[SuccessCriterion] = None
    
    # Error handling requirements
    error_handling: Optional[str] = None
    
    # Testing requirements
    testing_requirements: Optional[str] = None
    
    # Dependencies
    depends_on: List[str] = None  # Task IDs this depends on
    
    # Status tracking
    status: TaskStatus = TaskStatus.PENDING
    
    # Metadata
    priority: int = 0  # Lower = higher priority
    phase: Optional[str] = None  # e.g., "Phase 1: Critical Blockers"
    
    def __post_init__(self):
        """Initialize empty lists if None."""
        if self.files_to_create is None:
            self.files_to_create = []
        if self.files_to_modify is None:
            self.files_to_modify = []
        if self.implementation_steps is None:
            self.implementation_steps = []
        if self.integration_points is None:
            self.integration_points = []
        if self.success_criteria is None:
            self.success_criteria = []
        if self.depends_on is None:
            self.depends_on = []


@dataclass
class PlanSpec:
    """Complete plan specification with all tasks."""
    title: str
    tasks: List[Task]
    phases: Dict[str, List[str]] = None  # Phase name -> list of task IDs
    
    def __post_init__(self):
        """Initialize phases dict if None."""
        if self.phases is None:
            self.phases = {}
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        for task in self.tasks:
            if task.id == task_id:
                return task
        return None
    
    def get_pending_tasks(self) -> List[Task]:
        """Get all pending tasks."""
        return [t for t in self.tasks if t.status == TaskStatus.PENDING]
    
    def get_tasks_by_phase(self, phase: str) -> List[Task]:
        """Get all tasks in a specific phase."""
        task_ids = self.phases.get(phase, [])
        return [t for t in self.tasks if t.id in task_ids]

