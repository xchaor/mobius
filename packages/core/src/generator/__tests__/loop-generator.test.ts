import { describe, it, expect } from "vitest";
import { LoopGenerator } from "../loop-generator.js";

const SP = "You are a Loop Engineering expert.";

class MockLLM { constructor(private r: string) {} async complete(_params: any): Promise<{ content: string; toolCalls: any[]; model: string }> { return { content: this.r, toolCalls: [], model: "mock" }; } }

describe("LoopGenerator", () => {
  it("generates valid loop from NL", async () => {
    const yaml = "id: hello\nname: Hello\ntrigger:\n  type: manual\n  commandName: h\nexecution:\n  maxIterations: 5\n  useWorktree: true\neval:\n  threshold: 0.7\n  conditions:\n    - type: command_exit_code\n      command: npm test\n      expected: 0\n      description: Tests pass\n  boundaryConditions:\n    - type: no_file_deleted\n      path: '.'\n      description: No delete\nskills:\n  - test-driven-development\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 3";
    const g = new LoopGenerator(new MockLLM(yaml), SP);
    const r = await g.generate("write hello world");
    expect(r.definition.id).toBe("hello");
    expect(r.warnings).toHaveLength(0);
  });

  it("extracts YAML from markdown code block", async () => {
    const yaml = "```yaml\nid: test\nname: Test\ntrigger:\n  type: manual\n  commandName: t\nskills: []\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 1\n```";
    const g = new LoopGenerator(new MockLLM(yaml), SP);
    const r = await g.generate("test");
    expect(r.definition.id).toBe("test");
  });

  it("warns when no conditions", async () => {
    const yaml = "id: nc\nname: NC\ntrigger:\n  type: manual\n  commandName: nc\nskills: []\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 1";
    const g = new LoopGenerator(new MockLLM(yaml), SP);
    const r = await g.generate("no conditions");
    expect(r.warnings.some(w => w.includes("conditions"))).toBe(true);
  });

  it("throws on invalid YAML", async () => {
    const g = new LoopGenerator(new MockLLM("not: valid: :"), SP);
    await expect(g.generate("bad")).rejects.toThrow("LoopGenerator");
  });
});
