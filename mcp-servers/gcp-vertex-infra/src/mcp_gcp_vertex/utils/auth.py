"""Authentication utilities for GCP."""

from google.auth import default as get_default_credentials
from google.auth.exceptions import DefaultCredentialsError
from typing import Tuple, Optional
from google.auth.credentials import Credentials


def get_credentials() -> Tuple[Credentials, Optional[str]]:
    """
    Get GCP credentials using Application Default Credentials.

    Returns:
        Tuple of (credentials, project_id)

    Raises:
        DefaultCredentialsError: If credentials cannot be found
    """
    try:
        credentials, project = get_default_credentials()
        return credentials, project
    except DefaultCredentialsError as e:
        raise Exception(
            "GCP credentials not found. Please run:\n"
            "  gcloud auth application-default login\n"
            f"Error: {str(e)}"
        )


def verify_credentials() -> bool:
    """
    Verify that GCP credentials are available and valid.

    Returns:
        True if credentials are valid, False otherwise
    """
    try:
        credentials, _ = get_credentials()
        # Try to refresh the credentials to verify they work
        if not credentials.valid:
            credentials.refresh()
        return True
    except Exception:
        return False
