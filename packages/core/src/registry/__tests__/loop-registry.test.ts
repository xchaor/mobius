import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { LoopRegistry } from "../loop-registry.js";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/mobius-test-registry.db";
const YAML = "id: test\nname: Test\ntrigger:\n  type: manual\n  commandName: t\nexecution:\n  maxIterations: 5\n  useWorktree: true\neval:\n  threshold: 0.7\nskills: []\nmemory:\n  autoNudge: true\nonFailure:\n  strategy: retry\n  maxRetries: 3";

describe("LoopRegistry", () => {
  let db: Database.Database; let r: LoopRegistry;
  beforeEach(() => { try { unlinkSync(TEST_DB); } catch {} db = new Database(TEST_DB); r = new LoopRegistry(db); });
  afterEach(() => { db.close(); try { unlinkSync(TEST_DB); } catch {} });

  it("registers and gets", () => { r.register("test", "T", YAML, "do"); expect(r.get("test")!.userInput).toBe("do"); });
  it("lists all", () => { r.register("a", "A", YAML, "a"); r.register("b", "B", YAML.replace("test", "b"), "b"); expect(r.list()).toHaveLength(2); });
  it("updates on re-register", () => { r.register("t", "V1", YAML, "old"); r.register("t", "V2", YAML, "new"); expect(r.get("t")!.name).toBe("V2"); });
  it("records runs", () => { r.register("t", "T", YAML, "d"); r.recordRun("t"); r.recordRun("t"); expect(r.get("t")!.runCount).toBe(2); });
  it("removes", () => { r.register("t", "T", YAML, "d"); expect(r.remove("t")).toBe(true); expect(r.get("t")).toBeNull(); });
  it("exports JSON", () => { r.register("t", "T", YAML, "d"); const j = JSON.parse(r.exportAll()); expect(j[0].userInput).toBe("d"); });
});
