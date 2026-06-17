# Mobius Agent Phase 1: 莫比乌斯之心 实现计划

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** 实现最小 Möbius Loop — 给定一个代码任务，Agent 自己写代码、运行测试、根据结果修复、循环直到通过或 budget 耗尽，并将经验写入 Memory。

**Architecture:** 三层架构 — Mobius Brain (TypeScript 主控) + OpenClaw 骨架 (Gateway/Plugin/Channel/Worktree) + Hermes 安全层 (Python 独立进程, gRPC 通信)。Phase 1 不实现深度委派，专注单层 Loop 的核心链路：Trigger → Execute → Evaluate → Reflect → Memory Nudge。

**Tech Stack:** TypeScript (Node.js 20+), Python 3.12+ (安全层), gRPC/Protobuf (跨语言通信), SQLite (Memory 存储), YAML (Loop DSL), Git Worktree (执行隔离)

---

## 项目初始化

### Task 1: Monorepo 项目结构搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `pnpm-workspace.yaml`
- Create: `packages/core/package.json`
- Create: `packages/gateway/package.json`
- Create: `packages/guardrails-py/pyproject.toml`
- Create: `.gitignore`
- Create: `.claude/CLAUDE.md`

**Step 1: 创建根 package.json**

```bash
mkdir -p /Users/apple/vscodeproject/mobius-agent/packages/{core,gateway,guardrails-py}
cd /Users/apple/vscodeproject/mobius-agent
```

Create `package.json`:

