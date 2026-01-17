"""
Report generation for agent summaries.

Generates structured reports for planner, implementer, and verifier agents.
"""

import json
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime


class ReportGenerator:
    """Generates agent summary reports."""
    
    def __init__(self, worktree_path: Path):
        """
        Initialize report generator.
        
        Args:
            worktree_path: Path to worktree directory
        """
        self.worktree_path = Path(worktree_path)
        self.reports_dir = self.worktree_path / ".agent" / "reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_planner_report(
        self,
        task_id: str,
        plan_bundle: Dict[str, Any]
    ) -> Path:
        """Generate planner summary report."""
        report = {
            "agent": "planner",
            "task_id": task_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "model": plan_bundle.get("model"),
            "substeps_count": len(plan_bundle.get("substeps", [])),
            "substeps": plan_bundle.get("substeps", [])
        }
        
        report_path = self.reports_dir / "planner_summary.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        return report_path
    
    def generate_implementer_report(
        self,
        task_id: str,
        execution_results: List[Dict[str, Any]]
    ) -> Path:
        """Generate implementer summary report."""
        report = {
            "agent": "implementer",
            "task_id": task_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "substeps_executed": len(execution_results),
            "results": execution_results,
            "success_count": sum(1 for r in execution_results if r.get("status") == "completed"),
            "failure_count": sum(1 for r in execution_results if r.get("status") == "failed")
        }
        
        report_path = self.reports_dir / "implementer_summary.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        return report_path
    
    def generate_verifier_report(
        self,
        task_id: str,
        verification_result: Dict[str, Any]
    ) -> Path:
        """Generate verifier summary report."""
        report = {
            "agent": "verifier",
            "task_id": task_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            **verification_result
        }
        
        report_path = self.reports_dir / "verifier_summary.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        return report_path

