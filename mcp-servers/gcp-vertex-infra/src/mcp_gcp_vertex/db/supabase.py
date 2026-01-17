"""Supabase client wrapper for GCP Vertex project management."""

from typing import Optional, List
from datetime import datetime
from supabase import create_client, Client
from ..config import settings
from .models import GCPVertexProject, GCPVertexAuditLog


class SupabaseClient:
    """Wrapper for Supabase operations."""

    def __init__(self):
        """Initialize Supabase client."""
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key
        )

    async def get_project_by_business_unit(
        self,
        business_unit: str
    ) -> Optional[GCPVertexProject]:
        """
        Retrieve a project by business unit.

        Args:
            business_unit: Business unit identifier

        Returns:
            Project object if found, None otherwise
        """
        response = self.client.table("gcp_vertex_projects").select("*").eq(
            "business_unit", business_unit
        ).eq("status", "active").execute()

        if response.data and len(response.data) > 0:
            return GCPVertexProject(**response.data[0])
        return None

    async def get_project_by_id(self, project_id: str) -> Optional[GCPVertexProject]:
        """
        Retrieve a project by project ID.

        Args:
            project_id: GCP project ID

        Returns:
            Project object if found, None otherwise
        """
        response = self.client.table("gcp_vertex_projects").select("*").eq(
            "project_id", project_id
        ).execute()

        if response.data and len(response.data) > 0:
            return GCPVertexProject(**response.data[0])
        return None

    async def create_project(self, project: GCPVertexProject) -> GCPVertexProject:
        """
        Create a new project record.

        Args:
            project: Project object to create

        Returns:
            Created project object with ID

        Raises:
            Exception: If creation fails
        """
        data = project.model_dump(exclude={"id"}, exclude_none=True)
        response = self.client.table("gcp_vertex_projects").insert(data).execute()

        if response.data and len(response.data) > 0:
            return GCPVertexProject(**response.data[0])
        raise Exception("Failed to create project record in database")

    async def update_project(
        self,
        project_id: str,
        updates: dict
    ) -> GCPVertexProject:
        """
        Update a project record.

        Args:
            project_id: GCP project ID
            updates: Dictionary of fields to update

        Returns:
            Updated project object

        Raises:
            Exception: If update fails
        """
        response = self.client.table("gcp_vertex_projects").update(updates).eq(
            "project_id", project_id
        ).execute()

        if response.data and len(response.data) > 0:
            return GCPVertexProject(**response.data[0])
        raise Exception(f"Failed to update project {project_id}")

    async def list_projects(
        self,
        business_unit: Optional[str] = None
    ) -> List[GCPVertexProject]:
        """
        List all projects, optionally filtered by business unit.

        Args:
            business_unit: Optional business unit filter

        Returns:
            List of project objects
        """
        query = self.client.table("gcp_vertex_projects").select("*")

        if business_unit:
            query = query.eq("business_unit", business_unit)

        response = query.execute()

        if response.data:
            return [GCPVertexProject(**item) for item in response.data]
        return []

    async def log_audit_event(
        self,
        project_id: Optional[str],
        action: str,
        performed_by: str,
        details: Optional[dict] = None
    ) -> None:
        """
        Log an audit event.

        Args:
            project_id: GCP project ID (optional)
            action: Action performed
            performed_by: User who performed the action
            details: Additional details as JSON
        """
        audit_log = GCPVertexAuditLog(
            project_id=project_id,
            action=action,
            performed_by=performed_by,
            details=details or {}
        )
        data = audit_log.model_dump(exclude={"id", "performed_at"}, exclude_none=True)
        self.client.table("gcp_vertex_audit_log").insert(data).execute()

    async def get_audit_logs(
        self,
        project_id: str,
        limit: int = 50
    ) -> List[GCPVertexAuditLog]:
        """
        Get audit logs for a project.

        Args:
            project_id: GCP project ID
            limit: Maximum number of logs to return

        Returns:
            List of audit log entries
        """
        response = self.client.table("gcp_vertex_audit_log").select("*").eq(
            "project_id", project_id
        ).order("performed_at", desc=True).limit(limit).execute()

        if response.data:
            return [GCPVertexAuditLog(**item) for item in response.data]
        return []


# Global Supabase client instance
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Get or create the global Supabase client instance."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
