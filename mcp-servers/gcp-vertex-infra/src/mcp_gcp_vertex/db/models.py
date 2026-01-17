"""Data models for GCP Vertex AI project management."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GCPVertexProject(BaseModel):
    """Model representing a GCP Vertex AI project."""

    id: Optional[str] = None
    business_unit: str = Field(description="Business unit identifier")
    project_id: str = Field(description="GCP project ID")
    project_number: str = Field(description="GCP project number")
    folder_id: Optional[str] = Field(default=None, description="GCP folder ID")
    api_key_id: str = Field(description="API key ID")
    api_key_value: str = Field(description="Encrypted API key value")
    api_key_created_at: Optional[datetime] = None
    api_key_last_rotated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: str = Field(description="Creator identifier")
    status: str = Field(default="active", description="Project status")
    metadata: Optional[dict] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class GCPVertexAuditLog(BaseModel):
    """Model representing an audit log entry."""

    id: Optional[str] = None
    project_id: Optional[str] = None
    action: str = Field(description="Action performed")
    performed_by: str = Field(description="User who performed the action")
    performed_at: Optional[datetime] = None
    details: Optional[dict] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ProjectProvisionResult(BaseModel):
    """Result of project provisioning operation."""

    success: bool
    project_id: str
    api_key: str
    setup_instructions: str
    kb_article_updated: bool
    error: Optional[str] = None


class ProjectExistsResult(BaseModel):
    """Result of project existence check."""

    exists: bool
    project_id: Optional[str] = None
    api_key_active: bool = False


class APIKeyRotationResult(BaseModel):
    """Result of API key rotation."""

    success: bool
    new_api_key: str
    old_key_revoked: bool
    kb_updated: bool
    error: Optional[str] = None
