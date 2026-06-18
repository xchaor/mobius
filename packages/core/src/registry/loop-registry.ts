import Database from "better-sqlite3";
import { LoopDefinition } from "../loop/loop-definition.js";
import { parseLoopDefinition } from "../loop/loop-parser.js";

export interface RegisteredLoop {
  name: string;
  definition: LoopDefinition;
  yaml: string;
  userInput: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  runCount: number;
}

export class LoopRegistry {
  private db: Database.Database;

  constructor(db: Database.Database) { this.db = db; this.initialize(); }

  private initialize(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS loop_registry (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, yaml TEXT NOT NULL, user_input TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_run_at TEXT, run_count INTEGER DEFAULT 0)`);
  }

  register(id: string, name: string, yaml: string, userInput: string): void {
    const existing = this.db.prepare("SELECT id FROM loop_registry WHERE id = ?").get(id);
    if (existing) {
      this.db.prepare("UPDATE loop_registry SET name = ?, yaml = ?, user_input = ?, updated_at = datetime('now') WHERE id = ?").run(name, yaml, userInput, id);
    } else {
      this.db.prepare("INSERT INTO loop_registry (id, name, yaml, user_input) VALUES (?, ?, ?, ?)").run(id, name, yaml, userInput);
    }
  }

  get(id: string): RegisteredLoop | null {
    const row = this.db.prepare("SELECT id, name, yaml, user_input, created_at, updated_at, last_run_at, run_count FROM loop_registry WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.rowToLoop(row);
  }

  list(): RegisteredLoop[] {
    const rows = this.db.prepare("SELECT id, name, yaml, user_input, created_at, updated_at, last_run_at, run_count FROM loop_registry ORDER BY updated_at DESC").all() as any[];
    return rows.map((r: any) => this.rowToLoop(r));
  }

  recordRun(id: string): void {
    this.db.prepare("UPDATE loop_registry SET last_run_at = datetime('now'), run_count = run_count + 1 WHERE id = ?").run(id);
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM loop_registry WHERE id = ?").run(id);
    return result.changes > 0;
  }

  exportAll(): string {
    const loops = this.list();
    return JSON.stringify(loops.map(l => ({ id: l.name, yaml: l.yaml, userInput: l.userInput })), null, 2);
  }

  private rowToLoop(row: any): RegisteredLoop {
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
