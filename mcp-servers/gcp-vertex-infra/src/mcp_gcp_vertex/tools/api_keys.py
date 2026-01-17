"""API key management tools."""

from ..providers.gcp import get_gcp_provider
from ..db.supabase import get_supabase_client
from ..db.models import APIKeyRotationResult
from ..utils.kb_updater import update_kb_for_project
from ..config import settings


async def rotate_api_key(project_id: str, performed_by: str = "system") -> dict:
    """
    Rotate the API key for a project.

    This operation:
    1. Generates a new API key
    2. Updates the database
    3. Revokes the old API key
    4. Updates the knowledge base

    Args:
        project_id: GCP project ID
        performed_by: User performing the rotation

    Returns:
        Dictionary with rotation result
    """
    gcp = get_gcp_provider()
    db = get_supabase_client()

    try:
        # Get current project
        project = await db.get_project_by_id(project_id)
        if not project:
            return {
                "success": False,
                "new_api_key": "",
                "old_key_revoked": False,
                "kb_updated": False,
                "error": f"Project {project_id} not found in database",
            }

        old_key_id = project.api_key_id

        # Generate new API key
        new_key_id, new_key_value = await gcp.generate_api_key(
            project_id=project_id,
            name=f"{project.business_unit} Vertex AI Key (Rotated)",
            business_unit=project.business_unit,
        )

        # Update database
        await db.update_project(
            project_id=project_id,
            updates={
                "api_key_id": new_key_id,
                "api_key_value": new_key_value,
                "api_key_last_rotated_at": "now()",
            }
        )

        # Revoke old key
        old_key_revoked = False
        try:
            old_key_revoked = await gcp.revoke_api_key(project_id, old_key_id)
        except Exception as e:
            # Log but don't fail the rotation
            await db.log_audit_event(
                project_id=project_id,
                action="old_key_revocation_failed",
                performed_by=performed_by,
                details={"error": str(e), "old_key_id": old_key_id}
            )

        # Update knowledge base
        kb_updated = False
        try:
            kb_updated = update_kb_for_project(
                business_unit=project.business_unit,
                project_id=project_id,
                region=settings.gcp_default_region,
            )
        except Exception as e:
            # Log but don't fail the rotation
            await db.log_audit_event(
                project_id=project_id,
                action="kb_update_failed_on_rotation",
                performed_by=performed_by,
                details={"error": str(e)}
            )

        # Log successful rotation
        await db.log_audit_event(
            project_id=project_id,
            action="api_key_rotated",
            performed_by=performed_by,
            details={
                "old_key_id": old_key_id,
                "new_key_id": new_key_id,
                "old_key_revoked": old_key_revoked,
            }
        )

        return {
            "success": True,
            "new_api_key": new_key_value,
            "old_key_revoked": old_key_revoked,
            "kb_updated": kb_updated,
            "error": None,
        }

    except Exception as e:
        await db.log_audit_event(
            project_id=project_id,
            action="api_key_rotation_failed",
            performed_by=performed_by,
            details={"error": str(e)}
        )

        return {
            "success": False,
            "new_api_key": "",
            "old_key_revoked": False,
            "kb_updated": False,
            "error": str(e),
        }
