import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MemoryEntry, MemoryWriter } from "../loop/loop-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  startSession(loopId: string, sessionId: string): void {
    this.currentSessionId = sessionId;
    this.db.prepare("INSERT INTO sessions (id, loop_id, status) VALUES (?, ?, 'running')").run(sessionId, loopId);
  }

  endSession(sessionId: string, status: string, summary: string | null, bestScore: number | null): void {
    this.db.prepare("UPDATE sessions SET ended_at = datetime('now'), status = ?, summary = ?, best_score = ? WHERE id = ?").run(status, summary, bestScore, sessionId);
  }

  async writeNudge(entry: MemoryEntry): Promise<void> {
    if (!this.currentSessionId) throw new Error("No active session");
    this.db.prepare("INSERT INTO memory_entries (session_id, type, content, confidence, source) VALUES (?, ?, ?, ?, ?)").run(this.currentSessionId, entry.type, entry.content, entry.confidence, entry.source);
  }

  async summarizeSession(sessionId: string): Promise<string> {
    const entries = this.db.prepare("SELECT type, content, confidence FROM memory_entries WHERE session_id = ? AND status = 'active' ORDER BY id").all(sessionId) as Array<{ type: string; content: string; confidence: number }>;
    const facts = entries.filter(e => e.type === "fact").length;
    const errors = entries.filter(e => e.type === "error").length;
    const patterns = entries.filter(e => e.type === "pattern").length;
    return `Session ${sessionId}: ${facts} facts, ${errors} errors, ${patterns} patterns recorded.`;
  }

  expireEntry(entryId: number, reason: string): void {
    this.db.prepare("UPDATE memory_entries SET status = 'expired', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.expireReason', ?) WHERE id = ?").run(reason, entryId);
  }

  supersedeEntry(oldId: number, newEntry: MemoryEntry): number {
    if (!this.currentSessionId) throw new Error("No active session");
    const result = this.db.prepare("INSERT INTO memory_entries (session_id, type, content, confidence, source, status) VALUES (?, ?, ?, ?, ?, 'active')").run(this.currentSessionId, newEntry.type, newEntry.content, newEntry.confidence, newEntry.source);
    const newId = Number(result.lastInsertRowid);
    this.db.prepare("UPDATE memory_entries SET status = 'superseded', superseded_by = ? WHERE id = ?").run(newId, oldId);
    return newId;
  }

  cleanupExpired(maxAgeDays: number = 30): number {
    const result = this.db.prepare("UPDATE memory_entries SET status = 'expired' WHERE status = 'active' AND created_at < datetime('now', ?)").run(`-${maxAgeDays} days`);
    return result.changes;
  }

  recordSkillSuggestion(name: string, description: string, triggerCondition: string, content: string, confidence: number): void {
    const existing = this.db.prepare("SELECT id, occurrence_count FROM skill_suggestions WHERE name = ? AND status = 'pending'").get(name) as { id: number; occurrence_count: number } | undefined;
    if (existing) {
      this.db.prepare("UPDATE skill_suggestions SET occurrence_count = ?, confidence = MAX(confidence, ?) WHERE id = ?").run(existing.occurrence_count + 1, confidence, existing.id);
    } else {
      this.db.prepare("INSERT INTO skill_suggestions (name, description, trigger_condition, content_markdown, confidence) VALUES (?, ?, ?, ?, ?)").run(name, description, triggerCondition, content, confidence);
    }
  }

  getSkillSuggestions(minOccurrence: number = 3): Array<{ id: number; name: string; description: string; content: string; confidence: number; occurrenceCount: number }> {
    return this.db.prepare("SELECT id, name, description, content_markdown as content, confidence, occurrence_count as occurrenceCount FROM skill_suggestions WHERE occurrence_count >= ? AND status = 'pending' ORDER BY confidence DESC").all(minOccurrence) as any[];
  }

  addGuardrailRule(ruleName: string, description: string, patternType: string, config: Record<string, unknown>): void {
    this.db.prepare("INSERT OR REPLACE INTO guardrail_rules (rule_name, description, pattern_type, config_json) VALUES (?, ?, ?, ?)").run(ruleName, description, patternType, JSON.stringify(config));
  }

  close(): void { this.db.close(); }
}
