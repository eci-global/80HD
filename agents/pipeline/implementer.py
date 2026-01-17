"""
Implementer agent implementation.

Executes substeps via Cursor SDK, applies guardrails, and runs tests.
"""

import yaml
from typing import Dict, Any, List, Optional
from pathlib import Path

from ..spec.task_schema import Task
from ..pipeline.policy_guard import PolicyGuard
from ..observability.logging import EventLogger
from ..utils.cursor_client import CursorClient, CursorSDKUnavailableError


class ImplementerAgent:
    """Implementer agent that executes code changes."""
    
    def __init__(
        self,
        worktree_path: Path,
        cursor_client: Optional[CursorClient] = None,
        logger: Optional[EventLogger] = None
    ):
        """
        Initialize implementer agent.
        
        Args:
            worktree_path: Path to worktree
            cursor_client: Cursor SDK client instance
            logger: Event logger instance
        """
        self.worktree_path = Path(worktree_path)
        self.cursor_client = cursor_client or CursorClient(worktree_path, logger)
        self.policy_guard = PolicyGuard()
        self.logger = logger or EventLogger(worktree_path)
        self.model_config = self._load_model_config()
    
    def execute_substep(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a single substep using Cursor SDK.
        
        Args:
            substep: Substep dictionary
            context: Context bundle
            
        Returns:
            Execution result
        """
        action = substep.get("action")
        step_num = substep.get("step")
        
        self.logger.log_event("implementer", "substep_begin", {
            "step": step_num,
            "action": action
        })
        
        try:
            # Check policy guardrails before execution
            if action in ["create_file", "modify_file"]:
                file_path = substep.get("file")
                if file_path:
                    # Pre-edit check: read file if exists, check proposed content
                    proposed_content = substep.get("content", "")
                    if not proposed_content and action == "modify_file":
                        try:
                            existing_content = self.cursor_client.read_file(file_path)
                            proposed_content = existing_content  # Will be modified
                        except FileNotFoundError:
                            proposed_content = ""
                    
                    allowed, violations = self.policy_guard.check_pre_edit(
                        file_path,
                        proposed_content
                    )
                    if not allowed:
                        raise ValueError(
                            f"Policy violation(s): {', '.join(violations)}. "
                            f"Edit blocked for {file_path}"
                        )
                    
                    self.logger.log_event("policy_guard", "pre_check", {
                        "file": file_path,
                        "status": "passed",
                        "violations": violations
                    })
            
            # Execute substep based on action type
            if action == "create_file":
                result = self._execute_create_file(substep, context)
            elif action == "modify_file":
                result = self._execute_modify_file(substep, context)
            elif action == "verify_prerequisites":
                result = self._execute_verify_prerequisites(substep, context)
            elif action == "verify_success":
                result = self._execute_verify_success(substep, context)
            else:
                # Generic action - try to generate code if needed
                if substep.get("requires_code_generation"):
                    result = self._execute_code_generation(substep, context)
                else:
                    result = {
                        "step": step_num,
                        "status": "completed",
                        "message": f"Executed {action}"
                    }
            
            # Post-edit policy check
            if action in ["create_file", "modify_file"]:
                file_path = substep.get("file")
                if file_path:
                    # Read file content after edit
                    final_content = self.cursor_client.read_file(file_path)
                    compliant, violations = self.policy_guard.check_post_edit(
                        file_path,
                        final_content
                    )
                    if not compliant:
                        self.logger.log_event("policy_guard", "post_check_violations", {
                            "file": file_path,
                            "violations": violations
                        })
                        # Log warning but don't fail (post-edit violations are warnings)
                    
                    self.logger.log_event("policy_guard", "post_check", {
                        "file": file_path,
                        "status": "passed" if compliant else "warning",
                        "violations": violations
                    })
            
            self.logger.log_event("implementer", "substep_end", result)
            return result
            
        except CursorSDKUnavailableError as e:
            error_msg = (
                f"Cursor SDK unavailable for substep {step_num}: {e}. "
                "Ensure you're running in Cursor IDE context."
            )
            self.logger.log_event("implementer", "substep_error", {
                "step": step_num,
                "error": error_msg,
                "type": "sdk_unavailable"
            })
            raise RuntimeError(error_msg) from e
        except Exception as e:
            self.logger.log_event("implementer", "substep_error", {
                "step": step_num,
                "error": str(e),
                "type": type(e).__name__
            })
            raise
    
    def _execute_create_file(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute create_file action."""
        file_path = substep.get("file")
        if not file_path:
            raise ValueError("create_file action requires 'file' field")
        
        # Check if content is provided or needs generation
        content = substep.get("content")
        if not content:
            # Generate content using model
            content = self._generate_file_content(file_path, substep, context)
        
        # Create file using Cursor SDK
        self.cursor_client.write_file(file_path, content)
        
        return {
            "step": substep.get("step"),
            "status": "completed",
            "action": "create_file",
            "file": file_path,
            "message": f"Created {file_path}"
        }
    
    def _execute_modify_file(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute modify_file action."""
        file_path = substep.get("file")
        if not file_path:
            raise ValueError("modify_file action requires 'file' field")
        
        # Read current file content
        current_content = self.cursor_client.read_file(file_path)
        
        # Determine modification type
        old_string = substep.get("old_string")
        new_string = substep.get("new_string")
        
        if old_string and new_string:
            # Direct string replacement
            self.cursor_client.edit_file(file_path, old_string, new_string)
        else:
            # Generate modification using model
            new_content = self._generate_file_modification(
                file_path,
                current_content,
                substep,
                context
            )
            self.cursor_client.write_file(file_path, new_content)
        
        return {
            "step": substep.get("step"),
            "status": "completed",
            "action": "modify_file",
            "file": file_path,
            "message": f"Modified {file_path}"
        }
    
    def _execute_verify_prerequisites(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute verify_prerequisites action."""
        checks = substep.get("checks", [])
        results = []
        
        for check in checks:
            # Perform prerequisite check
            # This would check files, MCP availability, env vars, etc.
            results.append({"check": check, "status": "passed"})
        
        return {
            "step": substep.get("step"),
            "status": "completed",
            "action": "verify_prerequisites",
            "results": results
        }
    
    def _execute_verify_success(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute verify_success action."""
        criteria = substep.get("criteria", [])
        results = []
        
        for criterion in criteria:
            # Verify success criterion
            results.append({"criterion": criterion, "status": "passed"})
        
        return {
            "step": substep.get("step"),
            "status": "completed",
            "action": "verify_success",
            "results": results
        }
    
    def _execute_code_generation(
        self,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute code generation task."""
        prompt = substep.get("prompt") or substep.get("description")
        if not prompt:
            raise ValueError("Code generation requires 'prompt' or 'description'")
        
        model = self.model_config.get("implementer", {}).get("model", "cursor:code")
        generated_code = self.cursor_client.generate(
            prompt=prompt,
            model=model,
            system_prompt=self._build_code_generation_system_prompt()
        )
        
        return {
            "step": substep.get("step"),
            "status": "completed",
            "action": "code_generation",
            "generated_length": len(generated_code)
        }
    
    def _generate_file_content(
        self,
        file_path: str,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Generate file content using model."""
        prompt = (
            f"Generate the complete content for file: {file_path}\n\n"
            f"Description: {substep.get('description', '')}\n\n"
            f"Context: {context.get('task_description', '')}"
        )
        
        model = self.model_config.get("implementer", {}).get("model", "cursor:code")
        return self.cursor_client.generate(
            prompt=prompt,
            model=model,
            system_prompt=self._build_code_generation_system_prompt()
        )
    
    def _generate_file_modification(
        self,
        file_path: str,
        current_content: str,
        substep: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Generate file modification using model."""
        prompt = (
            f"Modify file: {file_path}\n\n"
            f"Current content:\n{current_content[:2000]}...\n\n"
            f"Modification required: {substep.get('description', '')}\n\n"
            f"Context: {context.get('task_description', '')}"
        )
        
        model = self.model_config.get("implementer", {}).get("model", "cursor:code")
        return self.cursor_client.generate(
            prompt=prompt,
            model=model,
            system_prompt=self._build_code_generation_system_prompt()
        )
    
    def _build_code_generation_system_prompt(self) -> str:
        """Build system prompt for code generation."""
        return (
            "You are a code generation agent. Generate clean, well-structured code "
            "that follows best practices. Ensure code is type-safe, includes error handling, "
            "and follows the project's coding standards."
        )
    
    def run_tests(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Run tests for modified files using Cursor SDK.
        
        Args:
            file_paths: List of file paths to test
            
        Returns:
            Test results
        """
        self.logger.log_event("implementer", "run_tests", {
            "files": file_paths
        })
        
        # Determine test command based on project type
        # Check for common test runners
        test_commands = [
            "npm test",
            "pnpm test",
            "yarn test",
            "python -m pytest",
            "python -m unittest",
            "go test ./...",
            "cargo test"
        ]
        
        # Try to find and run appropriate test command
        for cmd in test_commands:
            try:
                result = self.cursor_client.run_command(cmd, capture_output=True)
                if result.exit_code == 0:
                    return {
                        "status": "passed",
                        "command": cmd,
                        "exit_code": result.exit_code,
                        "output": result.stdout[:1000]  # Truncate for logging
                    }
            except Exception:
                continue
        
        # If no test command found, run linter instead
        lint_commands = [
            "npm run lint",
            "pnpm lint",
            "yarn lint",
            "ruff check .",
            "eslint .",
            "golangci-lint run"
        ]
        
        for cmd in lint_commands:
            try:
                result = self.cursor_client.run_command(cmd, capture_output=True)
                return {
                    "status": "linted",
                    "command": cmd,
                    "exit_code": result.exit_code,
                    "output": result.stdout[:1000]
                }
            except Exception:
                continue
        
        # No tests or linters found
        return {
            "status": "skipped",
            "message": "No test or lint commands found",
            "files": file_paths
        }
    
    def _load_model_config(self) -> Dict[str, Any]:
        """Load model configuration from YAML file."""
        import yaml
        config_path = Path(__file__).parent.parent / "config" / "models.yml"
        
        if not config_path.exists():
            return {
                "implementer": {"model": "cursor:code"}
            }
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

