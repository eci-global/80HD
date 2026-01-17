"""
MCP helper utilities for checking availability and wrapping MCP calls.

Enforces MCP-first policy: prefer MCP servers, fallback to direct APIs only
when MCP unavailable, with logging and TODO creation.
"""

from typing import Dict, Optional
import os


def check_mcp_availability() -> Dict[str, bool]:
    """
    Check availability of MCP servers.
    
    Returns:
        Dictionary mapping service names to availability status
    """
    status = {}
    
    # Check Supabase MCP (available via Cursor SDK)
    # This is always available if we're running in Cursor
    status['supabase'] = True
    
    # Check Slack MCP
    # Look for environment variable or MCP server process
    slack_mcp_enabled = os.getenv('SLACK_MCP_ENABLED', '').lower() == 'true'
    status['slack'] = slack_mcp_enabled
    
    # Check Microsoft 365 MCP
    ms365_mcp_enabled = os.getenv('MS365_MCP_ENABLED', '').lower() == 'true'
    status['microsoft365'] = ms365_mcp_enabled
    
    return status


def should_use_mcp(service: str) -> bool:
    """
    Determine if MCP should be used for a service.
    
    Args:
        service: Service name ('slack', 'microsoft365', 'supabase')
        
    Returns:
        True if MCP should be used, False otherwise
    """
    status = check_mcp_availability()
    return status.get(service, False)


def log_mcp_fallback(service: str, reason: str) -> str:
    """
    Log MCP fallback and generate TODO comment.
    
    Args:
        service: Service name
        reason: Reason for fallback
        
    Returns:
        TODO comment string to add to code
    """
    todo_comment = (
        f"// TODO: Migrate to {service} MCP server when available\n"
        f"// Reason: {reason}\n"
        f"// MCP Status: {check_mcp_availability().get(service, False)}\n"
    )
    return todo_comment


class MCPFallbackError(Exception):
    """Raised when MCP fallback is required but not allowed."""
    
    def __init__(self, service: str, reason: str):
        self.service = service
        self.reason = reason
        super().__init__(
            f"MCP server for {service} is unavailable: {reason}. "
            f"Fallback to direct API requires explicit approval and TODO comment."
        )

