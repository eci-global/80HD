"""Knowledge base article updater for GCP Vertex AI configurations."""

import re
from pathlib import Path
from typing import Optional
from ..config import settings


class KnowledgeBaseUpdater:
    """Manages updates to the knowledge base article."""

    def __init__(self, kb_path: Optional[str] = None):
        """Initialize with knowledge base file path."""
        self.kb_path = Path(kb_path or settings.kb_path)

    def update_business_unit_config(
        self,
        business_unit: str,
        project_id: str,
        region: str = "us-east5",
    ) -> bool:
        """
        Add or update a business unit configuration in the knowledge base.

        Args:
            business_unit: Business unit name
            project_id: GCP project ID
            region: GCP region (default: us-east5)

        Returns:
            True if update was successful

        Raises:
            FileNotFoundError: If KB file doesn't exist
            Exception: If update fails
        """
        if not self.kb_path.exists():
            raise FileNotFoundError(f"Knowledge base file not found: {self.kb_path}")

        # Read current content
        content = self.kb_path.read_text()

        # Create business unit section
        bu_section = self._create_business_unit_section(
            business_unit, project_id, region
        )

        # Check if this business unit already exists
        bu_pattern = rf"### {re.escape(business_unit)}\n"
        if re.search(bu_pattern, content):
            # Update existing section
            content = self._update_existing_section(content, business_unit, bu_section)
        else:
            # Add new section
            content = self._add_new_section(content, bu_section)

        # Write updated content
        self.kb_path.write_text(content)
        return True

    def _create_business_unit_section(
        self,
        business_unit: str,
        project_id: str,
        region: str,
    ) -> str:
        """Create markdown section for a business unit."""
        return f"""### {business_unit}

- **Project ID:** `{project_id}`
- **Region:** `{region}`
- **API Key:** See secure storage (retrieve via MCP tool)

**Setup:**
```bash
export ANTHROPIC_API_KEY="your-{business_unit.lower()}-api-key"
export ANTHROPIC_BASE_URL="https://{region}-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="{project_id}"
export ANTHROPIC_VERTEX_LOCATION="{region}"
```

**Test:**
```bash
curl -X POST \\
  "$ANTHROPIC_BASE_URL/projects/{project_id}/locations/{region}/publishers/anthropic/models/claude-sonnet-4-5@20250929:predict" \\
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{{"messages": [{{"role": "user", "content": "Hello, Claude!"}}], "model": "claude-sonnet-4-5@20250929", "max_tokens": 100}}'
```
"""

    def _update_existing_section(
        self,
        content: str,
        business_unit: str,
        new_section: str,
    ) -> str:
        """Update an existing business unit section."""
        # Find the section start
        section_start_pattern = rf"(### {re.escape(business_unit)}\n)"

        # Find the next section or end of content
        # Match either next ### heading or end of string
        section_pattern = (
            rf"{section_start_pattern}"
            r"(.*?)"
            r"(?=\n###|\Z)"
        )

        # Replace the entire section
        updated_content = re.sub(
            section_pattern,
            new_section,
            content,
            flags=re.DOTALL
        )

        return updated_content

    def _add_new_section(self, content: str, new_section: str) -> str:
        """Add a new business unit section to the document."""
        # Look for "## Business Unit Configurations" section
        bu_config_pattern = r"## Business Unit Configurations\n"

        if re.search(bu_config_pattern, content):
            # Add after the section header
            updated_content = re.sub(
                bu_config_pattern,
                f"## Business Unit Configurations\n\n{new_section}\n",
                content,
                count=1
            )
        else:
            # Section doesn't exist, create it
            section_header = "## Business Unit Configurations\n\n"
            # Add before any "## " section or at the end
            if "## " in content:
                # Find first ## heading
                first_section = re.search(r"\n## ", content)
                if first_section:
                    insert_pos = first_section.start()
                    updated_content = (
                        content[:insert_pos] +
                        f"\n{section_header}{new_section}\n" +
                        content[insert_pos:]
                    )
                else:
                    updated_content = content + f"\n{section_header}{new_section}\n"
            else:
                updated_content = content + f"\n{section_header}{new_section}\n"

        return updated_content

    def remove_business_unit_config(self, business_unit: str) -> bool:
        """
        Remove a business unit configuration from the knowledge base.

        Args:
            business_unit: Business unit name

        Returns:
            True if removal was successful
        """
        if not self.kb_path.exists():
            return False

        content = self.kb_path.read_text()

        # Find and remove the section
        section_pattern = (
            rf"### {re.escape(business_unit)}\n"
            r".*?"
            r"(?=\n###|\n##|\Z)"
        )

        updated_content = re.sub(
            section_pattern,
            "",
            content,
            flags=re.DOTALL
        )

        # Clean up any double newlines
        updated_content = re.sub(r"\n\n\n+", "\n\n", updated_content)

        self.kb_path.write_text(updated_content)
        return True


def update_kb_for_project(
    business_unit: str,
    project_id: str,
    region: str = "us-east5",
) -> bool:
    """
    Convenience function to update knowledge base for a project.

    Args:
        business_unit: Business unit name
        project_id: GCP project ID
        region: GCP region

    Returns:
        True if successful
    """
    updater = KnowledgeBaseUpdater()
    return updater.update_business_unit_config(business_unit, project_id, region)
