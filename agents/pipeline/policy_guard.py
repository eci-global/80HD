"""
Policy guardrail engine for pre/post-edit validation.

Enforces AGENTS.md policies by checking code changes against policy rules.
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple


class PolicyGuard:
    """Policy guardrail engine."""
    
    def __init__(self, policies_path: Optional[Path] = None):
        """
        Initialize policy guard.
        
        Args:
            policies_path: Path to policies.json file
        """
        if policies_path is None:
            repo_root = Path(__file__).parent.parent.parent
            policies_path = repo_root / "agents" / "config" / "policies.json"
        
        self.policies_path = policies_path
        self.policies = self._load_policies()
    
    def check_pre_edit(
        self,
        file_path: str,
        proposed_content: str
    ) -> Tuple[bool, List[str]]:
        """
        Check proposed edit against policies before applying.
        
        Args:
            file_path: Path to file being edited
            proposed_content: Proposed file content
            
        Returns:
            Tuple of (allowed, violations) where violations is list of policy IDs
        """
        violations = []
        
        for policy_id, policy in self.policies.items():
            if policy.get("severity") != "block":
                continue
            
            # Check block patterns
            block_patterns = policy.get("blockPatterns", [])
            for pattern in block_patterns:
                if re.search(pattern, proposed_content, re.IGNORECASE | re.MULTILINE):
                    violations.append(policy_id)
                    break
        
        return len(violations) == 0, violations
    
    def check_post_edit(
        self,
        file_path: str,
        content: str
    ) -> Tuple[bool, List[str]]:
        """
        Check edited file against policies after applying.
        
        Args:
            file_path: Path to edited file
            content: File content after edit
            
        Returns:
            Tuple of (compliant, violations)
        """
        violations = []
        
        for policy_id, policy in self.policies.items():
            # Check block patterns
            block_patterns = policy.get("blockPatterns", [])
            for pattern in block_patterns:
                if re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
                    violations.append(policy_id)
                    break
            
            # Check require patterns
            require_patterns = policy.get("requirePatterns", [])
            if require_patterns:
                found = False
                for pattern in require_patterns:
                    if re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
                        found = True
                        break
                if not found and policy.get("severity") == "block":
                    violations.append(f"{policy_id}_missing_requirement")
        
        return len(violations) == 0, violations
    
    def _load_policies(self) -> Dict[str, Any]:
        """Load policies from JSON file."""
        if not self.policies_path.exists():
            return {}
        
        with open(self.policies_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("policies", {})

