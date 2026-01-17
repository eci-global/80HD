/**
 * MCP (Model Context Protocol) client utilities.
 * 
 * MCP servers are preferred for data fetching from Microsoft 365 and Slack.
 * This module provides utilities to interact with MCP servers when available,
 * with fallback to direct API calls when MCP servers are unavailable.
 * 
 * Note: MCP servers are configured in Cursor's mcp.json and run as separate processes.
 * For Edge Functions (Deno), direct API calls are used. For Node.js applications,
 * MCP servers can be invoked via stdio or HTTP if available.
 * 
 * Current implementation: Checks for MCP availability and falls back to direct APIs.
 * Full MCP integration would require MCP protocol implementation (stdio/HTTP).
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

// Import exec/promisify only in Node.js environment
let execAsync: ((command: string, options: { timeout: number }) => Promise<{ stdout: string; stderr: string }>) | null = null;

async function getExecAsync() {
  if (typeof Deno !== 'undefined') {
    // Deno environment - exec not available
    return null;
  }
  if (!execAsync) {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    execAsync = promisify(exec);
  }
  return execAsync;
}

/**
 * MCP client interface for interacting with MCP servers.
 * 
 * In practice, MCP servers communicate via stdio or HTTP.
 * This interface abstracts the communication layer.
 */
export interface MCPClient {
  /**
   * List available tools from the MCP server
   */
  listTools(): Promise<MCPTool[]>;

  /**
   * Call a tool on the MCP server
   */
  callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult>;
}

/**
 * Microsoft 365 MCP client wrapper.
 * 
 * Uses @softeria/ms-365-mcp-server when available.
 * Falls back to direct Graph API if MCP server is unavailable.
 */
export class Microsoft365MCPClient implements MCPClient {
  private mcpAvailable: boolean = false;

  constructor() {
    // Check if MCP server is available via environment variable
    // In Cursor, MCP servers are configured in mcp.json
    // For Node.js apps, check if MCP server process is running
    if (typeof process !== 'undefined' && process.env) {
      this.mcpAvailable = process.env.MS365_MCP_ENABLED === 'true';
    } else {
      // Deno environment - MCP servers not directly accessible
      this.mcpAvailable = false;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.mcpAvailable) {
      return [];
    }

    // TODO: Implement actual MCP server communication
    // For now, return known tools from @softeria/ms-365-mcp-server
    return [
      {
        name: 'list-mail-messages',
        description: 'List email messages from Outlook',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: { type: 'string' },
            top: { type: 'number' },
          },
        },
      },
      {
        name: 'list-chat-messages',
        description: 'List messages from Teams chats',
        inputSchema: {
          type: 'object',
          properties: {
            chatId: { type: 'string' },
            top: { type: 'number' },
          },
        },
      },
      {
        name: 'list-team-channels',
        description: 'List Teams channels',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
          },
        },
      },
      {
        name: 'list-channel-messages',
        description: 'List messages from a Teams channel',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            channelId: { type: 'string' },
            top: { type: 'number' },
          },
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    if (!this.mcpAvailable) {
      throw new Error(
        'Microsoft 365 MCP server is not available. ' +
          'Set MS365_MCP_ENABLED=true and ensure @softeria/ms-365-mcp-server is running. ' +
          'Falling back to direct Graph API.'
      );
    }

    // TODO: Implement actual MCP server communication
    // This would use stdio or HTTP to communicate with the MCP server
    throw new Error('MCP server communication not yet implemented. Use direct API fallback.');
  }

  isAvailable(): boolean {
    return this.mcpAvailable;
  }
}

/**
 * Slack MCP client wrapper.
 * 
 * Uses official Slack MCP server when available (currently in partner rollout).
 * Falls back to direct Slack Web API if MCP server is unavailable.
 */
export class SlackMCPClient implements MCPClient {
  private mcpAvailable: boolean = false;

  constructor() {
    // Check if MCP server is available via environment variable
    // In Cursor, MCP servers are configured in mcp.json
    // For Node.js apps, check if MCP server process is running
    if (typeof process !== 'undefined' && process.env) {
      this.mcpAvailable = process.env.SLACK_MCP_ENABLED === 'true';
    } else {
      // Deno environment - MCP servers not directly accessible
      this.mcpAvailable = false;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.mcpAvailable) {
      return [];
    }

    // TODO: Implement actual MCP server communication
    // Official Slack MCP server provides:
    // - search (messages, files, users, channels)
    // - read channels and threads
    // - send messages
    // - manage canvases
    // - manage users
    return [
      {
        name: 'search_messages',
        description: 'Search Slack messages',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            count: { type: 'number' },
          },
        },
      },
      {
        name: 'read_channel',
        description: 'Read channel message history',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    if (!this.mcpAvailable) {
      throw new Error(
        'Slack MCP server is not available. ' +
          'Set SLACK_MCP_ENABLED=true and ensure Slack MCP server is running. ' +
          'Falling back to direct Slack Web API.'
      );
    }

    // TODO: Implement actual MCP server communication
    throw new Error('MCP server communication not yet implemented. Use direct API fallback.');
  }

  isAvailable(): boolean {
    return this.mcpAvailable;
  }
}