```json
{
  "name": "mobius-agent",
  "version": "0.1.0",
  "private": true,
  "description": "Next-gen Loop Engineering AI Agent — built on OpenClaw & Hermes shoulders",
  "scripts": {
    "dev": "pnpm --filter @mobius/core dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

**Step 2: 创建 pnpm workspace**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: 创建各子包 package.json**

Create `packages/core/package.json`:

```json
{
  "name": "@mobius/core",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.10.0",
    "@grpc/proto-loader": "^0.7.0",
    "better-sqlite3": "^11.0.0",
    "js-yaml": "^4.1.0",
    "pino": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/js-yaml": "^4.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^9.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

Create `packages/gateway/package.json`:

```json
{
  "name": "@mobius/gateway",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "dependencies": {
    "@mobius/core": "workspace:*"
  }
}
```

Create `packages/guardrails-py/pyproject.toml`:

```toml
[project]
name = "mobius-guardrails"
version = "0.1.0"
description = "Mobius Agent security guardrails (Python) — inspired by Hermes"
requires-python = ">=3.12"
dependencies = [
    "grpcio>=1.60.0",
    "grpcio-tools>=1.60.0",
    "pydantic>=2.0.0",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"
```

**Step 5: 创建 .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
__pycache__/
*.pyc
.venv/
.env
*.log
.worktrees/
```

**Step 6: 更新 CLAUDE.md**

Create `.claude/CLAUDE.md`:

```markdown
# Mobius Agent

Next-gen Loop Engineering AI Agent.

## Architecture
- `packages/core/` — Möbius Brain: Loop engine, Eval, Memory, Delegation
- `packages/gateway/` — OpenClaw-inspired Gateway & Plugin system
- `packages/guardrails-py/` — Hermes-inspired Python security layer

## Key Principles
- Möbius Loop: execute-and-learn in one pass
- Depth-N delegation via recursive Actor model
- Eval-driven adaptive termination
- Security as independent process

## Commands
- `pnpm dev` — Start development server
- `pnpm test` — Run all tests
- `pnpm build` — Build all packages
```

**Step 7: 安装依赖**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm install
```

**Step 8: 初始化 Python 虚拟环境**

```bash
cd packages/guardrails-py
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo structure for mobius-agent

- packages/core: Möbius Brain (Loop, Eval, Memory)
- packages/gateway: OpenClaw-inspired Gateway & Plugin system
- packages/guardrails-py: Hermes-inspired Python security layer
- pnpm workspace with shared tsconfig"
```

---

## 通信协议

### Task 2: gRPC Protobuf 协议定义

**Files:**
- Create: `proto/mobius/v1/guardrails.proto`
- Create: `proto/mobius/v1/loop.proto`
- Create: `proto/buf.yaml`

**Step 1: 创建安全层 proto**

Create `proto/mobius/v1/guardrails.proto`:

```protobuf
syntax = "proto3";

package mobius.v1;

// Hermes-inspired guardrails service
service GuardrailsService {
  // Check a tool call before execution
  rpc CheckToolCall(CheckToolCallRequest) returns (CheckToolCallResponse);

  // Scan context for injection threats
  rpc ScanContext(ScanContextRequest) returns (ScanContextResponse);

  // Report a tool execution result for behavior analysis
  rpc ReportExecution(ReportExecutionRequest) returns (ReportExecutionResponse);
}

message CheckToolCallRequest {
  string agent_id = 1;
  string tool_name = 2;
  string tool_params_json = 3;
  int32 iteration_count = 4;
}

message CheckToolCallResponse {
  enum Decision {
    ALLOW = 0;
    DENY = 1;
    WARN = 2;
    REQUIRE_HUMAN = 3;
  }
  Decision decision = 1;
  string reason = 2;
  repeated string warnings = 3;
}

message ScanContextRequest {
  string agent_id = 1;
  string context_text = 2;
}

message ScanContextResponse {
  bool safe = 1;
  repeated string threats_found = 2;
}

message ReportExecutionRequest {
  string agent_id = 1;
  string tool_name = 2;
  string result_summary = 3;
  int64 duration_ms = 4;
}

message ReportExecutionResponse {
  bool anomaly_detected = 1;
  string anomaly_description = 2;
}
```

**Step 2: 创建 Loop proto**

Create `proto/mobius/v1/loop.proto`:

```protobuf
syntax = "proto3";

package mobius.v1;

message LoopDefinition {
  string id = 1;
  string name = 2;
  string description = 3;

  // Trigger
  oneof trigger {
    CronTrigger cron = 4;
    EventTrigger event = 5;
    ManualTrigger manual = 6;
  }

  // Execution config
  ExecutionConfig execution = 7;

  // Evaluation config
  EvalConfig eval = 8;

  // Skills to load
  repeated string skills = 9;

  // MCP connectors
  repeated string mcp_connectors = 10;

  // Delegation config
  DelegationConfig delegation = 11;

  // Memory config
  MemoryConfig memory = 12;

  // Failure handling
  FailureConfig on_failure = 13;
}

message CronTrigger {
  string cron_expression = 1;  // "0 */2 * * *"
}

message EventTrigger {
  string event_type = 1;  // "github.pr.updated", "file.changed"
  string filter = 2;      // JSON path filter
}

message ManualTrigger {
  string command_name = 1;  // slash command name
}

message ExecutionConfig {
  int32 max_iterations = 1;      // default: 100 (借鉴Hermes)
  int32 max_tokens_per_iter = 2;  // default: 50000
  int32 timeout_seconds = 3;      // default: 3600
  bool use_worktree = 4;          // default: true
  string worktree_mode = 5;       // "fresh" | "head"
}

message EvalConfig {
  string judge_model = 1;    // "claude-sonnet-4-6"
  double threshold = 2;      // 0.0-1.0, 达到此分数则终止
  int32 max_retries = 3;     // 最大重试次数
  int32 stagnant_rounds = 4; // 连续N轮无提升则终止
}

message DelegationConfig {
  int32 max_depth = 1;           // 最大委派深度
  int32 max_subagents = 2;       // 全局最大子Agent数
  int32 budget_per_node = 3;     // 每个子Agent的token预算
}

message MemoryConfig {
  bool auto_nudge = 1;           // 自动沉淀经验
  bool auto_skill_creation = 2;  // 自动创建Skill
  int32 claude_md_max_lines = 3; // CLAUDE.md 最大行数, 超限触发洁癖
}

message FailureConfig {
  enum Strategy {
    RETRY = 0;
    ESCALATE_TO_HUMAN = 1;
    GRACEFUL_DEGRADE = 2;
    ABORT = 3;
  }
  Strategy strategy = 1;
  int32 max_retries = 2;
  string escalation_channel = 3;  // "slack", "email"
}
```

**Step 3: 创建 buf 配置**

Create `proto/buf.yaml`:

```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - DEFAULT
breaking:
  use:
    - FILE
```

**Step 4: 提交 proto**

```bash
git add proto/
git commit -m "feat: define gRPC protobuf contracts for guardrails and loop"
```

---

## Loop 核心引擎

### Task 3: Loop DSL 解析器

**Files:**
- Create: `packages/core/src/loop/loop-definition.ts`
- Create: `packages/core/src/loop/loop-parser.ts`
- Create: `packages/core/src/loop/__tests__/loop-parser.test.ts`

**Step 1: 用 Zod 写 Loop Definition Schema**

Create `packages/core/src/loop/loop-definition.ts`:

```typescript
import { z } from "zod";

export const CronTriggerSchema = z.object({
  type: z.literal("cron"),
  cronExpression: z.string(),
});

export const EventTriggerSchema = z.object({
  type: z.literal("event"),
  eventType: z.string(),
  filter: z.string().optional(),
});

export const ManualTriggerSchema = z.object({
  type: z.literal("manual"),
  commandName: z.string(),
});

export const TriggerSchema = z.discriminatedUnion("type", [
  CronTriggerSchema,
  EventTriggerSchema,
  ManualTriggerSchema,
]);

export const ExecutionConfigSchema = z.object({
  maxIterations: z.number().int().positive().default(100),
  maxTokensPerIter: z.number().int().positive().default(50000),
  timeoutSeconds: z.number().int().positive().default(3600),
  useWorktree: z.boolean().default(true),
  worktreeMode: z.enum(["fresh", "head"]).default("fresh"),
});

export const EvalConfigSchema = z.object({
  judgeModel: z.string().default("claude-sonnet-4-6"),
  threshold: z.number().min(0).max(1).default(0.8),
  maxRetries: z.number().int().positive().default(3),
  stagnantRounds: z.number().int().positive().default(3),
});

export const DelegationConfigSchema = z.object({
  maxDepth: z.number().int().min(0).max(10).default(0),
  maxSubagents: z.number().int().positive().default(10),
  budgetPerNode: z.number().int().positive().default(100000),
});

export const MemoryConfigSchema = z.object({
  autoNudge: z.boolean().default(true),
  autoSkillCreation: z.boolean().default(false),
  claudeMdMaxLines: z.number().int().positive().default(200),
});

export const FailureConfigSchema = z.object({
  strategy: z
    .enum(["retry", "escalate_to_human", "graceful_degrade", "abort"])
    .default("retry"),
  maxRetries: z.number().int().positive().default(3),
  escalationChannel: z.string().optional(),
});

export const LoopDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  trigger: TriggerSchema,
  execution: ExecutionConfigSchema.default({}),
  eval: EvalConfigSchema.default({}),
  skills: z.array(z.string()).default([]),
  mcpConnectors: z.array(z.string()).default([]),
  delegation: DelegationConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  onFailure: FailureConfigSchema.default({}),
});

export type LoopDefinition = z.infer<typeof LoopDefinitionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type EvalConfig = z.infer<typeof EvalConfigSchema>;
export type FailureConfig = z.infer<typeof FailureConfigSchema>;
```

**Step 2: 写 YAML 解析器**

Create `packages/core/src/loop/loop-parser.ts`:

```typescript
import * as yaml from "js-yaml";
import { readFileSync } from "fs";
import { LoopDefinitionSchema, LoopDefinition } from "./loop-definition.js";

/**
 * Parse a Loop Definition from a YAML string.
 * Validates against the Zod schema and returns the parsed object.
 */
export function parseLoopDefinition(yamlContent: string): LoopDefinition {
  const raw = yaml.load(yamlContent);
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid YAML: expected a mapping at the top level");
  }
  return LoopDefinitionSchema.parse(raw);
}

/**
 * Load a Loop Definition from a YAML file on disk.
 */
export function loadLoopDefinition(filePath: string): LoopDefinition {
  const content = readFileSync(filePath, "utf-8");
  return parseLoopDefinition(content);
}

/**
 * Serialize a Loop Definition back to a canonical YAML string.
 */
export function serializeLoopDefinition(loop: LoopDefinition): string {
  return yaml.dump(LoopDefinitionSchema.parse(loop));
}
```

**Step 3: 写测试（先写测试，遵循 TDD）**

Create `packages/core/src/loop/__tests__/loop-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseLoopDefinition } from "../loop-parser.js";

const MINIMAL_LOOP_YAML = `
id: test-loop-1
name: Test Loop
trigger:
  type: manual
  commandName: test-loop
`;

const FULL_LOOP_YAML = `
id: babysit-prs
name: PR Babysitter
description: Auto-fix CI and handle review comments for all PRs
trigger:
  type: cron
  cronExpression: "0 */2 * * *"
execution:
  maxIterations: 50
  maxTokensPerIter: 30000
  useWorktree: true
  worktreeMode: fresh
eval:
  judgeModel: claude-sonnet-4-6
  threshold: 0.8
  maxRetries: 2
  stagnantRounds: 2
skills:
  - code-review
  - ci-fix
mcpConnectors:
  - github
  - slack
delegation:
  maxDepth: 2
  maxSubagents: 5
  budgetPerNode: 150000
memory:
  autoNudge: true
  autoSkillCreation: true
  claudeMdMaxLines: 150
onFailure:
  strategy: escalate_to_human
  maxRetries: 3
  escalationChannel: slack
`;

describe("parseLoopDefinition", () => {
  it("parses a minimal loop definition with defaults", () => {
    const loop = parseLoopDefinition(MINIMAL_LOOP_YAML);
    expect(loop.id).toBe("test-loop-1");
    expect(loop.name).toBe("Test Loop");
    expect(loop.trigger.type).toBe("manual");
    if (loop.trigger.type === "manual") {
      expect(loop.trigger.commandName).toBe("test-loop");
    }
    // Defaults applied by Zod
    expect(loop.execution.maxIterations).toBe(100);
    expect(loop.eval.threshold).toBe(0.8);
    expect(loop.delegation.maxDepth).toBe(0);
    expect(loop.memory.autoNudge).toBe(true);
  });

  it("parses a full loop definition with all fields", () => {
    const loop = parseLoopDefinition(FULL_LOOP_YAML);
    expect(loop.id).toBe("babysit-prs");
    expect(loop.trigger.type).toBe("cron");
    if (loop.trigger.type === "cron") {
      expect(loop.trigger.cronExpression).toBe("0 */2 * * *");
    }
    expect(loop.execution.maxIterations).toBe(50);
    expect(loop.eval.threshold).toBe(0.8);
    expect(loop.skills).toContain("code-review");
    expect(loop.skills).toContain("ci-fix");
    expect(loop.mcpConnectors).toContain("github");
    expect(loop.delegation.maxDepth).toBe(2);
    expect(loop.delegation.maxSubagents).toBe(5);
    expect(loop.memory.autoSkillCreation).toBe(true);
    expect(loop.onFailure.strategy).toBe("escalate_to_human");
  });

  it("throws on invalid YAML", () => {
    expect(() => parseLoopDefinition(": invalid: yaml: :")).toThrow();
  });

  it("throws on missing required field (name)", () => {
    const badYaml = `
id: missing-name
trigger:
  type: manual
  commandName: test
`;
    expect(() => parseLoopDefinition(badYaml)).toThrow();
  });

  it("throws on invalid trigger type", () => {
    const badYaml = `
id: bad-trigger
name: Bad Trigger
trigger:
  type: unknown_type
`;
    expect(() => parseLoopDefinition(badYaml)).toThrow();
  });
});
```

**Step 4: 运行测试验证失败（TDD 红阶段）**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 部分测试 FAIL — 因为 `parseLoopDefinition` 还没实现完（需要确认 js-yaml 依赖安装）。

**Step 5: 安装依赖 & 跑通测试（绿阶段）**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm install
cd packages/core
pnpm test -- --run
```

Expected: 5 tests PASS

**Step 6: Commit**

```bash
git add packages/core/src/loop/ packages/core/package.json
git commit -m "feat(core): implement Loop DSL parser with Zod validation

- LoopDefinitionSchema with full type safety via Zod
- YAML parser with validation
- 5 unit tests covering minimal, full, and error cases"
```

---

### Task 4: Loop 执行引擎 — 核心状态机

**Files:**
- Create: `packages/core/src/loop/loop-state.ts`
- Create: `packages/core/src/loop/loop-engine.ts`
- Create: `packages/core/src/loop/__tests__/loop-engine.test.ts`

**Step 1: 定义 Loop 状态**

Create `packages/core/src/loop/loop-state.ts`:

```typescript
export enum LoopPhase {
  /** Initial state, not yet started */
  IDLE = "idle",
  /** Loading skills and MCP connectors */
  PREPARING = "preparing",
  /** Executing tool calls / sub-agents */
  EXECUTING = "executing",
  /** Running LLM-as-Judge evaluation */
  EVALUATING = "evaluating",
  /** Writing to Memory layer */
  REFLECTING = "reflecting",
  /** Decision point: continue or terminate? */
  DECIDING = "deciding",
  /** Loop completed successfully */
  COMPLETED = "completed",
  /** Loop terminated due to failure */
  FAILED = "failed",
  /** Loop interrupted by human / signal */
  INTERRUPTED = "interrupted",
}

export interface LoopState {
  loopId: string;
  phase: LoopPhase;
  iteration: number;
  startTime: Date;
  lastIterationTime: Date | null;

  // Execution tracking
  totalTokensUsed: number;
  totalDurationMs: number;

  // Evaluation tracking
  lastEvalScore: number | null;
  evalScoreHistory: number[];
  stagnantRoundsCount: number;

  // Budget tracking
  budget: {
    maxIterations: number;
    maxTokens: number;
    timeoutSeconds: number;
    remaining(): { iterations: number; tokens: number; timeoutMs: number };
  };

  // Artifacts produced
  artifacts: Array<{
    type: string;
    path: string;
    description: string;
  }>;
}

export function createLoopState(
  loopId: string,
  maxIterations: number,
  maxTokens: number,
  timeoutSeconds: number
): LoopState {
  const startTime = new Date();
  return {
    loopId,
    phase: LoopPhase.IDLE,
    iteration: 0,
    startTime,
    lastIterationTime: null,
    totalTokensUsed: 0,
    totalDurationMs: 0,
    lastEvalScore: null,
    evalScoreHistory: [],
    stagnantRoundsCount: 0,
    budget: {
      maxIterations,
      maxTokens,
      timeoutSeconds,
      remaining() {
        const elapsedMs = Date.now() - startTime.getTime();
        return {
          iterations: maxIterations - 0, // updated externally
          tokens: maxTokens - 0,         // updated externally
          timeoutMs: timeoutSeconds * 1000 - elapsedMs,
        };
      },
    },
    artifacts: [],
  };
}

export function isTerminalPhase(phase: LoopPhase): boolean {
  return [
    LoopPhase.COMPLETED,
    LoopPhase.FAILED,
    LoopPhase.INTERRUPTED,
  ].includes(phase);
}

export function transition(
  state: LoopState,
  to: LoopPhase
): LoopState {
  if (isTerminalPhase(state.phase)) {
    throw new Error(
      `Cannot transition from terminal phase '${state.phase}' to '${to}'`
    );
  }
  return { ...state, phase: to, lastIterationTime: new Date() };
}
```

**Step 2: 实现 Loop 引擎**

Create `packages/core/src/loop/loop-engine.ts`:

```typescript
import { LoopDefinition } from "./loop-definition.js";
import {
  LoopState,
  LoopPhase,
  createLoopState,
  transition,
  isTerminalPhase,
} from "./loop-state.js";

export interface ToolExecutor {
  execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  artifacts?: Array<{ type: string; path: string; description: string }>;
}

export interface EvalJudge {
  evaluate(loopState: LoopState, taskOutput: string): Promise<EvalResult>;
}

export interface EvalResult {
  score: number;        // 0.0 - 1.0
  reasoning: string;
  suggestions: string[];
  isStagnant: boolean;
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
  onPhaseChange?: (state: LoopState) => void;
  onError?: (error: Error, state: LoopState) => void;
}

/**
 * Möbius Loop Engine — the heart of Mobius Agent.
 *
 * Implements the Execute → Evaluate → Reflect → Decide cycle.
 * Each iteration simultaneously writes to Memory (Möbius single-sided loop).
 */
export class LoopEngine {
  private config: LoopEngineConfig;
  private state: LoopState;
  private abortController: AbortController | null = null;

  constructor(config: LoopEngineConfig) {
    this.config = config;
    const def = config.definition;
    this.state = createLoopState(
      def.id,
      def.execution.maxIterations,
      def.execution.maxTokensPerIter * def.execution.maxIterations,
      def.execution.timeoutSeconds
    );
  }

  getState(): Readonly<LoopState> {
    return this.state;
  }

  /** Start the Möbius Loop. Returns the final state. */
  async run(taskContext: string): Promise<LoopState> {
    this.abortController = new AbortController();
    this.state = transition(this.state, LoopPhase.PREPARING);
    this.emitPhaseChange();

    try {
      while (!isTerminalPhase(this.state.phase)) {
        // Check budget before each iteration
        const remaining = this.state.budget.remaining();
        if (remaining.iterations <= 0) {
          this.state = { ...this.state, phase: LoopPhase.COMPLETED };
          break;
        }
        if (remaining.timeoutMs <= 0) {
          this.state = { ...this.state, phase: LoopPhase.FAILED };
          break;
        }

        this.state.iteration++;
        this.state = transition(this.state, LoopPhase.EXECUTING);
        this.emitPhaseChange();

        // === EXECUTE phase ===
        const taskOutput = await this.executePhase(taskContext);
        this.state.totalTokensUsed += 5000; // placeholder: real count from API

        // === EVALUATE phase ===
        this.state = transition(this.state, LoopPhase.EVALUATING);
        this.emitPhaseChange();

        const evalResult = await this.config.evalJudge.evaluate(
          this.state,
          taskOutput
        );
        this.state.lastEvalScore = evalResult.score;
        this.state.evalScoreHistory.push(evalResult.score);

        // Check stagnant
        if (evalResult.isStagnant) {
          this.state.stagnantRoundsCount++;
        } else {
          this.state.stagnantRoundsCount = 0;
        }

        // === REFLECT phase (Memory Nudge — Möbius key) ===
        this.state = transition(this.state, LoopPhase.REFLECTING);
        this.emitPhaseChange();

        await this.reflectPhase(evalResult, taskOutput);

        // === DECIDE phase ===
        this.state = transition(this.state, LoopPhase.DECIDING);
        this.emitPhaseChange();

        const def = this.config.definition;
        if (evalResult.score >= def.eval.threshold) {
          this.state = { ...this.state, phase: LoopPhase.COMPLETED };
        } else if (
          this.state.stagnantRoundsCount >= def.eval.stagnantRounds
        ) {
          // Stagnant — terminate
          this.state = { ...this.state, phase: LoopPhase.COMPLETED };
        } else if (this.state.iteration >= def.eval.maxRetries + 1) {
          // Exceeded retries
          this.state = {
            ...this.state,
            phase:
              def.onFailure.strategy === "escalate_to_human"
                ? LoopPhase.INTERRUPTED
                : LoopPhase.FAILED,
          };
        }
        // else: continue loop
      }

      return this.state;
    } catch (error) {
      this.state = { ...this.state, phase: LoopPhase.FAILED };
      this.config.onError?.(error as Error, this.state);
      return this.state;
    }
  }

  /** Gracefully interrupt the loop at the next decision point */
  interrupt(): void {
    this.abortController?.abort();
    this.state = { ...this.state, phase: LoopPhase.INTERRUPTED };
  }

  private async executePhase(
    taskContext: string
  ): Promise<string> {
    // In Phase 1: single tool call execution
    // In later phases: delegation tree expansion
    const result = await this.config.toolExecutor.execute("run_task", {
      context: taskContext,
      skills: this.config.definition.skills,
      iteration: this.state.iteration,
    });

    if (result.artifacts) {
      this.state.artifacts.push(...result.artifacts);
    }

    return result.output;
  }

  private async reflectPhase(
    evalResult: EvalResult,
    taskOutput: string
  ): Promise<void> {
    if (!this.config.definition.memory.autoNudge) return;

    // Always write eval result as memory
    await this.config.memoryWriter.writeNudge({
      type: "fact",
      content: `Iteration ${this.state.iteration}: score=${evalResult.score}, reasoning=${evalResult.reasoning}`,
      confidence: 0.9,
      source: `loop:${this.state.loopId}`,
      timestamp: new Date(),
    });

    // If a pattern is detected, write it
    if (evalResult.suggestions.length > 0) {
      await this.config.memoryWriter.writeNudge({
        type: "pattern",
        content: `Suggestions from iteration ${this.state.iteration}: ${evalResult.suggestions.join("; ")}`,
        confidence: 0.7,
        source: `loop:${this.state.loopId}:eval`,
        timestamp: new Date(),
      });
    }

    // If error pattern detected
    if (evalResult.score < 0.3) {
      await this.config.memoryWriter.writeNudge({
        type: "error",
        content: `Low score (${evalResult.score}) in iteration ${this.state.iteration}. Output: ${taskOutput.slice(0, 500)}`,
        confidence: 0.8,
        source: `loop:${this.state.loopId}:error`,
        timestamp: new Date(),
      });
    }
  }

  private emitPhaseChange(): void {
    this.config.onPhaseChange?.(this.state);
  }
}
```

**Step 3: 写测试（模拟依赖）**

Create `packages/core/src/loop/__tests__/loop-engine.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { LoopEngine, LoopEngineConfig } from "../loop-engine.js";
import { LoopDefinition } from "../loop-definition.js";
import { LoopPhase } from "../loop-state.js";

function mockConfig(overrides?: Partial<LoopDefinition>): LoopEngineConfig {
  const definition: LoopDefinition = {
    id: "test-loop",
    name: "Test Loop",
    trigger: { type: "manual", commandName: "test" },
    execution: { maxIterations: 3, maxTokensPerIter: 1000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
    eval: { judgeModel: "test-model", threshold: 0.8, maxRetries: 2, stagnantRounds: 2 },
    delegation: { maxDepth: 0, maxSubagents: 0, budgetPerNode: 0 },
    memory: { autoNudge: true, autoSkillCreation: false, claudeMdMaxLines: 200 },
    onFailure: { strategy: "retry", maxRetries: 2 },
    skills: [],
    mcpConnectors: [],
    ...overrides,
  };

  return {
    definition,
    toolExecutor: {
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: "Task output: code written and tested successfully",
        artifacts: [{ type: "file", path: "/tmp/test.ts", description: "Test file" }],
      }),
    },
    evalJudge: {
      evaluate: vi.fn(),
    },
    memoryWriter: {
      writeNudge: vi.fn().mockResolvedValue(undefined),
      summarizeSession: vi.fn().mockResolvedValue("Session summary"),
    },
  };
}

