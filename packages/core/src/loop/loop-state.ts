export enum LoopPhase {
  IDLE = "idle",
  PREPARING = "preparing",
  EXECUTING = "executing",
  EVALUATING = "evaluating",
  REFLECTING = "reflecting",
  DECIDING = "deciding",
  COMPLETED = "completed",
  FAILED = "failed",
  STAGNANT = "stagnant",
  INTERRUPTED = "interrupted",
}

export function isTerminalPhase(phase: LoopPhase): boolean {
  return [LoopPhase.COMPLETED, LoopPhase.FAILED, LoopPhase.STAGNANT, LoopPhase.INTERRUPTED].includes(phase);
}

export interface LoopBudget {
  maxIterations: number;
  maxTokens: number;
  timeoutSeconds: number;
  iterationsUsed: number;
  tokensUsed: number;
  startTime: number;
  consumeIteration(tokensThisIter: number): void;
  remaining(): { iterations: number; tokens: number; timeoutMs: number };
  isExhausted(): boolean;
}

export function createLoopBudget(maxIterations: number, maxTokens: number, timeoutSeconds: number): LoopBudget {
  return {
    maxIterations, maxTokens, timeoutSeconds,
    iterationsUsed: 0, tokensUsed: 0, startTime: Date.now(),
    consumeIteration(tokensThisIter: number) {
      this.iterationsUsed++;
      this.tokensUsed += tokensThisIter;
    },
    remaining() {
      const elapsedMs = Date.now() - this.startTime;
      return {
        iterations: Math.max(0, this.maxIterations - this.iterationsUsed),
        tokens: Math.max(0, this.maxTokens - this.tokensUsed),
        timeoutMs: Math.max(0, this.timeoutSeconds * 1000 - elapsedMs),
      };
    },
    isExhausted() {
      const r = this.remaining();
      return r.iterations <= 0 || r.tokens <= 0 || r.timeoutMs <= 0;
    },
  };
}

export interface LoopState {
  loopId: string;
  phase: LoopPhase;
  iteration: number;
  startTime: Date;
  lastIterationTime: Date | null;
  totalTokensUsed: number;
  totalDurationMs: number;
  lastEvalScore: number | null;
  evalScoreHistory: number[];
  stagnantRoundsCount: number;
  budget: LoopBudget;
  artifacts: Array<{ type: string; path: string; description: string }>;
}

export function createLoopState(loopId: string, maxIterations: number, maxTokens: number, timeoutSeconds: number): LoopState {
  return {
    loopId, phase: LoopPhase.IDLE, iteration: 0,
    startTime: new Date(), lastIterationTime: null,
    totalTokensUsed: 0, totalDurationMs: 0,
    lastEvalScore: null, evalScoreHistory: [], stagnantRoundsCount: 0,
    budget: createLoopBudget(maxIterations, maxTokens, timeoutSeconds),
    artifacts: [],
  };
}

export function transition(state: LoopState, to: LoopPhase): LoopState {
  if (isTerminalPhase(state.phase)) {
    throw new Error(`Cannot transition from terminal phase '${state.phase}' to '${to}'`);
  }
  return { ...state, phase: to, lastIterationTime: new Date() };
}
