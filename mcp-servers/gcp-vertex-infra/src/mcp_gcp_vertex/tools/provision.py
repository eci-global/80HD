"""Main orchestration tool for provisioning GCP Vertex AI projects."""

import asyncio
from typing import Optional
from ..providers.gcp import get_gcp_provider
from ..db.supabase import get_supabase_client
from ..db.models import (
    ProjectProvisionResult,
    GCPVertexProject,
)
from ..utils.kb_updater import update_kb_for_project
from ..config import settings


async def provision_vertex_ai_project(
    business_unit: str,
    owner_email: str,
) -> ProjectProvisionResult:
    """
    Main orchestration function to provision a complete Vertex AI project.

    This function implements the 8-step provisioning workflow:
    1. Check if project already exists
    2. Create GCP project
    3. Enable required APIs
    4. Verify model availability
    5. Generate API key
    6. Store in Supabase
    7. Update knowledge base
    8. Return setup instructions

    Args:
        business_unit: Business unit identifier
        owner_email: Email of the project owner

    Returns:
        ProjectProvisionResult with setup details
    """
    gcp = get_gcp_provider()
    db = get_supabase_client()

    try:
        # Step 1: Check if project already exists
        exists_result = await gcp.check_project_exists(business_unit)
        if exists_result.exists:
            # Return existing configuration
            existing_project = await db.get_project_by_business_unit(business_unit)
            if existing_project:
                setup_instructions = _generate_setup_instructions(
                    business_unit=business_unit,
                    project_id=existing_project.project_id,
                    api_key="(existing key - retrieve from secure storage)",
                    region=settings.gcp_default_region,
                )
                return ProjectProvisionResult(
                    success=True,
                    project_id=existing_project.project_id,
                    api_key="(existing key - retrieve from secure storage)",
                    setup_instructions=setup_instructions,
                    kb_article_updated=True,
                )

        # Step 2: Create GCP project
        await db.log_audit_event(
            project_id=None,
            action="provision_started",
            performed_by=owner_email,
            details={"business_unit": business_unit}
        )

        project = await gcp.create_project(
            business_unit=business_unit,
            owner_email=owner_email,
        )

        # Step 3: Enable required APIs
        await gcp.enable_ai_apis(project.project_id)

        # Step 4: Verify model availability
        models = await gcp.verify_model_availability(project.project_id)
        all_available = all(models.values())
        if not all_available:
            missing = [name for name, available in models.items() if not available]
            raise Exception(f"Models not available: {', '.join(missing)}")

        # Step 5: Generate API key
        api_key_id, api_key_value = await gcp.generate_api_key(
            project_id=project.project_id,
            name=f"{business_unit} Vertex AI Key",
            business_unit=business_unit,
        )

        # Update project with API key details
        project.api_key_id = api_key_id
        project.api_key_value = api_key_value

        # Step 6: Store in Supabase
        stored_project = await db.create_project(project)

        # Step 7: Update knowledge base
        kb_updated = False
        try:
            kb_updated = update_kb_for_project(
                business_unit=business_unit,
                project_id=project.project_id,
                region=settings.gcp_default_region,
            )
        except Exception as e:
            # Log but don't fail the provisioning
            await db.log_audit_event(
                project_id=project.project_id,
                action="kb_update_failed",
                performed_by=owner_email,
                details={"error": str(e)}
            )

        # Log successful provisioning
        await db.log_audit_event(
            project_id=project.project_id,
            action="provision_completed",
            performed_by=owner_email,
            details={
                "business_unit": business_unit,
                "models_verified": list(models.keys()),
            }
        )

        # Step 8: Return setup instructions
        setup_instructions = _generate_setup_instructions(
            business_unit=business_unit,
            project_id=project.project_id,
            api_key=api_key_value,
            region=settings.gcp_default_region,
        )

        return ProjectProvisionResult(
            success=True,
            project_id=project.project_id,
            api_key=api_key_value,
            setup_instructions=setup_instructions,
            kb_article_updated=kb_updated,
        )

    except Exception as e:
        # Log failure
        await db.log_audit_event(
            project_id=None,
            action="provision_failed",
            performed_by=owner_email,
            details={
                "business_unit": business_unit,
                "error": str(e),
            }
        )

        return ProjectProvisionResult(
            success=False,
            project_id="",
            api_key="",
            setup_instructions="",
            kb_article_updated=False,
            error=str(e),
        )