describe("LoopEngine", () => {
  it("completes immediately when eval score exceeds threshold on first try", async () => {
    const config = mockConfig();
    (config.evalJudge.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 0.9,
      reasoning: "All tests pass",
      suggestions: [],
      isStagnant: false,
    });

    const engine = new LoopEngine(config);
    const result = await engine.run("Write a hello world function");

    expect(result.phase).toBe(LoopPhase.COMPLETED);
    expect(result.iteration).toBe(1);
    expect(result.lastEvalScore).toBe(0.9);
  });

  it("loops multiple times until score meets threshold", async () => {
    const config = mockConfig();
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate
      .mockResolvedValueOnce({
        score: 0.3,
        reasoning: "Tests failing",
        suggestions: ["Fix the return type"],
        isStagnant: false,
      })
      .mockResolvedValueOnce({
        score: 0.6,
        reasoning: "Tests pass but lint fails",
        suggestions: ["Run linter"],
        isStagnant: false,
      })
      .mockResolvedValueOnce({
        score: 0.85,
        reasoning: "All checks pass",
        suggestions: [],
        isStagnant: false,
      });

    const engine = new LoopEngine(config);
    const result = await engine.run("Write a hello world function");

    expect(result.phase).toBe(LoopPhase.COMPLETED);
    expect(result.iteration).toBe(3);
    expect(result.evalScoreHistory).toEqual([0.3, 0.6, 0.85]);
  });

  it("terminates when stagnant rounds exceed threshold", async () => {
    const config = mockConfig({
      eval: { judgeModel: "test", threshold: 0.8, maxRetries: 10, stagnantRounds: 2 },
    });
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate.mockResolvedValue({
      score: 0.3,
      reasoning: "Still failing",
      suggestions: [],
      isStagnant: true, // stagnant each round
    });

    const engine = new LoopEngine(config);
    const result = await engine.run("An impossible task");

    // Should complete due to stagnation, not keep looping
    expect(result.phase).toBe(LoopPhase.COMPLETED);
    expect(result.stagnantRoundsCount).toBeGreaterThanOrEqual(2);
  });

  it("writes memory nudge after each iteration", async () => {
    const config = mockConfig();
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate
      .mockResolvedValueOnce({ score: 0.5, reasoning: "OK", suggestions: ["Improve X"], isStagnant: false })
      .mockResolvedValueOnce({ score: 0.9, reasoning: "Good", suggestions: [], isStagnant: false });

    const engine = new LoopEngine(config);
    await engine.run("A task");

    const writeNudge = config.memoryWriter.writeNudge as ReturnType<typeof vi.fn>;
    expect(writeNudge).toHaveBeenCalled();
    // At least once per iteration
    expect(writeNudge.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("transitions to FAILED when executor throws", async () => {
    const config = mockConfig();
    (config.toolExecutor.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Tool execution failed catastrophically")
    );

    const engine = new LoopEngine(config);
    const result = await engine.run("A doomed task");

    expect(result.phase).toBe(LoopPhase.FAILED);
  });
});
```

**Step 4: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/loop/
git commit -m "feat(core): implement Möbius Loop engine with state machine

Core engine implementing Execute → Evaluate → Reflect → Decide cycle.
Key features:
- State machine with 9 phases (IDLE → PREPARING → EXECUTING → EVALUATING → REFLECTING → DECIDING → COMPLETED/FAILED/INTERRUPTED)
- Eval-driven adaptive termination (score threshold + stagnant detection)
- Memory Nudge in every iteration (Möbius single-sided loop)
- Budget tracking (iterations, tokens, timeout)
- Graceful interrupt support

5 unit tests covering: fast completion, multi-iteration, stagnant termination, memory nudge, error handling"
```

---

### Task 5: Loop DSL 示例文件 — 第一个可用的 Loop

**Files:**
- Create: `loops/hello-world.loop.yaml`
- Create: `loops/babysit-prs.loop.yaml`

**Step 1: 创建验收测试用的 Hello World Loop**

Create `loops/hello-world.loop.yaml`:

```yaml
# 最小验收 Loop: 写代码 → 跑测试 → 修Bug → 循环 → 通过
id: hello-world-loop
name: Hello World TDD Loop
description: |
  给定一个编程任务，Agent自动写代码、跑测试、
  根据测试结果修复、循环直到通过或budget耗尽。
trigger:
  type: manual
  commandName: hello-loop

execution:
  maxIterations: 10
  maxTokensPerIter: 20000
  timeoutSeconds: 600
  useWorktree: true
  worktreeMode: fresh

eval:
  judgeModel: claude-sonnet-4-6
  threshold: 0.8
  maxRetries: 5
  stagnantRounds: 3

skills:
  - test-driven-development
  - systematic-debugging

memory:
  autoNudge: true
  autoSkillCreation: false
  claudeMdMaxLines: 200

onFailure:
  strategy: escalate_to_human
  maxRetries: 3
```

**Step 2: 创建 PR Babysitter Loop（Phase 2 验收目标，先写好定义）**

Create `loops/babysit-prs.loop.yaml`:

```yaml
id: babysit-prs
name: PR Babysitter
description: |
  自动监控所有PR — CI挂了就修，有新Review就派子Agent处理。
  这就是Boris说的"睡觉时几千个Agent在跑"的Loop。
trigger:
  type: cron
  cronExpression: "*/30 * * * *"  # 每30分钟
#   type: event                   # 也支持事件触发
#   eventType: github.pr.updated

execution:
  maxIterations: 50
  maxTokensPerIter: 50000
  timeoutSeconds: 3600
  useWorktree: true
  worktreeMode: fresh

eval:
  judgeModel: claude-sonnet-4-6
  threshold: 0.85
  maxRetries: 3
  stagnantRounds: 2

skills:
  - code-review
  - test-driven-development
  - systematic-debugging

mcpConnectors:
  - github
  - slack

delegation:
  maxDepth: 3
  maxSubagents: 10
  budgetPerNode: 200000

memory:
  autoNudge: true
  autoSkillCreation: true
  claudeMdMaxLines: 200

onFailure:
  strategy: escalate_to_human
  maxRetries: 2
  escalationChannel: slack
```

**Step 3: 验证 Loop 定义可以正常解析**

```bash
cd packages/core
pnpm test -- --run
```

添加集成测试验证两个 yaml 文件能被正确解析：

```typescript
// In loop-parser.test.ts, add:
import { loadLoopDefinition } from "../loop-parser.js";
import { resolve } from "path";

describe("loadLoopDefinition from files", () => {
  it("loads hello-world.loop.yaml", () => {
    const loop = loadLoopDefinition(
      resolve(__dirname, "../../../../loops/hello-world.loop.yaml")
    );
    expect(loop.id).toBe("hello-world-loop");
    expect(loop.trigger.type).toBe("manual");
  });

  it("loads babysit-prs.loop.yaml", () => {
    const loop = loadLoopDefinition(
      resolve(__dirname, "../../../../loops/babysit-prs.loop.yaml")
    );
    expect(loop.id).toBe("babysit-prs");
    expect(loop.delegation.maxDepth).toBe(3);
  });
});
```

**Step 4: Commit**

```bash
git add loops/ packages/core/src/loop/__tests__/
git commit -m "feat: add first Loop DSL definitions and file-loading tests

- hello-world.loop.yaml: minimal TDD loop (Phase 1 acceptance)
- babysit-prs.loop.yaml: full PR babysitter loop (Phase 2 target)
- Integration tests for loading .yaml loop files from disk"
```

---

## Memory 层

### Task 6: SQLite Memory 存储

**Files:**
- Create: `packages/core/src/memory/schema.sql`
- Create: `packages/core/src/memory/memory-store.ts`
- Create: `packages/core/src/memory/__tests__/memory-store.test.ts`

**Step 1: 定义数据库 schema**

Create `packages/core/src/memory/schema.sql`:

```sql
-- Mobius Memory Layer
-- L2 (温数据/Session) + L3 (冷数据/永久) 存储

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  loop_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, interrupted
  summary TEXT,
  total_iterations INTEGER DEFAULT 0,
  best_score REAL
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL CHECK (type IN ('fact', 'pattern', 'error', 'skill_suggestion')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_entries_session ON memory_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_confidence ON memory_entries(confidence);

-- Skill suggestions that may be promoted to actual skills
CREATE TABLE IF NOT EXISTS skill_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_condition TEXT,
  content_markdown TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  occurrence_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'promoted', 'rejected', 'superseded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guardrail_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  pattern_type TEXT NOT NULL,  -- 'tool_deny', 'param_validate', 'output_scan'
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Step 2: 实现 Memory Store**

Create `packages/core/src/memory/memory-store.ts`:

```typescript
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { MemoryEntry, MemoryWriter } from "../loop/loop-engine.js";

export class MemoryStore implements MemoryWriter {
  private db: Database.Database;
  private currentSessionId: string | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    this.db.exec(schema);
  }

  // ---- Session management ----

  startSession(loopId: string, sessionId: string): void {
    this.currentSessionId = sessionId;
    this.db
      .prepare("INSERT INTO sessions (id, loop_id, status) VALUES (?, ?, 'running')")
      .run(sessionId, loopId);
  }

  endSession(sessionId: string, status: string, summary: string | null, bestScore: number | null): void {
    this.db
      .prepare("UPDATE sessions SET ended_at = datetime('now'), status = ?, summary = ?, best_score = ? WHERE id = ?")
      .run(status, summary, bestScore, sessionId);
  }

  // ---- MemoryWriter interface ----

  async writeNudge(entry: MemoryEntry): Promise<void> {
    if (!this.currentSessionId) throw new Error("No active session");

    this.db
      .prepare(
        `INSERT INTO memory_entries (session_id, type, content, confidence, source)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        this.currentSessionId,
        entry.type,
        entry.content,
        entry.confidence,
        entry.source
      );
  }

  async summarizeSession(sessionId: string): Promise<string> {
    const entries = this.db
      .prepare("SELECT type, content, confidence FROM memory_entries WHERE session_id = ? ORDER BY id")
      .all(sessionId) as Array<{ type: string; content: string; confidence: number }>;

    const facts = entries.filter((e) => e.type === "fact").length;
    const errors = entries.filter((e) => e.type === "error").length;
    const patterns = entries.filter((e) => e.type === "pattern").length;

    return `Session ${sessionId}: ${facts} facts, ${errors} errors, ${patterns} patterns recorded.`;
  }

  // ---- Skill suggestion management ----

  recordSkillSuggestion(
    name: string,
    description: string,
    triggerCondition: string,
    content: string,
    confidence: number
  ): void {
    // Check if already exists — increment occurrence count
    const existing = this.db
      .prepare("SELECT id, occurrence_count FROM skill_suggestions WHERE name = ? AND status = 'pending'")
      .get(name) as { id: number; occurrence_count: number } | undefined;

    if (existing) {
      this.db
        .prepare("UPDATE skill_suggestions SET occurrence_count = ?, confidence = MAX(confidence, ?) WHERE id = ?")
        .run(existing.occurrence_count + 1, confidence, existing.id);
    } else {
      this.db
        .prepare(
          `INSERT INTO skill_suggestions (name, description, trigger_condition, content_markdown, confidence)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(name, description, triggerCondition, content, confidence);
    }
  }

  getSkillSuggestions(minOccurrence: number = 3): Array<{
    id: number;
    name: string;
    description: string;
    content: string;
    confidence: number;
    occurrenceCount: number;
  }> {
    return this.db
      .prepare(
        "SELECT id, name, description, content_markdown as content, confidence, occurrence_count as occurrenceCount FROM skill_suggestions WHERE occurrence_count >= ? AND status = 'pending' ORDER BY confidence DESC"
      )
      .all(minOccurrence) as any[];
  }

  // ---- Guardrail rule management ----

  addGuardrailRule(
    ruleName: string,
    description: string,
    patternType: string,
    config: Record<string, unknown>
  ): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO guardrail_rules (rule_name, description, pattern_type, config_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(ruleName, description, patternType, JSON.stringify(config));
  }

  getGuardrailRules(patternType?: string): Array<{
    ruleName: string;
    description: string;
    config: Record<string, unknown>;
    hitCount: number;
  }> {
    let query = "SELECT rule_name as ruleName, description, config_json as config, hit_count as hitCount FROM guardrail_rules WHERE enabled = 1";
    const params: string[] = [];
    if (patternType) {
      query += " AND pattern_type = ?";
      params.push(patternType);
    }
    return (this.db.prepare(query).all(...params) as any[]).map((r: any) => ({
      ...r,
      config: JSON.parse(r.config),
    }));
  }

  // ---- Cleanup ----

  close(): void {
    this.db.close();
  }
}
```

**Step 3: 写测试**

Create `packages/core/src/memory/__tests__/memory-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryStore } from "../memory-store.js";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/mobius-test-memory.db";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    try { unlinkSync(TEST_DB); } catch {}
    store = new MemoryStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    try { unlinkSync(TEST_DB); } catch {}
  });

  it("starts and ends a session", () => {
    store.startSession("test-loop", "session-001");
    store.endSession("session-001", "completed", "All good", 0.95);

    // Verify via summarize
    // (summary is text-based; we just verify no throw)
    expect(() => store.startSession("test-loop", "session-002")).not.toThrow();
  });

  it("writes and reads memory nudges", async () => {
    store.startSession("test-loop", "session-nudge");
    await store.writeNudge({
      type: "fact",
      content: "Test passes when using correct import path",
      confidence: 0.9,
      source: "loop:test-loop:iter-1",
      timestamp: new Date(),
    });
    await store.writeNudge({
      type: "error",
      content: "Import path './foo' does not exist, use './foo/index'",
      confidence: 0.95,
      source: "loop:test-loop:iter-2",
      timestamp: new Date(),
    });

    const summary = await store.summarizeSession("session-nudge");
    expect(summary).toContain("1 facts");
    expect(summary).toContain("1 errors");
  });

  it("tracks skill suggestions with occurrence threshold", () => {
    store.startSession("test-loop", "session-skills");

    // Same skill suggested 3 times
    for (let i = 0; i < 3; i++) {
      store.recordSkillSuggestion(
        "auto-lint-fix",
        "Automatically fix lint errors",
        "when eslint fails",
        "# Auto Lint Fix\n\nRun eslint --fix on failure.",
        0.7 + i * 0.1
      );
    }

    const suggestions = store.getSkillSuggestions(3);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].name).toBe("auto-lint-fix");
    expect(suggestions[0].occurrenceCount).toBe(3);
  });

  it("adds and retrieves guardrail rules", () => {
    store.startSession("test-loop", "session-guard");
    store.addGuardrailRule(
      "deny-rm-rf",
      "Block recursive delete commands",
      "tool_deny",
      { toolPattern: "rm -rf", blockMessage: "Recursive delete is blocked" }
    );

    const rules = store.getGuardrailRules("tool_deny");
    expect(rules).toHaveLength(1);
    expect(rules[0].ruleName).toBe("deny-rm-rf");
  });
});
```

**Step 4: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: All tests PASS (5 from loop-parser, 5 from loop-engine, 4 from memory-store = 14 total)

**Step 5: Commit**

```bash
git add packages/core/src/memory/
git commit -m "feat(core): implement SQLite Memory Store with auto-nudge support

