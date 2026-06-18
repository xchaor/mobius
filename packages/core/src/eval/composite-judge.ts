import { EvalJudge, EvalResult, LoopState } from "../loop/loop-engine.js";
import { LoopDefinition } from "../loop/loop-definition.js";
import { CommandBasedJudge } from "./command-judge.js";

export class MockLLMJudge {
  async evaluate(_state: LoopState, taskOutput: string): Promise<{ score: number; reasoning: string; suggestions: string[] }> {
    // Check for common success indicators in the agent output
    const hasPassingTests = /Tests\s+\d+\s+passed|All tests passing|✓.*test|PASS/i.test(taskOutput);
    const hasCodeOutput = taskOutput.includes("function") || taskOutput.includes("class") || taskOutput.includes("export") || taskOutput.includes("Wrote");
    const hasTestFile = taskOutput.includes(".test.ts") || taskOutput.includes(".spec.ts") || taskOutput.includes("describe") || taskOutput.includes("it(");
    const hasError = /FAIL|Error:|FORBIDDEN|failed/i.test(taskOutput) && !hasPassingTests;

    let score = 0.5;
    if (hasCodeOutput && hasTestFile) score = 0.7;
    if (hasPassingTests) score = 0.85;
    if (hasError) score = Math.max(0.2, score - 0.4);

    const reasons: string[] = [];
    if (hasCodeOutput) reasons.push("code written");
    if (hasTestFile) reasons.push("tests written");
    if (hasPassingTests) reasons.push("tests passing");
    if (hasError) reasons.push("errors detected");

    return {
      score,
      reasoning: `[Mock] ${reasons.join(", ") || "no clear signal"}. Score: ${score}`,
      suggestions: hasError ? ["Fix errors detected in output"] : [],
    };
  }
}

export class CompositeJudge implements EvalJudge {
  private commandJudge: CommandBasedJudge;
  private llmJudge: MockLLMJudge;
  private definition: LoopDefinition;
  private scoreHistory: number[] = [];

  constructor(definition: LoopDefinition, cwd: string = process.cwd()) {
    this.definition = definition;
    this.commandJudge = new CommandBasedJudge(cwd);
    this.llmJudge = new MockLLMJudge();
  }

  async evaluate(state: LoopState, taskOutput: string): Promise<EvalResult> {
    const evalConfig = this.definition.eval;

    const { results: conditionResults, allPassed: allConditionsPassed } = await this.commandJudge.checkConditions(evalConfig.conditions);
    const { violations: boundaryViolations } = await this.commandJudge.checkBoundaries(evalConfig.boundaryConditions);
    const llmResult = await this.llmJudge.evaluate(state, taskOutput);

    let score = allConditionsPassed ? llmResult.score : llmResult.score * 0.5;
    if (boundaryViolations.length > 0) score = 0;

    this.scoreHistory.push(score);
    let isStagnant = false;
    if (this.scoreHistory.length >= 3) {
      const recent = this.scoreHistory.slice(-3);
      isStagnant = Math.max(...recent) - Math.min(...recent) < 0.05;
    }

    const suggestions: string[] = [
      ...conditionResults.filter(r => !r.passed).map(r => r.suggestion || r.description),
      ...llmResult.suggestions,
      ...boundaryViolations.map(v => `BOUNDARY: ${v}`),
    ];

    return {
      score,
      reasoning: [
        `Hard conditions: ${conditionResults.filter(r => r.passed).length}/${conditionResults.length} passed`,
        ...conditionResults.map(r => `  ${r.passed ? "PASS" : "FAIL"}: ${r.description}`),
        `LLM score: ${llmResult.score.toFixed(2)}`,
        `Boundary violations: ${boundaryViolations.length}`,
        `Composite score: ${score.toFixed(2)}`,
      ].join("\n"),
      suggestions, isStagnant, allConditionsPassed, boundaryViolations,
    };
  }
}
