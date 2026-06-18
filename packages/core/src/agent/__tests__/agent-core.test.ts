import { describe, it, expect } from "vitest";
import { AgentCore } from "../agent-core.js";
import { MockLLMClient } from "../../llm/mock-llm-client.js";
import { ToolExecutor, ToolResult } from "../../loop/loop-engine.js";
import { BUILTIN_TOOLS } from "../../tools/builtin-tools.js";

class TestToolExecutor implements ToolExecutor {
  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    if (name === "write_file") return { success: true, output: `Wrote ${params.path}`, artifacts: [{ type: "file", path: params.path as string, description: `Created ${params.path}` }] };
    if (name === "read_file") return { success: true, output: "file content" };
    if (name === "run_command") return { success: true, output: "Tests: 3 passed" };
    if (name === "list_dir") return { success: true, output: "FILE index.ts" };
    return { success: false, output: "", error: `Unknown: ${name}` };
  }
}

describe("AgentCore", () => {
  it("runs tool-use loop and returns final content", async () => {
    const mockLLM = new MockLLMClient();
    // First call: write a file
    mockLLM.setToolCallResponses([
      [{ id: "1", type: "function", function: { name: "write_file", arguments: JSON.stringify({ path: "src/index.ts", content: "export const x = 1" }) } }],
      // Second call: done
      [],
    ]);

    const agent = new AgentCore({
      llm: mockLLM,
      tools: BUILTIN_TOOLS,
      toolExecutor: new TestToolExecutor(),
      maxIterations: 5,
    });

    const result = await agent.run("Create a simple module");
    expect(result.steps).toHaveLength(3); // llm_call → tool_exec → done
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].path).toBe("src/index.ts");
  });

  it("iterates multiple tool use cycles", async () => {
    const mockLLM = new MockLLMClient();
    mockLLM.setToolCallResponses([
      [{ id: "1", type: "function", function: { name: "write_file", arguments: JSON.stringify({ path: "a.ts", content: "a" }) } }],
      [{ id: "2", type: "function", function: { name: "run_command", arguments: JSON.stringify({ command: "npm test" }) } }],
      [],
    ]);

    const agent = new AgentCore({
      llm: mockLLM,
      tools: BUILTIN_TOOLS,
      toolExecutor: new TestToolExecutor(),
      maxIterations: 5,
    });

    const result = await agent.run("Write and test code");
    expect(result.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.artifacts.length).toBeGreaterThan(0);
  });

  it("stops at maxIterations", async () => {
    const mockLLM = new MockLLMClient();
    mockLLM.setToolCallResponses([
      [{ id: "1", type: "function", function: { name: "write_file", arguments: JSON.stringify({ path: "x.ts", content: "x" }) } }],
      [{ id: "2", type: "function", function: { name: "write_file", arguments: JSON.stringify({ path: "y.ts", content: "y" }) } }],
      [{ id: "3", type: "function", function: { name: "write_file", arguments: JSON.stringify({ path: "z.ts", content: "z" }) } }],
    ]);

    const agent = new AgentCore({ llm: mockLLM, tools: BUILTIN_TOOLS, toolExecutor: new TestToolExecutor(), maxIterations: 2 });
    const result = await agent.run("task");
    expect(result.output).toContain("Max iterations");
  });
});
