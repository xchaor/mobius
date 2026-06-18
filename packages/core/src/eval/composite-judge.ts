import { EvalJudge, EvalResult, LoopState } from "../loop/loop-engine.js";
import { LoopDefinition } from "../loop/loop-definition.js";
import { CommandBasedJudge } from "./command-judge.js";

export class MockLLMJudge {
  async evaluate(_state: LoopState, taskOutput: string): Promise<{ score: number; reasoning: string; suggestions: string[] }> {
    const hasCode = taskOutput.includes("function") || taskOutput.includes("class") || taskOutput.includes("export") || taskOutput.includes("Wrote");
    const hasTests = taskOutput.includes("test") || taskOutput.includes("describe") || taskOutput.includes("it(");
    const hasError = taskOutput.includes("Error") || taskOutput.includes("FAIL") || taskOutput.includes("FORBIDDEN");

    let score = 0.5;
    if (hasCode && hasTests) score = 0.8;
    if (hasError) score = Math.max(0.2, score - 0.4);

    return { score, reasoning: `[Phase 1 mock] Code:${hasCode} Tests:${hasTests} Errors:${hasError}`, suggestions: hasError ? ["Fix errors detected in output"] : [] };
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
