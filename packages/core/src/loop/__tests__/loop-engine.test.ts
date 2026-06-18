import { describe, it, expect, vi } from "vitest";
import { LoopEngine, LoopEngineConfig } from "../loop-engine.js";
import { LoopDefinition } from "../loop-definition.js";
import { LoopPhase } from "../loop-state.js";

function mockConfig(overrides?: Partial<LoopDefinition>): LoopEngineConfig {
  const definition: LoopDefinition = {
    id: "test", name: "Test", trigger: { type: "manual", commandName: "test" },
    execution: { maxIterations: 3, maxTokensPerIter: 1000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
    eval: { judgeModel: "test", threshold: 0.7, maxRetries: 2, stagnantRounds: 2, conditions: [], boundaryConditions: [] },
    delegation: { maxDepth: 0, maxSubagents: 0, budgetPerNode: 0 },
    memory: { autoNudge: true, autoSkillCreation: false, claudeMdMaxLines: 200 },
    onFailure: { strategy: "retry", maxRetries: 2 }, skills: [], mcpConnectors: [],
    ...overrides,
  };
  return {
    definition,
    toolExecutor: { execute: vi.fn().mockResolvedValue({ success: true, output: "done", artifacts: [] }) },
    evalJudge: { evaluate: vi.fn() },
    memoryWriter: { writeNudge: vi.fn().mockResolvedValue(undefined), summarizeSession: vi.fn().mockResolvedValue("ok") },
  };
}

describe("LoopEngine", () => {
  it("completes when conditions passed and score >= threshold", async () => {
    const config = mockConfig();
    (config.evalJudge.evaluate as any).mockResolvedValue({ score: 0.85, reasoning: "ok", suggestions: [], isStagnant: false, allConditionsPassed: true, boundaryViolations: [] });
    const result = await new LoopEngine(config).run("task");
    expect(result.phase).toBe(LoopPhase.COMPLETED);
  });

  it("stops at STAGNANT when rounds exceed threshold", async () => {
    const config = mockConfig({
      execution: { maxIterations: 10, maxTokensPerIter: 100000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
      eval: { judgeModel: "t", threshold: 0.99, maxRetries: 10, stagnantRounds: 2, conditions: [], boundaryConditions: [] },
    });
    (config.evalJudge.evaluate as any).mockResolvedValue({ score: 0.3, reasoning: "fail", suggestions: [], isStagnant: true, allConditionsPassed: false, boundaryViolations: [] });
    const result = await new LoopEngine(config).run("task");
    expect(result.phase).toBe(LoopPhase.STAGNANT);
  });

  it("writes memory nudge each iteration", async () => {
    const config = mockConfig();
    (config.evalJudge.evaluate as any).mockResolvedValue({ score: 0.9, reasoning: "ok", suggestions: [], isStagnant: false, allConditionsPassed: true, boundaryViolations: [] });
    await new LoopEngine(config).run("task");
    expect((config.memoryWriter.writeNudge as any).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("fails when budget exhausted", async () => {
    const config = mockConfig({
      execution: { maxIterations: 1, maxTokensPerIter: 10, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
      eval: { judgeModel: "t", threshold: 0.99, maxRetries: 10, stagnantRounds: 10, conditions: [], boundaryConditions: [] },
    });
    (config.evalJudge.evaluate as any).mockResolvedValue({ score: 0.1, reasoning: "fail", suggestions: [], isStagnant: false, allConditionsPassed: false, boundaryViolations: [] });
    const result = await new LoopEngine(config).run("task");
    expect([LoopPhase.FAILED, LoopPhase.STAGNANT]).toContain(result.phase);
  });
});
