import { describe, it, expect } from "vitest";
import { MCPConnector } from "../mcp-connector.js";
import { ToolExecutor, ToolResult } from "../../loop/loop-engine.js";

class Fallback implements ToolExecutor {
  async execute(name: string, _params: Record<string, unknown>): Promise<ToolResult> {
    return { success: true, output: `fallback: ${name}` };
  }
}

describe("MCPConnector", () => {
  it("routes to MCP tool when registered", async () => {
    const connector = new MCPConnector(new Fallback());
    connector.registerTool({
      name: "custom_tool",
      description: "A custom tool",
      parameters: { type: "object", properties: {} },
      handler: async (p) => ({ success: true, output: `handled: ${JSON.stringify(p)}` }),
    });

    const result = await connector.execute("custom_tool", { key: "val" });
    expect(result.output).toContain("handled");
    expect(result.output).toContain("val");
  });

  it("falls back when tool not registered", async () => {
    const connector = new MCPConnector(new Fallback());
    const result = await connector.execute("unknown", {});
    expect(result.output).toBe("fallback: unknown");
  });

  it("returns tool schemas for LLM", () => {
    const connector = new MCPConnector(new Fallback());
    connector.registerTool({
      name: "gh_prs",
      description: "List PRs",
      parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
      handler: async () => ({ success: true, output: "" }),
    });
    const schemas = connector.getToolSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0].name).toBe("gh_prs");
  });
});
