"""
Cursor SDK client wrapper for agent operations.

Provides clean abstraction over Cursor SDK primitives for file operations,
command execution, and model generation. All operations are scoped to a worktree path.
"""

import os
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass

# Note: Cursor SDK is available when running in Cursor IDE context
# For file operations, we use standard Python libraries
# For model calls, we'll need to use Cursor's API or a bridge
# This implementation provides the interface, actual Cursor SDK integration
# will be added when running in Cursor IDE context


@dataclass
class CommandResult:
    """Result of a command execution."""
    exit_code: int
    stdout: str
    stderr: str
    command: str


class CursorSDKUnavailableError(Exception):
    """Raised when Cursor SDK is not available."""
    
    def __init__(self, operation: str):
        super().__init__(
            f"Cursor SDK unavailable for operation: {operation}. "
            "This code must run in Cursor IDE context. "
            "For file operations, ensure you're running from within Cursor IDE."
        )


class CursorClient:
    """
    Client wrapper for Cursor SDK operations.
    
    Provides file operations, command execution, and model generation
    with worktree path context.
    """
    
    def __init__(self, worktree_path: Path, logger=None):
        """
        Initialize Cursor client.
        
        Args:
            worktree_path: Path to worktree directory (all operations relative to this)
            logger: Optional EventLogger instance for command output logging
        """
        self.worktree_path = Path(worktree_path).resolve()
        self.logger = logger
        self._cursor_sdk_available = self._check_cursor_sdk_available()
    
    def _check_cursor_sdk_available(self) -> bool:
        """
        Check if Cursor SDK is available.
        
        In Cursor IDE, certain environment variables or context may be available.
        For now, we assume SDK is available if running in Cursor context.
        """
        # Check for Cursor-specific environment indicators
        cursor_indicators = [
            'CURSOR_SESSION_ID',
            'CURSOR_WORKSPACE',
            'CURSOR_API_URL'
        ]
        
        # If any Cursor indicator exists, assume SDK available
        if any(os.getenv(indicator) for indicator in cursor_indicators):
            return True
        
        # Also check if we're in a Cursor workspace (heuristic)
        # Cursor IDE typically sets up workspace in a specific way
        # For now, assume available - actual checks will happen at operation time
        return True
    
    def _resolve_path(self, file_path: str) -> Path:
        """
        Resolve file path relative to worktree.
        
        Args:
            file_path: Relative or absolute file path
            
        Returns:
            Resolved absolute path
        """
        path = Path(file_path)
        if path.is_absolute():
            return path
        return self.worktree_path / path
    
    def read_file(self, file_path: str) -> str:
        """
        Read file contents using Cursor SDK or fallback to standard Python.
        
        Args:
            file_path: Path to file (relative to worktree or absolute)
            
        Returns:
            File contents as string
            
        Raises:
            FileNotFoundError: If file doesn't exist
            CursorSDKUnavailableError: If Cursor SDK required but unavailable
        """
        resolved_path = self._resolve_path(file_path)
        
        if not resolved_path.exists():
            raise FileNotFoundError(
                f"File not found: {file_path} (resolved to {resolved_path}). "
                f"Worktree path: {self.worktree_path}"
            )
        
        try:
            # In Cursor IDE context, we could use Cursor SDK read_file
            # For now, use standard Python file reading
            # TODO: Integrate with actual Cursor SDK when available
            return resolved_path.read_text(encoding='utf-8')
        except Exception as e:
            raise RuntimeError(
                f"Failed to read file {file_path}: {e}. "
                "Ensure file exists and is readable."
            )
    
    def write_file(self, file_path: str, content: str) -> None:
        """
        Write file contents using Cursor SDK or fallback to standard Python.
        
        Args:
            file_path: Path to file (relative to worktree or absolute)
            content: Content to write
            
        Raises:
            CursorSDKUnavailableError: If Cursor SDK required but unavailable
        """
        resolved_path = self._resolve_path(file_path)
        
        # Ensure parent directory exists
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # In Cursor IDE context, we could use Cursor SDK write_file
            # For now, use standard Python file writing
            # TODO: Integrate with actual Cursor SDK when available
            resolved_path.write_text(content, encoding='utf-8')
        except Exception as e:
            raise RuntimeError(
                f"Failed to write file {file_path}: {e}. "
                "Ensure directory exists and is writable."
            )
    
    def edit_file(
        self,
        file_path: str,
        old_string: str,
        new_string: str
    ) -> None:
        """
        Edit file by replacing old_string with new_string.
        
        Uses Cursor SDK search_replace or fallback to standard Python.
        
        Args:
            file_path: Path to file (relative to worktree or absolute)
            old_string: String to replace
            new_string: Replacement string
            
        Raises:
            ValueError: If old_string not found in file
            CursorSDKUnavailableError: If Cursor SDK required but unavailable
        """
        resolved_path = self._resolve_path(file_path)
        
        # Read current content
        current_content = self.read_file(file_path)
        
        if old_string not in current_content:
            raise ValueError(
                f"Old string not found in {file_path}. "
                "Ensure the exact string exists in the file."
            )
        
        # Replace
        new_content = current_content.replace(old_string, new_string)
        
        # Write back
        self.write_file(file_path, new_content)
    
    def run_command(
        self,
        command: str,
        cwd: Optional[str] = None,
        capture_output: bool = True
    ) -> CommandResult:
        """
        Run terminal command using Cursor SDK or subprocess.
        
        Args:
            command: Command to execute
            cwd: Working directory (defaults to worktree path)
            capture_output: Whether to capture stdout/stderr
            
        Returns:
            CommandResult with exit code and output
            
        Raises:
            CursorSDKUnavailableError: If Cursor SDK required but unavailable
        """
        # Use worktree as cwd if not specified
        if cwd is None:
            cwd = str(self.worktree_path)
        else:
            cwd = str(self._resolve_path(cwd))
        
        try:
            # In Cursor IDE context, we could use Cursor SDK run_terminal_cmd
            # For now, use subprocess
            # TODO: Integrate with actual Cursor SDK when available
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=capture_output,
                text=True,
                encoding='utf-8'
            )
            
            cmd_result = CommandResult(
                exit_code=result.returncode,
                stdout=result.stdout or "",
                stderr=result.stderr or "",
                command=command
            )
            
            # Log command output if logger available
            if self.logger:
                self.logger.log_command(
                    command=command,
                    output=cmd_result.stdout + cmd_result.stderr,
                    exit_code=cmd_result.exit_code,
                    agent="implementer"
                )
            
            return cmd_result
            
        except Exception as e:
            raise RuntimeError(
                f"Failed to execute command '{command}': {e}. "
                f"Working directory: {cwd}"
            )
    
    def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        response_format: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate text using Cursor SDK model API.
        
        Args:
            prompt: User prompt
            model: Model identifier (e.g., "openai:gpt-4o", "cursor:code")
            system_prompt: Optional system prompt
            response_format: Optional response format (e.g., "json")
            **kwargs: Additional model parameters
            
        Returns:
            Generated text
            
        Raises:
            CursorSDKUnavailableError: If Cursor SDK not available
            RuntimeError: If generation fails
        """
        if not self._cursor_sdk_available:
            raise CursorSDKUnavailableError("generate")
        
        # TODO: Integrate with actual Cursor SDK generate API
        # For now, raise informative error
        raise NotImplementedError(
            f"Model generation not yet implemented. "
            f"Model: {model}, Prompt length: {len(prompt)} chars. "
            "This requires Cursor SDK integration. "
            "When implemented, this will call Cursor SDK's generate() method "
            f"with model={model} and the provided prompt."
        )
    
    def codebase_search(
        self,
        query: str,
        target_directories: Optional[list] = None
    ) -> list:
        """
        Search codebase using Cursor SDK codebase_search.
        
        Args:
            query: Search query
            target_directories: Optional list of directories to search
            
        Returns:
            List of search results
        """
        # TODO: Integrate with actual Cursor SDK codebase_search
        # For now, return empty list
        return []


def create_cursor_client(worktree_path: Path, logger=None) -> CursorClient:
    """
    Convenience function to create a Cursor client.
    
    Args:
        worktree_path: Path to worktree
        logger: Optional EventLogger instance
        
    Returns:
        CursorClient instance
    """
    return CursorClient(worktree_path, logger)

