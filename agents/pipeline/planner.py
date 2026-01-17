"""
Planner agent implementation.

Generates ordered substeps from task spec and packages context bundles
using deterministic prompts and model selection.
"""

import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..spec.task_schema import Task
from ..pipeline.context_gatherer import ContextGatherer, ContextBundle
from ..utils.cursor_client import CursorClient
from ..observability.logging import EventLogger
# Model config loaded via function below


class PlannerAgent:
    """Planner agent that generates execution plans from task specs."""
    
    def __init__(
        self,
        repo_root: Optional[Path] = None,
        cursor_client: Optional[CursorClient] = None,
        logger: Optional[EventLogger] = None
    ):
        """
        Initialize planner agent.
        
        Args:
            repo_root: Path to repository root
            cursor_client: Cursor SDK client instance
            logger: Event logger instance
        """
        self.repo_root = repo_root or Path(__file__).parent.parent.parent
        self.context_gatherer = ContextGatherer(self.repo_root)
        self.model_config = self._load_model_config()
        self.cursor_client = cursor_client
        self.logger = logger
    
    def plan(
        self,
        task: Task,
        worktree_path: Optional[str] = None,
        branch_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate execution plan for a task.
        
        Args:
            task: Task object
            worktree_path: Path to worktree
            branch_name: Branch name
            
        Returns:
            Plan bundle with substeps and context
        """
        # Gather context
        context = self.context_gatherer.gather_context(
            task,
            worktree_path=worktree_path,
            branch_name=branch_name
        )
        
        # Generate ordered substeps from task
        substeps = self._generate_substeps(task, context)
        
        # Build plan bundle
        plan_bundle = {
            "task_id": task.id,
            "task_title": task.title,
            "context": context.to_dict(),
            "substeps": substeps,
            "model": self.model_config["planner"]["model"],
            "prompt_template": "planner_deterministic"
        }
        
        return plan_bundle
    
    def _generate_substeps(self, task: Task, context: ContextBundle) -> List[Dict[str, Any]]:
        """
        Generate ordered substeps from task specification.
        
        Uses Cursor SDK model generation if available, otherwise falls back to
        rule-based generation.
        
        Args:
            task: Task object
            context: Context bundle
            
        Returns:
            List of substep dictionaries
        """
        # If cursor_client available, use model generation
        if self.cursor_client:
            try:
                model = self.model_config.get("planner", {}).get("model", "openai:gpt-4o")
                prompt = self._build_substep_prompt(task, context)
                
                if self.logger:
                    self.logger.log_event("planner", "generate_substeps", {
                        "task_id": task.id,
                        "model": model,
                        "prompt_length": len(prompt)
                    })
                
                # Generate substeps using model
                generated_text = self.cursor_client.generate(
                    prompt=prompt,
                    model=model,
                    system_prompt=self._build_system_prompt(),
                    response_format="json"
                )
                
                # Parse generated substeps (would need JSON parsing here)
                # For now, fall through to rule-based generation
                # TODO: Parse JSON response and convert to substep list
                
            except Exception as e:
                if self.logger:
                    self.logger.log_event("planner", "generate_substeps_error", {
                        "task_id": task.id,
                        "error": str(e),
                        "fallback": "rule_based"
                    })
                # Fall through to rule-based generation
        
        # Rule-based substep generation (fallback or default)
        return self._generate_substeps_rule_based(task)
    
    def _generate_substeps_rule_based(self, task: Task) -> List[Dict[str, Any]]:
        """
        Generate substeps using rule-based logic (fallback).
        
        Args:
            task: Task object
            
        Returns:
            List of substep dictionaries
        """
        substeps = []
        
        # Step 1: Verify prerequisites
        substeps.append({
            "step": 1,
            "action": "verify_prerequisites",
            "description": "Verify all prerequisites are met",
            "checks": [
                "Check if required files exist",
                "Verify MCP availability",
                "Check environment variables"
            ]
        })
        
        # Step 2-N: File operations
        step_num = 2
        for file_op in task.files_to_create:
            substeps.append({
                "step": step_num,
                "action": "create_file",
                "file": file_op.path,
                "description": f"Create {file_op.path}",
                "operation": "create"
            })
            step_num += 1
        
        for file_op in task.files_to_modify:
            substeps.append({
                "step": step_num,
                "action": "modify_file",
                "file": file_op.path,
                "description": f"Modify {file_op.path}",
                "operation": "modify"
            })
            step_num += 1
        
        # Final step: Verify success criteria
        substeps.append({
            "step": step_num,
            "action": "verify_success",
            "description": "Verify all success criteria are met",
            "criteria": [c.description for c in task.success_criteria]
        })
        
        return substeps
    
    def _build_substep_prompt(self, task: Task, context: ContextBundle) -> str:
        """
        Build deterministic prompt for substep generation.
        
        Args:
            task: Task object
            context: Context bundle
            
        Returns:
            Prompt string
        """
        prompt_parts = [
            f"Task: {task.title}",
            f"Description: {task.description}",
            "",
            "Context:",
            f"- Files to create: {len(task.files_to_create)}",
            f"- Files to modify: {len(task.files_to_modify)}",
            f"- Success criteria: {len(task.success_criteria)}",
            "",
            "Generate an ordered list of substeps to complete this task.",
            "Each substep should be actionable and specific.",
            "Return as JSON array of substep objects with: step, action, description, file (if applicable)."
        ]
        
        return "\n".join(prompt_parts)
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for planner agent."""
        return (
            "You are a planning agent that generates ordered, actionable substeps "
            "for software development tasks. Be specific, deterministic, and ensure "
            "each substep can be executed independently."
        )


    def _load_model_config(self) -> Dict[str, Any]:
        """Load model configuration from YAML file."""
        config_path = Path(__file__).parent.parent / "config" / "models.yml"
        
        if not config_path.exists():
            # Return defaults
            return {
                "planner": {"model": "openai:gpt-4o"},
                "implementer": {"model": "cursor:code"},
                "verifier": {"model": "openai:gpt-4.1-mini"}
            }
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