MemoryStore implements the MemoryWriter interface for Phase 1:
- Session lifecycle (start/end with status tracking)
- Memory entries (facts, patterns, errors, skill suggestions)
- Skill suggestion dedup with occurrence threshold
- Guardrail rules storage
- WAL mode for concurrent access

4 unit tests covering: session management, nudge write/read, skill suggestion threshold, guardrail rules"
```

---

## Gateway (OpenClaw 骨架)

### Task 7: Gateway 事件总线 + Plugin 注册

**Files:**
- Create: `packages/gateway/src/event-bus.ts`
- Create: `packages/gateway/src/plugin-manager.ts`
- Create: `packages/gateway/src/gateway.ts`
- Create: `packages/gateway/src/__tests__/gateway.test.ts`

**Step 1: 事件总线**

Create `packages/gateway/src/event-bus.ts`:

```typescript
import { EventEmitter } from "events";

export interface MobiusEvent {
  type: string;
  source: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: MobiusEvent) => void | Promise<void>;

/**
 * Lightweight event bus inspired by OpenClaw's Gateway event system.
 * Supports wildcard listeners ("loop:*") and async handlers.
 */
export class EventBus {
  private emitter = new EventEmitter();
  private handlerCount = 0;

  /** Register a handler for a specific event type. Use "*" for all events. */
  on(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    this.emitter.on(eventType, async (event: MobiusEvent) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler ${id} error:`, err);
      }
    });
    return id;
  }

  /** Register a one-time handler */
  once(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    this.emitter.once(eventType, async (event: MobiusEvent) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler ${id} error:`, err);
      }
    });
    return id;
  }

  /** Emit an event to all matching handlers */
  async emit(event: MobiusEvent): Promise<void> {
    // Emit to specific type
    this.emitter.emit(event.type, event);
    // Emit to wildcard listeners
    this.emitter.emit("*", event);
    // Emit to prefix wildcards (e.g., "loop:started" → also emit to "loop:*")
    const colonIndex = event.type.indexOf(":");
    if (colonIndex > 0) {
      const prefix = event.type.slice(0, colonIndex) + ":*";
      this.emitter.emit(prefix, event);
    }
  }

  /** Remove a handler by ID */
  off(handlerId: string): void {
    // EventEmitter doesn't support removal by custom ID in this simple impl
    // For Phase 1, we keep it simple. Phase 3 adds proper listener tracking.
  }

  /** Get count of registered listeners */
  listenerCount(eventType: string): number {
    return this.emitter.listenerCount(eventType);
  }
}
```

**Step 2: Plugin 管理器**

Create `packages/gateway/src/plugin-manager.ts`:

```typescript
import { EventBus } from "./event-bus.js";

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  /** Called when plugin is registered */
  onRegister?(eventBus: EventBus): void | Promise<void>;
  /** Called when plugin is activated */
  onActivate?(): void | Promise<void>;
  /** Called when plugin is deactivated */
  onDeactivate?(): void | Promise<void>;
}

