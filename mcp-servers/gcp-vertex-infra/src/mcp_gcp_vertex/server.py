"""MCP server entrypoint for GCP Vertex AI project provisioning."""

import sys
import json
from typing import Optional
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools.provision import (
    provision_vertex_ai_project,
    check_project_exists,
    list_projects,
    get_project_details,
)
from .tools.api_keys import rotate_api_key


# Create MCP server instance
app = Server("gcp-vertex-infra")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="gcp_provision_vertex_ai_project",
            description=(
                "Provision a complete GCP Vertex AI project for a business unit. "
                "This orchestrates the full workflow: creates the GCP project, "
                "enables Vertex AI APIs, generates an API key, stores credentials "
                "securely, and updates the knowledge base. This is the main tool "
                "for setting up new projects. Idempotent - safe to re-run."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "business_unit": {
                        "type": "string",
                        "description": "Business unit identifier (e.g., 'Marketing', 'Sales')",
                    },
                    "owner_email": {
                        "type": "string",
                        "description": "Email address of the project owner",
                    },
                },
                "required": ["business_unit", "owner_email"],
            },
        ),
        Tool(
            name="gcp_check_project_exists",
            description=(
                "Check if a GCP Vertex AI project already exists for a business unit. "
                "Returns existence status, project ID, and API key status."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "business_unit": {
                        "type": "string",
                        "description": "Business unit identifier",
                    },
                },
                "required": ["business_unit"],
            },
        ),
        Tool(
            name="gcp_list_projects",
            description=(
                "List all provisioned GCP Vertex AI projects. "
                "Optionally filter by business unit."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "business_unit": {
                        "type": "string",
                        "description": "Optional: Filter by business unit",
                    },
                },
            },
        ),
        Tool(
            name="gcp_get_project_details",
            description=(
                "Get detailed information about a GCP Vertex AI project, "
                "including enabled APIs, API keys, usage stats, and audit logs."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "GCP project ID",
                    },
                },
                "required": ["project_id"],
            },
        ),
        Tool(
            name="gcp_rotate_api_key",
            description=(
                "Rotate the API key for a GCP Vertex AI project. "
                "This generates a new key, updates the database, revokes the old key, "
                "and updates the knowledge base."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "GCP project ID",
                    },
                    "performed_by": {
                        "type": "string",
                        "description": "Email of user performing the rotation",
                        "default": "system",
                    },
                },
                "required": ["project_id"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "gcp_provision_vertex_ai_project":
            result = await provision_vertex_ai_project(
                business_unit=arguments["business_unit"],
                owner_email=arguments["owner_email"],
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result.model_dump(), indent=2),
                )
            ]

        elif name == "gcp_check_project_exists":
            result = await check_project_exists(
                business_unit=arguments["business_unit"]
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, indent=2),
                )
            ]

        elif name == "gcp_list_projects":
            result = await list_projects(
                business_unit=arguments.get("business_unit")
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, indent=2),
                )
            ]

        elif name == "gcp_get_project_details":
            result = await get_project_details(
                project_id=arguments["project_id"]
            )
            if result is None:
                return [
                    TextContent(
                        type="text",
                        text=json.dumps({
                            "error": f"Project {arguments['project_id']} not found"
                        }),
                    )
                ]
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, indent=2),
                )
            ]

        elif name == "gcp_rotate_api_key":
            result = await rotate_api_key(
                project_id=arguments["project_id"],
                performed_by=arguments.get("performed_by", "system"),
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, indent=2),
                )
            ]

        else:
            return [
                TextContent(
                    type="text",
                    text=json.dumps({"error": f"Unknown tool: {name}"}),
                )
            ]

    except Exception as e:
        return [
            TextContent(
                type="text",
                text=json.dumps({
                    "error": str(e),
                    "tool": name,
                    "arguments": arguments,
                }),
            )
        ]


async def main():
    """Main server entry point."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


def run():
    """CLI entry point."""
    import asyncio
    asyncio.run(main())


if __name__ == "__main__":
    run()
