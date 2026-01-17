"""
Structured JSONL event logging for agent actions.

Captures every agent step, model used, and command executed.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


class EventLogger:
    """Structured event logger for agent actions."""
    
    def __init__(self, worktree_path: Path):
        """
        Initialize event logger.
        
        Args:
            worktree_path: Path to worktree directory
        """
        self.worktree_path = Path(worktree_path)
        self.log_dir = self.worktree_path / ".agent"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "log.jsonl"
        self.commands_dir = self.log_dir / "commands"
        self.commands_dir.mkdir(exist_ok=True)
    
    def log_event(
        self,
        agent: str,
        event_type: str,
        detail: Dict[str, Any]
    ) -> None:
        """
        Log an event.
        
        Args:
            agent: Agent name (planner, implementer, verifier)
            event_type: Type of event
            detail: Event details
        """
        event = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "agent": agent,
            "event_type": event_type,
            "detail": detail
        }
        
        # Append to JSONL file
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event) + "\n")
    
    def log_command(
        self,
        command: str,
        output: str,
        exit_code: int,
        agent: str = "implementer"
    ) -> str:
        """
        Log command execution and store output.
        
        Args:
            command: Command executed
            output: Command output
            exit_code: Exit code
            agent: Agent that executed command
            
        Returns:
            Path to stored command output file
        """
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%SZ")
        safe_command = command.replace("/", "_").replace(" ", "_")[:50]
        output_file = self.commands_dir / f"{timestamp}-{safe_command}.log"
        
        # Store command output
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"Command: {command}\n")
            f.write(f"Exit Code: {exit_code}\n")
            f.write(f"Agent: {agent}\n")
            f.write(f"Timestamp: {timestamp}\n")
            f.write("\n--- Output ---\n")
            f.write(output)
        
        # Log event
        self.log_event(agent, "run_command", {
            "command": command,
            "exit_code": exit_code,
            "output_file": str(output_file.relative_to(self.worktree_path))
        })
        
        return str(output_file)

