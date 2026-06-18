import { describe, it, expect } from "vitest";
import { CompositeJudge } from "../composite-judge.js";
import { LoopDefinition } from "../../loop/loop-definition.js";

function mockDef(conditions: any[] = [], boundaries: any[] = []): LoopDefinition {
  return {
    id: "test", name: "test", trigger: { type: "manual", commandName: "test" },
    execution: { maxIterations: 3, maxTokensPerIter: 1000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
    eval: { judgeModel: "t", threshold: 0.7, maxRetries: 2, stagnantRounds: 2, conditions, boundaryConditions: boundaries },
    delegation: { maxDepth: 0, maxSubagents: 0, budgetPerNode: 0 },
    memory: { autoNudge: false, autoSkillCreation: false, claudeMdMaxLines: 200 },
    onFailure: { strategy: "retry", maxRetries: 2 }, skills: [], mcpConnectors: [],
  };
}

describe("CompositeJudge", () => {
  it("passes all conditions for echo command", async () => {
    const def = mockDef([{ type: "command_exit_code", command: "echo test", expected: 0, description: "echo" }]);
    const judge = new CompositeJudge(def);
    const result = await judge.evaluate({ iteration: 1 } as any, "some code output");
    expect(result.allConditionsPassed).toBe(true);
  });

  it("fails conditions for false command", async () => {
    const def = mockDef([{ type: "command_exit_code", command: "false", expected: 0, description: "fails" }]);
    const judge = new CompositeJudge(def);
    const result = await judge.evaluate({ iteration: 1 } as any, "");
    expect(result.allConditionsPassed).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("detects stagnation after identical scores", async () => {
    const def = mockDef([{ type: "command_exit_code", command: "false", expected: 0, description: "fails" }]);
    const judge = new CompositeJudge(def);
    await judge.evaluate({ iteration: 1 } as any, "");
    await judge.evaluate({ iteration: 2 } as any, "");
    const r3 = await judge.evaluate({ iteration: 3 } as any, "");
    expect(r3.isStagnant).toBe(true);
  });
});
