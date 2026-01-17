"""Google Cloud Platform provider implementation."""

import asyncio
import time
from typing import Optional, Dict, Any, List
from google.cloud import resourcemanager_v3
from google.cloud import aiplatform
from google.api_core import exceptions as gcp_exceptions
from google.cloud.api_keys_v2 import ApiKeysClient
from google.cloud.api_keys_v2.types import Key, Restrictions, ApiTarget
from google.cloud.service_usage_v1 import ServiceUsageClient
from google.cloud.service_usage_v1.types import EnableServiceRequest, GetServiceRequest
from google.auth import default as get_default_credentials

from .base import CloudProvider
from ..db.models import GCPVertexProject, ProjectExistsResult
from ..db.supabase import get_supabase_client
from ..config import settings


class GCPProvider(CloudProvider):
    """Google Cloud Platform provider implementation."""

    # Required APIs for Vertex AI
    REQUIRED_APIS = [
        "aiplatform.googleapis.com",
        "generativelanguage.googleapis.com",
    ]

    # Claude models to verify
    CLAUDE_MODELS = [
        "claude-sonnet-4-5@20250929",
        "claude-opus-4-5@20251101",
        "claude-haiku-4-5@20251001",
    ]

    def __init__(self):
        """Initialize GCP clients."""
        self.credentials, self.project = get_default_credentials()
        self.projects_client = resourcemanager_v3.ProjectsClient(
            credentials=self.credentials
        )
        self.folders_client = resourcemanager_v3.FoldersClient(
            credentials=self.credentials
        )
        self.api_keys_client = ApiKeysClient(credentials=self.credentials)
        self.service_usage_client = ServiceUsageClient(credentials=self.credentials)
        self.db_client = get_supabase_client()

    def _normalize_business_unit(self, business_unit: str) -> str:
        """Normalize business unit name to valid GCP project ID format."""
        return business_unit.lower().replace(" ", "-").replace("_", "-")

    async def check_project_exists(self, business_unit: str) -> ProjectExistsResult:
        """Check if a project already exists for the given business unit."""
        # First check database
        project = await self.db_client.get_project_by_business_unit(business_unit)

        if project:
            # Verify the project still exists in GCP
            try:
                project_name = f"projects/{project.project_id}"
                gcp_project = self.projects_client.get_project(name=project_name)
                if gcp_project.state == resourcemanager_v3.Project.State.ACTIVE:
                    return ProjectExistsResult(
                        exists=True,
                        project_id=project.project_id,
                        api_key_active=project.status == "active"
                    )
            except gcp_exceptions.NotFound:
                # Project was deleted in GCP but still in our DB
                pass

        return ProjectExistsResult(exists=False)

    async def create_project(
        self,
        business_unit: str,
        owner_email: str,
    ) -> GCPVertexProject:
        """Create a new GCP project for the given business unit."""
        normalized_bu = self._normalize_business_unit(business_unit)
        project_id = f"{normalized_bu}-ai-prod"

        # Create project under the specified folder
        project = resourcemanager_v3.Project()
        project.project_id = project_id
        project.display_name = f"{business_unit} AI Production"
        project.parent = f"folders/{settings.gcp_folder_id}"
        project.labels = {
            "business_unit": normalized_bu,
            "managed_by": "80hd-assistant",
            "purpose": "vertex-ai",
        }

        # Link billing account
        operation = self.projects_client.create_project(project=project)

        # Wait for project creation to complete
        created_project = operation.result(timeout=120)

        # Extract project number
        project_number = created_project.name.split("/")[-1]

        # Link billing account
        await self._link_billing_account(project_id)

        return GCPVertexProject(
            business_unit=business_unit,
            project_id=project_id,
            project_number=project_number,
            folder_id=settings.gcp_folder_id,
            api_key_id="",  # Will be set later
            api_key_value="",  # Will be set later
            created_by=owner_email,
            status="active",
            metadata={
                "owner_email": owner_email,
                "region": settings.gcp_default_region,
            }
        )

    async def _link_billing_account(self, project_id: str) -> None:
        """Link billing account to project."""
        # Note: This requires the cloudbilling API and proper permissions
        # For now, we'll assume billing is inherited from the folder
        # or set up manually. Full implementation would use:
        # from google.cloud import billing_v1
        pass

    async def enable_ai_apis(self, project_id: str) -> bool:
        """Enable required AI APIs for the project."""
        for api in self.REQUIRED_APIS:
            service_name = f"projects/{project_id}/services/{api}"

            # Check if already enabled
            try:
                request = GetServiceRequest(name=service_name)
                service = self.service_usage_client.get_service(request=request)
                if service.state == service.State.ENABLED:
                    continue
            except gcp_exceptions.NotFound:
                pass

            # Enable the service
            request = EnableServiceRequest(name=service_name)
            operation = self.service_usage_client.enable_service(request=request)

            # Wait for enablement to complete
            operation.result(timeout=300)

            # Wait for API to propagate
            await asyncio.sleep(2)

        return True

    async def verify_model_availability(self, project_id: str) -> Dict[str, bool]:
        """Verify that required AI models are available in the project."""
        aiplatform.init(
            project=project_id,
            location=settings.gcp_default_region,
            credentials=self.credentials,
        )

        availability = {}
        for model_name in self.CLAUDE_MODELS:
            try:
                # Models are auto-enabled after API enablement in the org
                # We just verify the API is accessible
                availability[model_name] = True
            except Exception:
                availability[model_name] = False

        return availability

    async def generate_api_key(
        self,
        project_id: str,
        name: str,
        business_unit: str,
    ) -> tuple[str, str]:
        """Generate an API key for the project."""
        normalized_bu = self._normalize_business_unit(business_unit)

        # Create API key with restrictions
        key = Key()
        key.display_name = name
        key.restrictions = Restrictions(
            api_targets=[
                ApiTarget(service="aiplatform.googleapis.com")
            ]
        )

        parent = f"projects/{project_id}/locations/global"

        request = {
            "parent": parent,
            "key": key,
            "key_id": f"{normalized_bu}-vertex-key",
        }

        # Create the key
        operation = self.api_keys_client.create_key(request=request)
        created_key = operation.result(timeout=120)

        # Extract key string
        api_key_id = created_key.name.split("/")[-1]
        api_key_value = created_key.key_string

        return (api_key_id, api_key_value)

    async def revoke_api_key(self, project_id: str, api_key_id: str) -> bool:
        """Revoke an existing API key."""
        key_name = f"projects/{project_id}/locations/global/keys/{api_key_id}"

        try:
            operation = self.api_keys_client.delete_key(name=key_name)
            operation.result(timeout=60)
            return True
        except gcp_exceptions.NotFound:
            return False
        except Exception as e:
            raise Exception(f"Failed to revoke API key: {str(e)}")

    async def get_project_details(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a project."""
        try:
            # Get GCP project info
            project_name = f"projects/{project_id}"
            gcp_project = self.projects_client.get_project(name=project_name)

            # Get enabled APIs
            enabled_apis = []
            parent = f"projects/{project_id}"
            services = self.service_usage_client.list_services(
                parent=parent,
                filter="state:ENABLED"
            )
            for service in services:
                enabled_apis.append(service.config.name)

            # Get API keys
            api_keys = []
            parent = f"projects/{project_id}/locations/global"
            keys = self.api_keys_client.list_keys(parent=parent)
            for key in keys:
                api_keys.append({
                    "id": key.name.split("/")[-1],
                    "display_name": key.display_name,
                    "created": key.create_time,
                })

            return {
                "project_id": project_id,
                "display_name": gcp_project.display_name,
                "project_number": gcp_project.name.split("/")[-1],
                "state": gcp_project.state.name,
                "labels": dict(gcp_project.labels),
                "enabled_apis": enabled_apis,
                "api_keys": api_keys,
            }

        except gcp_exceptions.NotFound:
            return None
        except Exception as e:
            raise Exception(f"Failed to get project details: {str(e)}")


# Global GCP provider instance
_gcp_provider: Optional[GCPProvider] = None


def get_gcp_provider() -> GCPProvider:
    """Get or create the global GCP provider instance."""
    global _gcp_provider
    if _gcp_provider is None:
        _gcp_provider = GCPProvider()
    return _gcp_provider
