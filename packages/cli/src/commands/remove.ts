import { resolve } from "path";
import Database from "better-sqlite3";
import { LoopRegistry } from "@mobius/core/registry/loop-registry.js";

export async function removeCommand(name: string): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "mobius.db"));
  const registry = new LoopRegistry(db);
  const loop = registry.get(name);
  if (!loop) { console.log(`Loop '${name}' 不存在`); db.close(); return; }
  registry.remove(name);
  console.log(`已删除: ${name}`);
  db.close();
}