interface RegisteredPlugin {
  plugin: Plugin;
  active: boolean;
  registeredAt: Date;
}

/**
 * Plugin Manager inspired by OpenClaw's plugin microkernel.
 * Plugins register hooks on the EventBus and extend Gateway capabilities.
 */
export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Register a plugin. Does NOT activate it. */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    const registered: RegisteredPlugin = {
      plugin,
      active: false,
      registeredAt: new Date(),
    };

    if (plugin.onRegister) {
      await plugin.onRegister(this.eventBus);
    }

    this.plugins.set(plugin.name, registered);
    await this.eventBus.emit({
      type: "plugin:registered",
      source: "plugin-manager",
      timestamp: new Date(),
      payload: { pluginName: plugin.name, version: plugin.version },
    });
  }

  /** Activate a registered plugin */
  async activate(name: string): Promise<void> {
    const registered = this.plugins.get(name);
    if (!registered) throw new Error(`Plugin '${name}' is not registered`);
    if (registered.active) return;

    if (registered.plugin.onActivate) {
      await registered.plugin.onActivate();
    }
    registered.active = true;

    await this.eventBus.emit({
      type: "plugin:activated",
      source: "plugin-manager",
      timestamp: new Date(),
      payload: { pluginName: name },
    });
  }

  /** Get all registered plugin names */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** Get active plugins */
  activePlugins(): string[] {
    return Array.from(this.plugins.entries())
      .filter(([, v]) => v.active)
      .map(([k]) => k);
  }
}
```

**Step 3: Gateway 主类**

Create `packages/gateway/src/gateway.ts`:

```typescript
import { EventBus } from "./event-bus.js";
import { PluginManager } from "./plugin-manager.js";

