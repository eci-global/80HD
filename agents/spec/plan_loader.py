"""
Parser for /80.plan.md markdown file into structured Task objects.
"""

import re
from pathlib import Path
from typing import List, Optional
from .task_schema import Task, PlanSpec, ActionType, TaskStatus, FileOperation, SuccessCriterion


class PlanLoader:
    """Loads and parses plan markdown files into structured task objects."""
    
    def __init__(self, plan_path: str = "80.plan.md"):
        """
        Initialize plan loader.
        
        Args:
            plan_path: Path to plan markdown file (relative to repo root)
        """
        self.plan_path = Path(plan_path)
        if not self.plan_path.is_absolute():
            # Assume relative to repo root
            repo_root = Path(__file__).parent.parent.parent
            self.plan_path = repo_root / plan_path
    
    def load(self) -> PlanSpec:
        """
        Load and parse the plan file.
        
        Returns:
            PlanSpec object with all parsed tasks
        """
        if not self.plan_path.exists():
            raise FileNotFoundError(
                f"Plan file not found: {self.plan_path}. "
                "Ensure /80.plan.md exists in repository root."
            )
        
        content = self.plan_path.read_text(encoding="utf-8")
        
        # Extract title
        title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        title = title_match.group(1) if title_match else "Implementation Plan"
        
        # Parse tasks
        tasks = self._parse_tasks(content)
        
        # Parse phases
        phases = self._parse_phases(content)
        
        return PlanSpec(title=title, tasks=tasks, phases=phases)
    
    def _parse_tasks(self, content: str) -> List[Task]:
        """Parse all tasks from plan content."""
        tasks = []
        
        # Find all question sections (Q1, Q2, etc.)
        question_pattern = r"####\s+(Q\d+):\s+(.+?)(?=####\s+Q\d+:|##\s+Implementation Priority|$)"
        matches = re.finditer(question_pattern, content, re.DOTALL)
        
        for match in matches:
            task_id = match.group(1)  # e.g., "Q1"
            question_text = match.group(2)
            
            try:
                task = self._parse_task(task_id, question_text, content)
                if task:
                    tasks.append(task)
            except Exception as e:
                print(f"Warning: Failed to parse {task_id}: {e}")
                continue
        
        return tasks
    
    def _parse_task(self, task_id: str, question_text: str, full_content: str) -> Optional[Task]:
        """Parse a single task from question text."""
        lines = question_text.split("\n")
        
        # Extract title (first line after question)
        title_match = re.search(r"\*\*Question\*\*:\s*(.+)", question_text)
        if not title_match:
            return None
        
        title = title_match.group(1).strip()
        
        # Extract action type
        action_match = re.search(r"\*\*Action\*\*:\s*\*\*(.+?)\*\*", question_text)
        action_type_str = action_match.group(1).strip() if action_match else "IMPLEMENT"
        
        try:
            action_type = ActionType[action_type_str]
        except KeyError:
            action_type = ActionType.IMPLEMENT
        
        # Extract category (from section header)
        category_match = re.search(r"###\s+(Category \d+:.+?)\n", full_content[:full_content.find(f"#### {task_id}")])
        category = category_match.group(1).strip() if category_match else "Uncategorized"
        
        # Extract files
        files_to_create = self._extract_files(question_text, "create")
        files_to_modify = self._extract_files(question_text, "modify")
        
        # Extract implementation steps
        implementation_steps = self._extract_list_items(question_text, r"\*\*Implementation\*\*:", r"\*\*Integration\*\*:")
        
        # Extract integration points
        integration_points = self._extract_list_items(question_text, r"\*\*Integration\*\*:", r"\*\*Error Handling\*\*:")
        
        # Extract error handling
        error_handling = self._extract_section(question_text, r"\*\*Error Handling\*\*:", r"\*\*Testing\*\*:")
        
        # Extract testing requirements
        testing_requirements = self._extract_section(question_text, r"\*\*Testing\*\*:", r"\*\*Action\*\*:")
        
        # Extract success criteria (from implementation steps or description)
        success_criteria = self._extract_success_criteria(question_text)
        
        # Determine priority and phase from "Implementation Priority" section
        priority, phase = self._extract_priority_and_phase(full_content, task_id)
        
        # Build description from question text
        description = self._extract_description(question_text)
        
        return Task(
            id=task_id,
            title=title,
            category=category,
            action_type=action_type,
            description=description,
            files_to_create=files_to_create,
            files_to_modify=files_to_modify,
            implementation_steps=implementation_steps,
            integration_points=integration_points,
            success_criteria=success_criteria,
            error_handling=error_handling,
            testing_requirements=testing_requirements,
            priority=priority,
            phase=phase,
            status=TaskStatus.PENDING
        )
    
    def _extract_files(self, text: str, operation: str) -> List[FileOperation]:
        """Extract file operations from text."""
        files = []
        
        # Look for file patterns
        if operation == "create":
            pattern = r"- \*\*New File\*\*:\s*`(.+?)`"
        else:
            pattern = r"- \*\*File\*\*:\s*`(.+?)`"
        
        matches = re.finditer(pattern, text)
        for match in matches:
            file_path = match.group(1).strip()
            files.append(FileOperation(
                path=file_path,
                operation=operation,
                description=None
            ))
        
        return files
    
    def _extract_list_items(self, text: str, start_pattern: str, end_pattern: str) -> List[str]:
        """Extract numbered or bulleted list items between two patterns."""
        start_match = re.search(start_pattern, text)
        if not start_match:
            return []
        
        start_pos = start_match.end()
        
        # Find end position
        end_match = re.search(end_pattern, text[start_pos:])
        end_pos = start_pos + end_match.start() if end_match else len(text)
        
        section = text[start_pos:end_pos]
        
        # Extract list items (numbered or bulleted)
        items = []
        for line in section.split("\n"):
            line = line.strip()
            # Match numbered lists (1., 2., etc.) or bullets (-, *)
            if re.match(r"^\d+\.\s+", line) or re.match(r"^[-*]\s+", line):
                # Remove numbering/bullet
                item = re.sub(r"^\d+\.\s+", "", line)
                item = re.sub(r"^[-*]\s+", "", item)
                if item:
                    items.append(item)
        
        return items
    
    def _extract_section(self, text: str, start_pattern: str, end_pattern: str) -> Optional[str]:
        """Extract text section between two patterns."""
        start_match = re.search(start_pattern, text)
        if not start_match:
            return None
        
        start_pos = start_match.end()
        
        end_match = re.search(end_pattern, text[start_pos:])
        end_pos = start_pos + end_match.start() if end_match else len(text)
        
        section = text[start_pos:end_pos].strip()
        return section if section else None
    
    def _extract_success_criteria(self, text: str) -> List[SuccessCriterion]:
        """Extract success criteria from task text."""
        criteria = []
        
        # Look for explicit success criteria
        # Pattern: "Verify X", "Ensure Y", "Check Z"
        patterns = [
            r"Verify\s+(.+?)(?:\.|$)",
            r"Ensure\s+(.+?)(?:\.|$)",
            r"Check\s+(.+?)(?:\.|$)",
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                description = match.group(1).strip()
                criteria.append(SuccessCriterion(
                    description=description,
                    verification_method=None
                ))
        
        return criteria
    
    def _extract_priority_and_phase(self, content: str, task_id: str) -> tuple[int, Optional[str]]:
        """Extract priority and phase from Implementation Priority section."""
        priority_section = re.search(r"##\s+Implementation Priority(.+?)(?=##|$)", content, re.DOTALL)
        if not priority_section:
            return (999, None)
        
        section_text = priority_section.group(1)
        
        # Find which phase contains this task
        phase_pattern = r"###\s+(Phase \d+:.+?)\n(.*?)(?=###\s+Phase \d+:|$)"
        phase_matches = re.finditer(phase_pattern, section_text, re.DOTALL)
        
        for phase_match in phase_matches:
            phase_name = phase_match.group(1).strip()
            phase_content = phase_match.group(2)
            
            # Check if task is in this phase
            if task_id in phase_content:
                # Priority based on phase order
                phase_num_match = re.search(r"Phase (\d+)", phase_name)
                priority = int(phase_num_match.group(1)) if phase_num_match else 999
                return (priority, phase_name)
        
        return (999, None)
    
    def _extract_description(self, text: str) -> str:
        """Extract task description from question text."""
        # Get text after "Question:" and before next major section
        question_match = re.search(r"\*\*Question\*\*:\s*(.+?)(?=\*\*Action\*\*:|$)", text, re.DOTALL)
        if question_match:
            return question_match.group(1).strip()
        
        # Fallback: first paragraph
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if line and not line.startswith("*") and not line.startswith("#"):
                return line
        
        return "No description available"


def load_plan(plan_path: str = "/80.plan.md") -> PlanSpec:
    """
    Convenience function to load a plan spec.
    
    Args:
        plan_path: Path to plan markdown file
        
    Returns:
        Parsed PlanSpec object
    """
    loader = PlanLoader(plan_path)
    return loader.load()

