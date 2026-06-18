import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function statusCommand(name: string): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loop = registry.get(name);
  if (!loop) { console.log(`Loop '${name}' 不存在`); db.close(); return; }
  console.log(`Loop: ${loop.name}`);
  console.log(`触发: ${loop.definition.trigger.type}`);
  console.log(`运行次数: ${loop.runCount}`);
  console.log(`上次运行: ${loop.lastRunAt?.toISOString().slice(0, 16) ?? "从未"}`);
  console.log(`创建时间: ${loop.createdAt.toISOString().slice(0, 16)}`);
  db.close();
}