export interface GatewayConfig {
  name: string;
  version: string;
}

/**
 * Gateway — the system heart, inspired by OpenClaw's Gateway.
 * Manages the EventBus, Plugin system, and serves as the entry point
 * for all external channels (CLI, HTTP, IM).
 */
export class Gateway {
  readonly eventBus: EventBus;
  readonly pluginManager: PluginManager;
  readonly config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.eventBus = new EventBus();
    this.pluginManager = new PluginManager(this.eventBus);
  }

  async start(): Promise<void> {
    console.log(`[Gateway] Starting ${this.config.name} v${this.config.version}`);
    await this.eventBus.emit({
      type: "gateway:starting",
      source: "gateway",
      timestamp: new Date(),
      payload: { name: this.config.name, version: this.config.version },
    });
  }

  async stop(): Promise<void> {
    console.log(`[Gateway] Stopping ${this.config.name}`);
    await this.eventBus.emit({
      type: "gateway:stopping",
      source: "gateway",
      timestamp: new Date(),
      payload: {},
    });
  }
}
```

**Step 4: 写测试**

Create `packages/gateway/src/__tests__/gateway.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Gateway } from "../gateway.js";
import { EventBus } from "../event-bus.js";
import { PluginManager, Plugin } from "../plugin-manager.js";

