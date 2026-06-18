import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";
import { LoopEngine, LoopEngineConfig } from "@mobius/core/loop/loop-engine.js";
import { LoopPhase } from "@mobius/core/loop/loop-state.js";
import { MemoryStore } from "@mobius/core/memory/memory-store.js";
import { CompositeJudge, MockLLMJudge } from "@mobius/core/eval/composite-judge.js";
import { LocalExecutor } from "@mobius/core/executor/local-executor.js";
import { SimpleGuardrails } from "@mobius/core/guardrails/simple-guardrails.js";
import { Gateway } from "@mobius/gateway/gateway.js";
import { AgentCore } from "@mobius/core/agent/agent-core.js";
import { BUILTIN_TOOLS } from "@mobius/core/tools/builtin-tools.js";
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

  const worktreeRoot = resolve(process.cwd(), ".mobius", "worktrees", definition.id);
  mkdirSync(worktreeRoot, { recursive: true });

  const gateway = new Gateway({ name: "mobius-cli", version: "0.1.0" });
  await gateway.start();

  const memoryDbPath = resolve(process.cwd(), ".mobius", "memory.db");
  mkdirSync(dirname(memoryDbPath), { recursive: true });
  const memoryStore = new MemoryStore(memoryDbPath);
  const sessionId = randomUUID();
  memoryStore.startSession(definition.id, sessionId);

  const guardrails = new SimpleGuardrails();

  // Phase 2: Default LLM (DeepSeek built-in) driving AgentCore
  const { getDefaultLLMClient } = await import("@mobius/core/llm/default-client.js");
  const llmClient = getDefaultLLMClient();

  const agentCore = new AgentCore({
    llm: llmClient,
    tools: BUILTIN_TOOLS,
    toolExecutor: new LocalExecutor({ cwd: worktreeRoot }, guardrails),
    systemPrompt: [
      "You are a software engineering agent in the Möbius Agent platform.",
      "Your task is to write code, run tests, and iterate until all tests pass.",
      "Available tools: write_file, read_file, append_file, run_command, list_dir.",
      "Workflow:",
      "1. Use write_file to create source files and test files",
      "2. Use run_command to run tests (e.g., 'npx vitest run')",
      "3. If tests fail, read the error output, fix the code, and run tests again",
      "4. When all tests pass, respond with a summary of what you did",
      "Be thorough. Write real, working code.",
    ].join("\n"),
    model: "deepseek-chat",
    maxIterations: definition.execution.maxIterations,
    onStep: (step) => {
      if (step.type === "tool_exec" && step.toolResults) {
        for (const r of step.toolResults) {
          console.log(`  [tool] ${r.success ? "✓" : "✗"} ${!r.success && r.error ? r.error.slice(0, 60) : r.output.slice(0, 60)}`);
        }
      }
    },
  });

  const config: LoopEngineConfig = {
    definition,
    toolExecutor: new LocalExecutor({ cwd: worktreeRoot }, guardrails),
    evalJudge: new CompositeJudge(definition, worktreeRoot),
    memoryWriter: memoryStore,
    agentCore,
    onPhaseChange: (state) => console.log(`  [${new Date().toISOString().slice(11, 19)}] ${state.phase} (iter ${state.iteration})`),
    onError: (error, state) => console.error(`  ❌ ${state.phase}: ${error.message}`),
  };

  const engine = new LoopEngine(config);
  const result = await engine.run(registered.userInput);
  registry.recordRun(name);

  const statusMap: Record<string, string> = {
    [LoopPhase.COMPLETED]: "completed", [LoopPhase.FAILED]: "failed",
    [LoopPhase.STAGNANT]: "stagnant", [LoopPhase.INTERRUPTED]: "interrupted",
  };
  memoryStore.endSession(sessionId, statusMap[result.phase] ?? "unknown",
    `${definition.id}: ${result.phase}, score=${result.lastEvalScore?.toFixed(2)}, iters=${result.iteration}`, result.lastEvalScore);

  console.log(`\n${result.phase === LoopPhase.COMPLETED ? "✅" : result.phase === LoopPhase.STAGNANT ? "🟡" : "❌"} Loop ${result.phase}`);
  console.log(`  迭代: ${result.iteration}  分数: ${result.lastEvalScore?.toFixed(2) ?? "N/A"}  产物: ${result.artifacts.length} 文件`);

  await gateway.stop();
  memoryStore.close();
  db.close();
}
