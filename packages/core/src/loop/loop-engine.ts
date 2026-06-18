import { LoopDefinition } from "./loop-definition.js";
import { LoopState, LoopPhase, createLoopState, transition, isTerminalPhase } from "./loop-state.js";
import type { AgentCore } from "../agent/agent-core.js";
import type { LLMClient } from "../llm/llm-client.js";

export interface ToolExecutor {
  execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: Array<{ type: string; path: string; description: string }>;
}

export interface EvalJudge {
  evaluate(state: LoopState, taskOutput: string): Promise<EvalResult>;
}

export interface EvalResult {
  score: number;
  reasoning: string;
  suggestions: string[];
  isStagnant: boolean;
  allConditionsPassed: boolean;
  boundaryViolations: string[];
}

export interface MemoryWriter {
  writeNudge(entry: MemoryEntry): Promise<void>;
  summarizeSession(sessionId: string): Promise<string>;
}

export interface MemoryEntry {
  type: "fact" | "pattern" | "error" | "skill_suggestion";
  content: string;
  confidence: number;
  source: string;
  timestamp: Date;
}

export interface LoopEngineConfig {
  definition: LoopDefinition;
  toolExecutor: ToolExecutor;
  evalJudge: EvalJudge;
  memoryWriter: MemoryWriter;
  /** Phase 2: LLM-driven agent core. When set, executePhase uses real LLM tool-use loop. */
  agentCore?: AgentCore;
  /** Phase 2: LLM client for agent messages. */
  llmClient?: LLMClient;
  onPhaseChange?: (state: LoopState) => void;
  onError?: (error: Error, state: LoopState) => void;
}

export class LoopEngine {
  private config: LoopEngineConfig;
  private state: LoopState;
  private abortController: AbortController | null = null;

  constructor(config: LoopEngineConfig) {
    this.config = config;
    const def = config.definition;
    this.state = createLoopState(def.id, def.execution.maxIterations, def.execution.maxTokensPerIter * def.execution.maxIterations, def.execution.timeoutSeconds);
  }

  getState(): Readonly<LoopState> { return this.state; }

  async run(taskContext: string): Promise<LoopState> {
    this.abortController = new AbortController();
    this.state = transition(this.state, LoopPhase.PREPARING);
    this.emitPhaseChange();

    try {
      while (!isTerminalPhase(this.state.phase)) {
        if (this.state.budget.isExhausted()) {
          this.state = { ...this.state, phase: LoopPhase.FAILED };
          break;
        }

        this.state.iteration++;
        this.state = transition(this.state, LoopPhase.EXECUTING);
        this.emitPhaseChange();

        const taskOutput = await this.executePhase(taskContext);
        // Budget consumed inside executePhase (AgentCore) or as fallback below
        if (!this.config.agentCore) {
          this.state.budget.consumeIteration(5000);
        }
        this.state.totalTokensUsed = this.state.budget.tokensUsed;

        this.state = transition(this.state, LoopPhase.EVALUATING);
        this.emitPhaseChange();

        const evalResult = await this.config.evalJudge.evaluate(this.state, taskOutput);
        this.state.lastEvalScore = evalResult.score;
        this.state.evalScoreHistory.push(evalResult.score);

        if (evalResult.isStagnant) {
          this.state.stagnantRoundsCount++;
        } else {
          this.state.stagnantRoundsCount = 0;
        }

        this.state = transition(this.state, LoopPhase.REFLECTING);
        this.emitPhaseChange();
        await this.reflectPhase(evalResult, taskOutput);

        this.state = transition(this.state, LoopPhase.DECIDING);
        this.emitPhaseChange();

        const def = this.config.definition;
        if (evalResult.allConditionsPassed && evalResult.score >= def.eval.threshold) {
          this.state = { ...this.state, phase: LoopPhase.COMPLETED };
        } else if (this.state.stagnantRoundsCount >= def.eval.stagnantRounds) {
          this.state = { ...this.state, phase: LoopPhase.STAGNANT };
        } else if (this.state.budget.isExhausted()) {
          this.state = { ...this.state, phase: LoopPhase.FAILED };
        }
      }
      return this.state;
    } catch (error) {
      this.state = { ...this.state, phase: LoopPhase.FAILED };
      this.config.onError?.(error as Error, this.state);
      return this.state;
    }
  }

  interrupt(): void {
    this.abortController?.abort();
    this.state = { ...this.state, phase: LoopPhase.INTERRUPTED };
  }

  private async executePhase(taskContext: string): Promise<string> {
    // Phase 2: Use AgentCore (LLM-driven tool-use loop) if available
    if (this.config.agentCore) {
      const agentResult = await this.config.agentCore.run(taskContext);
      if (agentResult.artifacts) this.state.artifacts.push(...agentResult.artifacts);

      // Track actual token usage from the agent
      this.state.budget.consumeIteration(agentResult.totalUsage.inputTokens + agentResult.totalUsage.outputTokens);
      this.state.totalTokensUsed = this.state.budget.tokensUsed;

      return JSON.stringify({
        output: agentResult.output,
        steps: agentResult.steps.length,
        toolCalls: agentResult.steps.filter(s => s.type === "tool_exec").length,
        tokens: agentResult.totalUsage,
      });
    }

    // Phase 1 fallback: direct tool executor (mock)
    const result = await this.config.toolExecutor.execute("run_task", {
      context: taskContext, skills: this.config.definition.skills, iteration: this.state.iteration,
    });
    if (result.artifacts) this.state.artifacts.push(...result.artifacts);
    return result.output;
  }

  private async reflectPhase(evalResult: EvalResult, taskOutput: string): Promise<void> {
    if (!this.config.definition.memory.autoNudge) return;

    await this.config.memoryWriter.writeNudge({
      type: "fact", content: `Iter ${this.state.iteration}: score=${evalResult.score.toFixed(2)}, conditions=${evalResult.allConditionsPassed ? "ALL" : "SOME_FAILED"}`,
      confidence: 0.9, source: `loop:${this.state.loopId}`, timestamp: new Date(),
    });

    if (evalResult.suggestions.length > 0) {
      await this.config.memoryWriter.writeNudge({
        type: "pattern", content: evalResult.suggestions.join("; "),
        confidence: 0.7, source: `loop:${this.state.loopId}:eval`, timestamp: new Date(),
      });
    }

    if (evalResult.score < 0.3) {
      await this.config.memoryWriter.writeNudge({
        type: "error", content: `Low score ${evalResult.score.toFixed(2)}: ${taskOutput.slice(0, 500)}`,
        confidence: 0.8, source: `loop:${this.state.loopId}:error`, timestamp: new Date(),
      });
    }
  }

  private emitPhaseChange(): void {
    this.config.onPhaseChange?.(this.state);
  }
}