describe("EventBus", () => {
  it("delivers events to registered handlers", async () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("test:event", (e) => {
      received.push(e);
    });

    await bus.emit({
      type: "test:event",
      source: "test",
      timestamp: new Date(),
      payload: { value: 42 },
    });

    expect(received).toHaveLength(1);
    expect(received[0].payload.value).toBe(42);
  });

  it("delivers events to wildcard handlers", async () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("*", (e) => {
      received.push(e);
    });

    await bus.emit({
      type: "some:random:event",
      source: "test",
      timestamp: new Date(),
      payload: {},
    });

    expect(received).toHaveLength(1);
  });

  it("delivers to prefix wildcard listeners", async () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("loop:*", (e) => received.push(e));

    await bus.emit({
      type: "loop:started",
      source: "test",
      timestamp: new Date(),
      payload: {},
    });
    await bus.emit({
      type: "other:event",
      source: "test",
      timestamp: new Date(),
      payload: {},
    });

    // "loop:started" matches "loop:*", "other:event" does not
    expect(received).toHaveLength(1);
  });
});

describe("PluginManager", () => {
  it("registers and activates a plugin", async () => {
    const bus = new EventBus();
    const pm = new PluginManager(bus);

    let activated = false;
    const plugin: Plugin = {
      name: "test-plugin",
      version: "1.0.0",
      onActivate: () => { activated = true; },
    };

    await pm.register(plugin);
    expect(pm.list()).toContain("test-plugin");
    expect(pm.activePlugins()).not.toContain("test-plugin");

    await pm.activate("test-plugin");
    expect(activated).toBe(true);
    expect(pm.activePlugins()).toContain("test-plugin");
  });

  it("prevents duplicate registration", async () => {
    const bus = new EventBus();
    const pm = new PluginManager(bus);

    await pm.register({ name: "dup", version: "1.0.0" });
    await expect(
      pm.register({ name: "dup", version: "2.0.0" })
    ).rejects.toThrow("already registered");
  });
});

describe("Gateway", () => {
  it("starts and emits gateway:starting event", async () => {
    const gw = new Gateway({ name: "test-gw", version: "0.1.0" });
    const started: any[] = [];
    gw.eventBus.on("gateway:starting", (e) => started.push(e));

    await gw.start();
    expect(started).toHaveLength(1);
    expect(started[0].payload.name).toBe("test-gw");
  });
});
```

**Step 5: 运行测试**

```bash
cd packages/gateway
pnpm test -- --run
```

Expected: 5 tests PASS

**Step 6: Commit**

```bash
git add packages/gateway/
git commit -m "feat(gateway): implement OpenClaw-inspired Gateway with EventBus and PluginManager

Gateway serves as the system heart with:
- EventBus: typed events with wildcard & prefix matching
- PluginManager: register → activate lifecycle with event hooks
- Gateway: lifecycle management (start/stop)

5 unit tests covering event delivery, wildcards, plugin lifecycle, and gateway events"
```

---

## CLI 通道

### Task 8: CLI 入口 — 第一个可运行命令

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/run-loop.ts`

**Step 1: 创建 CLI 包**

Create `packages/cli/package.json`:

```json
{
  "name": "@mobius/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "mobius": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@mobius/core": "workspace:*",
    "@mobius/gateway": "workspace:*",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: CLI 入口**

Create `packages/cli/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { runLoopCommand } from "./commands/run-loop.js";

const program = new Command();

program
  .name("mobius")
  .description("Mobius Agent — Next-gen Loop Engineering AI Agent")
  .version("0.1.0");

program
  .command("run <loop-file>")
  .description("Run a Loop Definition from a YAML file")
  .option("-t, --task <task>", "Task description to pass to the loop")
  .option("-d, --dry-run", "Parse and validate the loop definition without executing")
  .action(async (loopFile, options) => {
    await runLoopCommand(loopFile, options);
  });

