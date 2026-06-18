import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function listLoopsCommand(): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loops = registry.list();
  if (loops.length === 0) {
    console.log("还没有 Loop。试试: mobius create -n <name> \"你的需求\"");
  } else {
    console.log(`已注册 ${loops.length} 个 Loop:\n`);
    for (const l of loops) {
      const lastRun = l.lastRunAt ? `上次: ${l.lastRunAt.toISOString().slice(0, 16)}` : "从未运行";
      console.log(`  ${l.name.padEnd(25)} ${String(`(${l.runCount}次)`).padEnd(10)} ${lastRun}`);
    }
  }
  db.close();
}
