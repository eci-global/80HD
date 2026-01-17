#!/usr/bin/env python3
"""
Main CLI orchestrator for agent automation framework.

Usage:
    python agents/control.py --list                    # List available tasks
    python agents/control.py --task Q2                 # Run specific task
    python agents/control.py --resume <branch>         # Resume existing worktree
    python agents/control.py --log <task-id>           # View logs for task
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

# Add agents directory to path
sys.path.insert(0, str(Path(__file__).parent))

from spec.plan_loader import load_plan, PlanLoader
from spec.task_schema import TaskStatus, Task
from worktree.manager import WorktreeManager, ensure_worktree_for_task
from worktree.metadata_store import MetadataStore
from worktree.env_setup import setup_env_for_worktree
from utils.cursor_client import CursorClient, CursorSDKUnavailableError
from observability.logging import EventLogger
from pipeline.planner import PlannerAgent
from pipeline.implementer import ImplementerAgent
from pipeline.verifier import VerifierAgent


class TaskRouter:
    """Routes tasks and manages task selection."""
    
    def __init__(self, plan_spec):
        """
        Initialize task router.
        
        Args:
            plan_spec: PlanSpec object with all tasks
        """
        self.plan_spec = plan_spec
        self.metadata_store = MetadataStore()
    
    def select_task(self, task_id: Optional[str] = None) -> tuple[Optional[str], Optional[Task]]:
        """
        Select a task to execute.
        
        Args:
            task_id: Specific task ID to select (e.g., "Q2"), or None to auto-select
            
        Returns:
            Tuple of (task_id, task) or (None, None) if no task available
        """
        if task_id:
            task = self.plan_spec.get_task(task_id)
            if not task:
                print(f"Error: Task {task_id} not found in plan.")
                return None, None
            return task_id, task
        
        # Auto-select: find first pending task
        pending_tasks = self.plan_spec.get_pending_tasks()
        if not pending_tasks:
            print("No pending tasks found.")
            return None, None
        
        # Sort by priority (lower = higher priority)
        pending_tasks.sort(key=lambda t: t.priority)
        task = pending_tasks[0]
        
        return task.id, task
    
    def print_available_tasks(self):
        """Print all available tasks with their status."""
        print("\nAvailable Tasks:")
        print("=" * 80)
        
        # Group by phase
        for phase_name, task_ids in self.plan_spec.phases.items():
            print(f"\n{phase_name}:")
            for task_id in task_ids:
                task = self.plan_spec.get_task(task_id)
                if task:
                    status_icon = {
                        TaskStatus.PENDING: "⏳",
                        TaskStatus.IN_PROGRESS: "🔄",
                        TaskStatus.COMPLETED: "✅",
                        TaskStatus.BLOCKED: "🚫",
                        TaskStatus.FAILED: "❌"
                    }.get(task.status, "❓")
                    
                    print(f"  {status_icon} {task.id}: {task.title}")
                    print(f"     Category: {task.category}")
                    print(f"     Action: {task.action_type.value}")
                    if task.files_to_create or task.files_to_modify:
                        print(f"     Files: {len(task.files_to_create)} create, {len(task.files_to_modify)} modify")
        
        print("\n" + "=" * 80)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Agent Automation Framework - Execute implementation plans",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--task",
        help="Run specific task ID (e.g., Q2)"
    )
    
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available tasks"
    )
    
    parser.add_argument(
        "--resume",
        help="Resume existing worktree by branch name"
    )
    
    parser.add_argument(
        "--log",
        help="View logs for a specific task ID"
    )
    
    parser.add_argument(
        "--plan",
        default="80.plan.md",
        help="Path to plan file (default: 80.plan.md)"
    )
    
    args = parser.parse_args()
    
    # Load plan
    try:
        loader = PlanLoader(args.plan)
        plan_spec = loader.load()
        print(f"Loaded plan: {plan_spec.title}")
        print(f"Found {len(plan_spec.tasks)} tasks")
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error loading plan: {e}", file=sys.stderr)
        sys.exit(1)
    
    router = TaskRouter(plan_spec)
    
    # Handle commands
    if args.list:
        router.print_available_tasks()
        return
    
    if args.log:
        # TODO: Implement log viewing
        print(f"Log viewing for task {args.log} not yet implemented.")
        print("Logs will be stored in worktrees/<task-id>/.agent/log.jsonl")
        return
    
    if args.resume:
        # TODO: Implement resume logic
        print(f"Resume functionality for branch {args.resume} not yet implemented.")
        print("This will load existing worktree and continue from last checkpoint.")
        return
    
    # Select and run task
    task_id, task = router.select_task(args.task)
    
    if not task:
        print("No task selected. Use --list to see available tasks.")
        sys.exit(1)
    
    print(f"\nSelected task: {task.id} - {task.title}")
    print(f"Category: {task.category}")
    print(f"Action: {task.action_type.value}")
    print(f"Status: {task.status.value}")
    
    # Initialize worktree and run pipeline
    try:
        # Create worktree for task
        repo_root = Path(__file__).parent.parent
        worktree_info, created = ensure_worktree_for_task(task)
        worktree_path = worktree_info.worktree_path
        print(f"\nWorktree {'created' if created else 'resumed'}: {worktree_path}")
        
        # Setup environment for worktree
        setup_env_for_worktree(worktree_path)
        
        # Initialize logger
        logger = EventLogger(worktree_path)
        
        # Initialize Cursor client with worktree context
        try:
            cursor_client = CursorClient(worktree_path, logger)
            print("Cursor SDK client initialized")
        except CursorSDKUnavailableError as e:
            print(f"Warning: {e}")
            print("Continuing with fallback file operations...")
            cursor_client = CursorClient(worktree_path, logger)
        
        # Initialize agents with cursor_client
        planner = PlannerAgent(
            repo_root=repo_root,
            cursor_client=cursor_client,
            logger=logger
        )
        
        implementer = ImplementerAgent(
            worktree_path=worktree_path,
            cursor_client=cursor_client,
            logger=logger
        )
        
        print("\nRunning planner agent...")
        plan_bundle = planner.plan(
            task,
            worktree_path=str(worktree_path),
            branch_name=worktree_info.branch_name
        )
        
        print(f"Generated {len(plan_bundle.get('substeps', []))} substeps")
        
        # Execute substeps via implementer
        print("\nRunning implementer agent...")
        execution_results = []
        for substep in plan_bundle.get('substeps', []):
            print(f"  Executing substep {substep.get('step')}: {substep.get('action')}")
            try:
                result = implementer.execute_substep(
                    substep,
                    plan_bundle.get('context', {})
                )
                execution_results.append(result)  # Collect result for verifier
                print(f"    ✓ {result.get('message', 'Completed')}")
            except Exception as e:
                print(f"    ✗ Error: {e}")
                logger.log_event("pipeline", "substep_failed", {
                    "substep": substep.get('step'),
                    "error": str(e)
                })
                raise
        
        # Run tests
        modified_files = [
            s.get('file') for s in plan_bundle.get('substeps', [])
            if s.get('file') and s.get('action') in ['create_file', 'modify_file']
        ]
        if modified_files:
            print("\nRunning tests...")
            test_results = implementer.run_tests(modified_files)
            print(f"  Test status: {test_results.get('status')}")
        
        # Run verifier agent
        print("\nRunning verifier agent...")
        verifier = VerifierAgent(
            worktree_path=worktree_path,
            logger=logger
        )
        
        verification_report = verifier.verify(task, execution_results)
        print(f"  Verification status: {verification_report.get('status')}")
        if verification_report.get('status') != 'completed':
            print(f"  Warnings:")
            print(f"    Success criteria met: {verification_report.get('success_criteria_met')}")
            print(f"    Documentation updated: {verification_report.get('documentation_updated')}")
        
        print("\n✓ Pipeline execution completed successfully!")
        print(f"  Worktree: {worktree_path}")
        print(f"  Logs: {worktree_path}/.agent/log.jsonl")
        print(f"  Verification report: {worktree_path}/.agent/verifier_report.json")
        
    except CursorSDKUnavailableError as e:
        print(f"\nError: {e}", file=sys.stderr)
        print("\nTo use Cursor SDK features, ensure you're running in Cursor IDE context.")
        print("File operations will use standard Python libraries as fallback.")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during pipeline execution: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

