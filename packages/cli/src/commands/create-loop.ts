import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { LoopGenerator, LLMClient } from "@mobius/core/generator/loop-generator.js";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createLoopCommand(userInput: string, explicitName?: string, noRun?: boolean): Promise<void> {
  console.log(`[Mobius] 🤔 理解你的需求: "${userInput}"`);
  if (explicitName) console.log(`[Mobius] 使用指定名称: ${explicitName}`);

  const systemPrompt = readFileSync(resolve(__dirname, "../../../core/src/generator/prompts/generate-loop.system.md"), "utf-8");

  const mockLLM: LLMClient = {
    complete: async (p: string, _s: string) => generateFromTemplate(p, explicitName),
  };
  const generator = new LoopGenerator(mockLLM, systemPrompt);
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

function generateFromTemplate(userInput: string, explicitName?: string): string {
  const id = explicitName || userInput.slice(0, 30).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "auto-loop";
  const isRecurring = /每|每天|每周|定时|早上|晚上|下午|自动/.test(userInput);
  const triggerType = isRecurring ? "cron" : "manual";
  const cronExpr = /早上|上午/.test(userInput) ? "0 9 * * *" : /下午/.test(userInput) ? "0 14 * * *" : /每.*小时/.test(userInput) ? "0 */2 * * *" : /每天/.test(userInput) ? "0 9 * * *" : "0 */2 * * *";

  return `id: ${id}\nname: ${userInput.slice(0, 30)}\ndescription: ${userInput}\ntrigger:\n  type: ${triggerType}\n  ${triggerType === "cron" ? `cronExpression: "${cronExpr}"` : `commandName: ${id}`}\nexecution:\n  maxIterations: 10\n  useWorktree: true\neval:\n  threshold: 0.7\n  conditions:\n    - type: command_exit_code\n      command: echo test\n      expected: 0\n      description: Smoke test passes\n  boundaryConditions:\n    - type: no_file_deleted\n      path: "."\n      description: No files deleted\nskills:\n  - test-driven-development\n  - systematic-debugging\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 3\n`;
}
