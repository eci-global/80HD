"""Configuration management for GCP Vertex MCP server."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # GCP Configuration
    gcp_organization_id: str = Field(
        description="GCP Organization ID"
    )
    gcp_folder_id: str = Field(
        description="GCP Folder ID for Business Units"
    )
    gcp_billing_account_id: str = Field(
        description="GCP Billing Account ID"
    )
    gcp_default_region: str = Field(
        default="us-east5",
        description="Default GCP region for Vertex AI"
    )

    # Supabase Configuration
    supabase_url: str = Field(
        description="Supabase project URL"
    )
    supabase_service_role_key: str = Field(
        description="Supabase service role key"
    )

    # Knowledge Base Configuration
    kb_path: str = Field(
        default="/Users/tedgar/Projects/80HD/knowledge-base/team/configure-claude-code-vertex-ai.md",
        description="Path to knowledge base article"
    )


# Global settings instance
settings = Settings()
