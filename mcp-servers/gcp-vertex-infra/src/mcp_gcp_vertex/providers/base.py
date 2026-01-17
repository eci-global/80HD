"""Base cloud provider interface for multi-cloud abstraction."""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from ..db.models import GCPVertexProject, ProjectExistsResult


class CloudProvider(ABC):
    """Abstract base class for cloud provider implementations."""

    @abstractmethod
    async def create_project(
        self,
        business_unit: str,
        owner_email: str,
    ) -> GCPVertexProject:
        """
        Create a new cloud project for the given business unit.

        Args:
            business_unit: Business unit identifier
            owner_email: Email of the project owner

        Returns:
            Created project details

        Raises:
            Exception: If project creation fails
        """
        pass

    @abstractmethod
    async def enable_ai_apis(self, project_id: str) -> bool:
        """
        Enable required AI APIs for the project.

        Args:
            project_id: Cloud project ID

        Returns:
            True if APIs were successfully enabled

        Raises:
            Exception: If API enablement fails
        """
        pass

    @abstractmethod
    async def verify_model_availability(self, project_id: str) -> Dict[str, bool]:
        """
        Verify that required AI models are available in the project.

        Args:
            project_id: Cloud project ID

        Returns:
            Dictionary mapping model names to availability status

        Raises:
            Exception: If verification fails
        """
        pass

    @abstractmethod
    async def generate_api_key(
        self,
        project_id: str,
        name: str,
        business_unit: str,
    ) -> tuple[str, str]:
        """
        Generate an API key for the project.

        Args:
            project_id: Cloud project ID
            name: Display name for the API key
            business_unit: Business unit identifier

        Returns:
            Tuple of (api_key_id, api_key_value)

        Raises:
            Exception: If API key generation fails
        """
        pass

    @abstractmethod
    async def revoke_api_key(self, project_id: str, api_key_id: str) -> bool:
        """
        Revoke an existing API key.

        Args:
            project_id: Cloud project ID
            api_key_id: API key ID to revoke

        Returns:
            True if key was successfully revoked

        Raises:
            Exception: If revocation fails
        """
        pass

    @abstractmethod
    async def get_project_details(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a project.

        Args:
            project_id: Cloud project ID

        Returns:
            Project details dictionary or None if not found
        """
        pass

    @abstractmethod
    async def check_project_exists(self, business_unit: str) -> ProjectExistsResult:
        """
        Check if a project already exists for the given business unit.

        Args:
            business_unit: Business unit identifier

        Returns:
            Result indicating existence and project details
        """
        pass
