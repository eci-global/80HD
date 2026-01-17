"""
Context gathering utilities for packaging information for agent prompts.

Assembles consistent context bundles including:
- Spec excerpts from plan
- File snippets from codebase
- MCP availability status
- Policy constraints
- Current worktree state
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

from ..spec.task_schema import Task
from ..utils.mcp_helpers import check_mcp_availability


@dataclass
class ContextBundle:
    """Structured context bundle for agent prompts."""
    
    # Task information
    task_id: str
    task_title: str
    task_description: str
    task_category: str
    action_type: str
    
    # Spec excerpt
    spec_excerpt: str
    
    # File information
    relevant_files: List[Dict[str, Any]]  # List of {path, content_snippet, line_range}
    
    # Policy constraints
    applicable_policies: List[Dict[str, Any]]  # List of policy objects
    
    # MCP availability
    mcp_status: Dict[str, bool]  # {service: available}
    
    # Worktree information
    worktree_path: Optional[str] = None
    branch_name: Optional[str] = None
    
    # Implementation details
    implementation_steps: List[str] = None
    success_criteria: List[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    def to_prompt_context(self) -> str:
        """Format as prompt context string for agent."""
        lines = [
            f"# Task: {self.task_id} - {self.task_title}",
            f"Category: {self.task_category}",
            f"Action Type: {self.action_type}",
            "",
            "## Description",
            self.task_description,
            "",
            "## Spec Excerpt",
            self.spec_excerpt,
            "",
        ]
        
        if self.implementation_steps:
            lines.extend([
                "## Implementation Steps",
                *[f"{i+1}. {step}" for i, step in enumerate(self.implementation_steps)],
                "",
            ])
        
        if self.success_criteria:
            lines.extend([
                "## Success Criteria",
                *[f"- {criterion}" for criterion in self.success_criteria],
                "",
            ])
        
        if self.relevant_files:
            lines.append("## Relevant Files")
            for file_info in self.relevant_files:
                lines.append(f"\n### {file_info['path']}")
                if file_info.get('line_range'):
                    lines.append(f"Lines: {file_info['line_range']}")
                if file_info.get('content_snippet'):
                    lines.append("```")
                    lines.append(file_info['content_snippet'])
                    lines.append("```")
            lines.append("")
        
        if self.applicable_policies:
            lines.append("## Policy Constraints")
            for policy in self.applicable_policies:
                lines.append(f"\n### {policy['id']}: {policy['description']}")
                if policy.get('severity') == 'block':
                    lines.append("⚠️ BLOCKING: This policy must be followed.")
            lines.append("")
        
        if self.mcp_status:
            lines.append("## MCP Server Availability")
            for service, available in self.mcp_status.items():
                status = "✅ Available" if available else "❌ Unavailable"
                lines.append(f"- {service}: {status}")
            lines.append("")
        
        if self.worktree_path:
            lines.extend([
                "## Worktree Information",
                f"Path: {self.worktree_path}",
                f"Branch: {self.branch_name}",
                "",
            ])
        
        return "\n".join(lines)


class ContextGatherer:
    """Gathers and packages context for agent prompts."""
    
    def __init__(self, repo_root: Optional[Path] = None):
        """
        Initialize context gatherer.
        
        Args:
            repo_root: Path to repository root (defaults to parent of agents/)
        """
        if repo_root is None:
            repo_root = Path(__file__).parent.parent.parent
        self.repo_root = Path(repo_root)
        self.policies_path = self.repo_root / "agents" / "config" / "policies.json"
    
    def gather_context(
        self,
        task: Task,
        worktree_path: Optional[str] = None,
        branch_name: Optional[str] = None,
        max_file_lines: int = 100
    ) -> ContextBundle:
        """
        Gather complete context bundle for a task.
        
        Args:
            task: Task object to gather context for
            worktree_path: Path to worktree (if task is in progress)
            branch_name: Branch name for worktree
            max_file_lines: Maximum lines to include per file snippet
            
        Returns:
            ContextBundle with all gathered context
        """
        # Load policies
        policies = self._load_policies()
        applicable_policies = self._filter_applicable_policies(policies, task)
        
        # Check MCP availability
        mcp_status = check_mcp_availability()
        
        # Gather file snippets
        relevant_files = self._gather_file_snippets(task, max_file_lines, worktree_path)
        
        # Build spec excerpt
        spec_excerpt = self._build_spec_excerpt(task)
        
        # Extract success criteria
        success_criteria = [c.description for c in task.success_criteria]
        
        return ContextBundle(
            task_id=task.id,
            task_title=task.title,
            task_description=task.description,
            task_category=task.category,
            action_type=task.action_type.value,
            spec_excerpt=spec_excerpt,
            relevant_files=relevant_files,
            applicable_policies=applicable_policies,
            mcp_status=mcp_status,
            worktree_path=worktree_path,
            branch_name=branch_name,
            implementation_steps=task.implementation_steps,
            success_criteria=success_criteria
        )
    
    def _load_policies(self) -> Dict[str, Any]:
        """Load policies from JSON file."""
        if not self.policies_path.exists():
            return {}
        
        with open(self.policies_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('policies', {})
    
    def _filter_applicable_policies(
        self,
        policies: Dict[str, Any],
        task: Task
    ) -> List[Dict[str, Any]]:
        """Filter policies applicable to this task."""
        applicable = []
        
        # Always include critical policies
        critical_policy_ids = [
            'noMockData',
            'failFastErrors',
            'vercelAISDKOnly',
            'mcpFirst',
            'typescriptOnly',
            'rlsSecurity'
        ]
        
        for policy_id in critical_policy_ids:
            if policy_id in policies:
                policy = policies[policy_id].copy()
                policy['id'] = policy_id
                applicable.append(policy)
        
        # Add task-specific policies
        if task.action_type.value == "IMPLEMENT":
            # Implementation tasks need all code quality policies
            for policy_id, policy in policies.items():
                if policy_id not in [p['id'] for p in applicable]:
                    policy_copy = policy.copy()
                    policy_copy['id'] = policy_id
                    applicable.append(policy_copy)
        
        return applicable
    
    def _gather_file_snippets(
        self,
        task: Task,
        max_lines: int,
        worktree_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Gather file content snippets for relevant files."""
        files = []
        base_path = Path(worktree_path) if worktree_path else self.repo_root
        
        # Collect all file paths from task
        all_files = []
        for file_op in task.files_to_create:
            all_files.append((file_op.path, "create"))
        for file_op in task.files_to_modify:
            all_files.append((file_op.path, "modify"))
        
        for file_path, operation in all_files:
            full_path = base_path / file_path
            
            if not full_path.exists():
                # File doesn't exist yet (will be created)
                files.append({
                    'path': file_path,
                    'operation': operation,
                    'exists': False,
                    'content_snippet': None
                })
                continue
            
            # Read file content
            try:
                content = full_path.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                # Include first max_lines or all if shorter
                snippet_lines = lines[:max_lines]
                snippet = '\n'.join(snippet_lines)
                
                if len(lines) > max_lines:
                    snippet += f"\n... ({len(lines) - max_lines} more lines)"
                
                files.append({
                    'path': file_path,
                    'operation': operation,
                    'exists': True,
                    'content_snippet': snippet,
                    'line_range': f"1-{min(max_lines, len(lines))}",
                    'total_lines': len(lines)
                })
            except Exception as e:
                files.append({
                    'path': file_path,
                    'operation': operation,
                    'exists': True,
                    'error': str(e),
                    'content_snippet': None
                })
        
        return files
    
    def _build_spec_excerpt(self, task: Task) -> str:
        """Build spec excerpt from task information."""
        lines = [
            f"Task ID: {task.id}",
            f"Title: {task.title}",
            f"Category: {task.category}",
            f"Action: {task.action_type.value}",
            "",
            task.description,
        ]
        
        if task.implementation_steps:
            lines.extend([
                "",
                "Implementation Steps:",
                *[f"  {i+1}. {step}" for i, step in enumerate(task.implementation_steps)]
            ])
        
        if task.error_handling:
            lines.extend([
                "",
                "Error Handling Requirements:",
                f"  {task.error_handling}"
            ])
        
        return "\n".join(lines)


def gather_context_for_task(
    task: Task,
    worktree_path: Optional[str] = None,
    branch_name: Optional[str] = None
) -> ContextBundle:
    """
    Convenience function to gather context for a task.
    
    Args:
        task: Task object
        worktree_path: Optional worktree path
        branch_name: Optional branch name
        
    Returns:
        ContextBundle with all context
    """
    gatherer = ContextGatherer()
    return gatherer.gather_context(task, worktree_path, branch_name)

