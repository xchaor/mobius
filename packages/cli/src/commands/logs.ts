import { resolve } from "path";
import Database from "better-sqlite3";

export async function logsCommand(loopId: string, limit: number): Promise<void> {
  const db = new Database(resolve(process.cwd(), ".mobius", "memory.db"));
  const sessions = db.prepare("SELECT id, status, started_at, ended_at, total_iterations, best_score FROM sessions WHERE loop_id = ? ORDER BY started_at DESC LIMIT ?").all(loopId, limit) as any[];
  if (sessions.length === 0) {
    console.log(`'${loopId}' 还没有运行记录`);
  } else {
    console.log(`'${loopId}' 最近 ${sessions.length} 次运行:\n`);
    for (const s of sessions) {
      console.log(`  ${(s.started_at ?? "?").slice(0, 19)}  ${String(s.status).padEnd(12)}  iters:${s.total_iterations ?? "?"}  score:${s.best_score?.toFixed(2) ?? "N/A"}`);
    }
  }
  db.close();
}
