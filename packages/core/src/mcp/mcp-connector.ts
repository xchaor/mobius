import { LLMTool } from "../llm/llm-client.js";
import { ToolExecutor, ToolResult } from "../loop/loop-engine.js";

/**
 * MCP Connector — wraps external MCP (Model Context Protocol) servers as tools.
 * Phase 2 supports: GitHub, Slack. Phase 3 adds more.
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export class MCPConnector implements ToolExecutor {
  private tools = new Map<string, MCPTool>();
  private fallback: ToolExecutor;

  constructor(fallback: ToolExecutor) {
    this.fallback = fallback;
  }

  /** Register an MCP tool */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /** Get all tools as LLM-compatible tool schemas */
  getToolSchemas(): LLMTool[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  /** Execute: tries MCP tool first, falls back to LocalExecutor */
  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (tool) return tool.handler(params);
    return this.fallback.execute(toolName, params);
  }
}

// ── Built-in MCP tool factories ──

export function createGitHubTools(): MCPTool[] {
  return [
    {
      name: "github_list_prs",
      description: "List open pull requests for a repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner" },
          repo: { type: "string", description: "Repository name" },
        },
        required: ["owner", "repo"],
      },
      handler: async (params) => {
        const token = process.env.GITHUB_TOKEN || "";
        if (!token) return { success: false, output: "", error: "GITHUB_TOKEN not set" };
        const { owner, repo } = params;
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        const data = await res.json() as any;
        if (!res.ok) return { success: false, output: "", error: `GitHub API error: ${JSON.stringify(data)}` };
        const summary = (Array.isArray(data) ? data : []).map((pr: any) => `#${pr.number} ${pr.title} by ${pr.user?.login}`).join("\n");
        return { success: true, output: summary || "No open PRs" };
      },
    },
    {
      name: "github_get_checks",
      description: "Get CI check status for a PR.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          prNumber: { type: "number" },
        },
        required: ["owner", "repo", "prNumber"],
      },
      handler: async (params) => {
        const token = process.env.GITHUB_TOKEN || "";
        if (!token) return { success: false, output: "", error: "GITHUB_TOKEN not set" };
        const { owner, repo, prNumber } = params;
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        const pr = await res.json() as any;
        const checksRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${pr.head?.sha}/check-runs`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        const checks = await checksRes.json() as any;
        const summary = (checks.check_runs || []).map((c: any) => `${c.name}: ${c.status} / ${c.conclusion}`).join("\n");
        return { success: true, output: summary || "No checks found" };
      },
    },
  ];
}

export function createSlackTool(): MCPTool {
  return {
    name: "slack_notify",
    description: "Send a notification message to Slack.",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Slack channel name" },
        text: { type: "string", description: "Message text" },
      },
      required: ["channel", "text"],
    },
    handler: async (params) => {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL || "";
      if (!webhookUrl) return { success: false, output: "", error: "SLACK_WEBHOOK_URL not set" };
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: params.channel, text: params.text }),
      });
      return { success: res.ok, output: res.ok ? "Sent" : `Slack error: ${res.status}` };
    },
  };
}