def _generate_setup_instructions(
    business_unit: str,
    project_id: str,
    api_key: str,
    region: str,
) -> str:
    """Generate setup instructions for the provisioned project."""
    return f"""# Vertex AI Setup for {business_unit}

Your Google Cloud Vertex AI project is ready!

**Project ID:** {project_id}
**Region:** {region}
**API Key:** {api_key[:10]}... (keep secure)

## Quick Start

### Environment Variables

```bash
# Set environment variables
export ANTHROPIC_API_KEY="{api_key}"
export ANTHROPIC_BASE_URL="https://{region}-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="{project_id}"
export ANTHROPIC_VERTEX_LOCATION="{region}"
```

### Test with curl

```bash
curl -X POST \\
  "$ANTHROPIC_BASE_URL/projects/{project_id}/locations/{region}/publishers/anthropic/models/claude-sonnet-4-5@20250929:predict" \\
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{{"messages": [{{"role": "user", "content": "Hello, Claude!"}}], "model": "claude-sonnet-4-5@20250929", "max_tokens": 100}}'
```

### Available Models

- **Claude Sonnet 4.5:** `claude-sonnet-4-5@20250929`
- **Claude Opus 4.5:** `claude-opus-4-5@20251101`
- **Claude Haiku 4.5:** `claude-haiku-4-5@20251001`

## Documentation

Full setup guide available at:
`knowledge-base/team/configure-claude-code-vertex-ai.md`

## Security Notes

- **Never commit** the API key to source control
- Store in environment variables or secure secret management
- Rotate keys quarterly (use `gcp_rotate_api_key` MCP tool)

## Support

For issues or questions, contact the 80HD infrastructure team.
"""


async def check_project_exists(business_unit: str) -> dict:
    """
    Check if a project exists for a business unit.

    Args:
        business_unit: Business unit identifier

    Returns:
        Dictionary with existence status and details
    """
    gcp = get_gcp_provider()
    result = await gcp.check_project_exists(business_unit)

    return {
        "exists": result.exists,
        "project_id": result.project_id,
        "api_key_active": result.api_key_active,
    }


async def list_projects(business_unit: Optional[str] = None) -> list:
    """
    List all provisioned projects.

    Args:
        business_unit: Optional filter by business unit

    Returns:
        List of project dictionaries
    """
    db = get_supabase_client()
    projects = await db.list_projects(business_unit=business_unit)

    return [
        {
            "project_id": p.project_id,
            "business_unit": p.business_unit,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "api_key_status": p.status,
            "created_by": p.created_by,
        }
        for p in projects
    ]


async def get_project_details(project_id: str) -> Optional[dict]:
    """
    Get detailed information about a project.

    Args:
        project_id: GCP project ID

    Returns:
        Project details dictionary or None
    """
    gcp = get_gcp_provider()
    db = get_supabase_client()

    # Get GCP details
    gcp_details = await gcp.get_project_details(project_id)
    if not gcp_details:
        return None

    # Get DB details
    db_project = await db.get_project_by_id(project_id)

    # Get recent audit logs
    audit_logs = await db.get_audit_logs(project_id, limit=10)

    return {
        "gcp": gcp_details,
        "database": db_project.model_dump() if db_project else None,
        "recent_activity": [
            {
                "action": log.action,
                "performed_by": log.performed_by,
                "performed_at": log.performed_at.isoformat() if log.performed_at else None,
                "details": log.details,
            }
            for log in audit_logs
        ],
    }
