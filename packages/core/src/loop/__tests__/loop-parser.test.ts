import { describe, it, expect } from "vitest";
import { parseLoopDefinition } from "../loop-parser.js";

const MINIMAL = `id: test\nname: Test\ntrigger:\n  type: manual\n  commandName: test`;
const FULL = `id: hello\nname: Hello\ndescription: Test loop\ntrigger:\n  type: cron\n  cronExpression: "0 */2 * * *"\nexecution:\n  maxIterations: 10\n  useWorktree: true\neval:\n  threshold: 0.7\n  conditions:\n    - type: command_exit_code\n      command: npm test\n      expected: 0\n      description: Tests pass\n  boundaryConditions:\n    - type: no_file_deleted\n      path: "."\n      description: No delete\nskills:\n  - test-driven-development\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 3`;

describe("parseLoopDefinition", () => {
  it("parses minimal loop with defaults", () => {
    const loop = parseLoopDefinition(MINIMAL);
    expect(loop.id).toBe("test");
    expect(loop.execution.maxIterations).toBe(100);
    expect(loop.eval.threshold).toBe(0.7);
  });
  it("parses full loop with conditions and boundaries", () => {
    const loop = parseLoopDefinition(FULL);
    expect(loop.eval.conditions).toHaveLength(1);
    expect(loop.eval.boundaryConditions).toHaveLength(1);
    expect(loop.skills).toContain("test-driven-development");
    expect(loop.trigger.type).toBe("cron");
  });
  it("throws on missing name", () => {
    expect(() => parseLoopDefinition("id: x\ntrigger:\n  type: manual\n  commandName: x")).toThrow();
  });
  it("throws on invalid YAML", () => {
    expect(() => parseLoopDefinition(": : :")).toThrow();
  });
});