program
  .command("list-loops")
  .description("List available Loop Definitions")
  .action(() => {
    console.log("Available loops:");
    console.log("  hello-world-loop  — TDD loop for code tasks");
    console.log("  babysit-prs       — PR monitoring and auto-fix");
  });

program.parse();
```

**Step 3: run-loop 命令**

Create `packages/cli/src/commands/run-loop.ts`:

```typescript
import { loadLoopDefinition } from "@mobius/core/loop/loop-parser.js";
import { LoopEngine, LoopEngineConfig } from "@mobius/core/loop/loop-engine.js";
import { MemoryStore } from "@mobius/core/memory/memory-store.js";
import { Gateway } from "@mobius/gateway/gateway.js";
import { randomUUID } from "crypto";
import { resolve } from "path";

export async function runLoopCommand(
  loopFile: string,
  options: { task?: string; dryRun?: boolean }
): Promise<void> {
  const filePath = resolve(loopFile);
  console.log(`[Mobius] Loading loop from: ${filePath}`);

  const definition = loadLoopDefinition(filePath);
  console.log(`[Mobius] Loop: ${definition.name} (${definition.id})`);

  if (options.dryRun) {
    console.log("[Mobius] Dry run — loop definition is valid.");
    console.log(JSON.stringify(definition, null, 2));
    return;
  }

  const task = options.task || "Complete the task described in the loop definition";
  console.log(`[Mobius] Task: ${task}`);

  // Initialize Gateway
  const gateway = new Gateway({ name: "mobius-cli", version: "0.1.0" });
  await gateway.start();

  // Initialize Memory
  const memoryStore = new MemoryStore(
    resolve(process.cwd(), ".mobius", "memory.db")
  );
  const sessionId = randomUUID();
  memoryStore.startSession(definition.id, sessionId);

  // Wire up Loop Engine
  const config: LoopEngineConfig = {
    definition,
    toolExecutor: {
      execute: async (toolName, params) => {
        console.log(`[Mobius] Executing tool: ${toolName}`, params);
        // Phase 1: mock tool executor
        // Phase 2: real tool execution via Gateway plugins
        return {
          success: true,
          output: `[Phase 1 mock] Tool ${toolName} executed with params: ${JSON.stringify(params)}`,
          artifacts: [],
        };
      },
    },
    evalJudge: {
      evaluate: async (state, output) => {
        // Phase 1: mock evaluator
        // Phase 2: real LLM-as-Judge evaluation
        const score = Math.min(0.3 + state.iteration * 0.3, 0.95);
        console.log(`[Mobius] Eval iteration ${state.iteration}: score=${score}`);
        return {
          score,
          reasoning: `Phase 1 mock evaluation for iteration ${state.iteration}`,
          suggestions: score < 0.8 ? ["Improve code quality"] : [],
          isStagnant: false,
        };
      },
    },
    memoryWriter: memoryStore,
    onPhaseChange: (state) => {
      console.log(`[Mobius] Phase → ${state.phase}, iteration ${state.iteration}`);
    },
    onError: (error, state) => {
      console.error(`[Mobius] Error in phase ${state.phase}:`, error.message);
    },
  };

  const engine = new LoopEngine(config);
  const result = await engine.run(task);

  // End session
  memoryStore.endSession(
    sessionId,
    result.phase,
    `Loop completed with phase: ${result.phase}, best score: ${result.lastEvalScore}`,
    result.lastEvalScore
  );

  console.log("\n[Mobius] Loop complete!");
  console.log(`  Phase: ${result.phase}`);
  console.log(`  Iterations: ${result.iteration}`);
  console.log(`  Best score: ${result.lastEvalScore}`);
  console.log(`  Artifacts: ${result.artifacts.length}`);

  await gateway.stop();
  memoryStore.close();
}
```

**Step 4: Commit**

```bash
git add packages/cli/ packages/gateway/src/gateway.ts packages/core/src/index.ts
git commit -m "feat(cli): implement mobius CLI with run-loop command

CLI entry point with:
- 'mobius run <loop-file>' — execute a Loop Definition YAML
- 'mobius list-loops' — list available loops
- '--dry-run' flag for validation without execution
- Phase 1 mock tool executor and eval judge

Wired: Gateway → LoopEngine → MemoryStore, end-to-end"
```

---

## 验收测试

### Task 9: 端到端验收 — Hello World Loop 跑通

**Step 1: 运行 CLI**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm install
cd packages/cli
pnpm dev run ../../loops/hello-world.loop.yaml -t "Write a function that returns 'hello world'"
```

Expected output:
```
[Mobius] Loading loop from: .../loops/hello-world.loop.yaml
[Mobius] Loop: Hello World TDD Loop (hello-world-loop)
[Mobius] Task: Write a function that returns 'hello world'
[Mobius] Phase → preparing, iteration 0
[Mobius] Phase → executing, iteration 1
[Mobius] Executing tool: run_task ...
[Mobius] Phase → evaluating, iteration 1
[Mobius] Eval iteration 1: score=0.6
[Mobius] Phase → reflecting, iteration 1
[Mobius] Phase → deciding, iteration 1
[Mobius] Phase → executing, iteration 2
[Mobius] Eval iteration 2: score=0.9
[Mobius] Phase → reflecting, iteration 2
[Mobius] Phase → deciding, iteration 2

[Mobius] Loop complete!
  Phase: completed
  Iterations: 2
  Best score: 0.9
  Artifacts: 2
```

**Step 2: 验证 Memory 写入**

```bash
ls -la .mobius/memory.db
```

Expected: database file exists with entries.

**Step 3: 运行所有单元测试**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm test
```

Expected: All 18 tests PASS (5 loop-parser + 5 loop-engine + 4 memory-store + 4 gateway)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Phase 1 MVP — Möbius Loop end-to-end running

Phase 1 莫比乌斯之心 完成：
✅ Monorepo 项目结构 (pnpm workspace)
✅ gRPC Protobuf 协议定义 (guardrails + loop)
✅ Loop DSL 解析器 (YAML + Zod validation)
✅ Möbius Loop 引擎 (状态机 + Eval驱动终止 + Memory Nudge)
✅ SQLite Memory Store (L2 session + L3 permanent)
✅ Gateway 事件总线 + Plugin 管理器
✅ CLI 通道 (mobius run <loop>)
✅ 端到端验收通过

Total: 18 unit tests passing, 2 Loop DSL definitions (hello-world + babysit-prs)

Next: Phase 2 — 深度委派树引擎 + 自进化Memory"
```

---

## Phase 1 完成检查清单

- [x] Monorepo 搭建 (pnpm + TypeScript + Python)
- [x] gRPC 协议定义 (guardrails.proto + loop.proto)
- [x] Loop DSL 解析器 (Zod schema + YAML parser + 5 tests)
- [x] Möbius Loop 引擎 (状态机 + 5 tests)
- [x] Memory Store (SQLite + 4 tests)
- [x] Gateway (EventBus + PluginManager + 4 tests)
- [x] CLI 通道 (mobius run 命令)
- [x] 端到端验收 (hello-world-loop 跑通)

**Phase 2 预览（将在 Phase 1 完成后细化）：**
- 深度委派树 (Actor 模型递归)
- LLM-as-Judge 真实评估
- Memory Nudge 全部触发条件
- "洁癖"知识自动维护
- Skill 自动创建
- Hermes Guardrails Python 进程集成

---

> **For execution:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task. Each task has bite-sized steps with exact file paths and commands. Start with Task 1 and work through sequentially.
