import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { LoopGenerator } from "@mobius/core/generator/loop-generator.js";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createLoopCommand(userInput: string, explicitName?: string, noRun?: boolean): Promise<void> {
  console.log(`[Mobius] 🤔 理解你的需求: "${userInput}"`);
  if (explicitName) console.log(`[Mobius] 使用指定名称: ${explicitName}`);

  const systemPrompt = readFileSync(resolve(__dirname, "../../../core/src/generator/prompts/generate-loop.system.md"), "utf-8");

  // Phase 2: Default LLM (DeepSeek built-in key, or env override)
  const { getDefaultLLMClient } = await import("@mobius/core/llm/default-client.js");
  const llmClient = getDefaultLLMClient();
  console.log(`[Mobius] 使用真实 LLM 生成 Loop 定义`);
  const generator = new LoopGenerator(llmClient, systemPrompt);
  const result = await generator.generate(userInput);
  const def = result.definition;
  const loopId = explicitName || def.id;
  def.id = loopId;

  const dbPath = resolve(process.cwd(), ".mobius", "mobius.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const registry = new LoopRegistry(db);
  registry.register(loopId, def.name, result.yaml, userInput);

  console.log(`\n✨ Loop 已创建:`);
  console.log(`  名称: ${loopId}  ← 之后 run/logs/status 都用这个`);
  console.log(`  描述: ${def.name}`);
  console.log(`  触发: ${def.trigger.type === "cron" ? `定时 ${(def.trigger as any).cronExpression}` : "手动"}`);
  console.log(`  条件: ${def.eval.conditions.length} 个验证条件`);
  console.log(`  技能: ${def.skills.join(", ") || "(无)"}`);
  if (result.warnings.length > 0) console.log(`  ⚠️  建议: ${result.warnings.join("; ")}`);

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

// LLM client provided by getDefaultLLMClient() — no template fallback needed.
