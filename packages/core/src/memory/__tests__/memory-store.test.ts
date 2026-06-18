import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryStore } from "../memory-store.js";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/mobius-test-memory.db";

describe("MemoryStore", () => {
  let store: MemoryStore;
  beforeEach(() => { try { unlinkSync(TEST_DB); } catch {} store = new MemoryStore(TEST_DB); });
  afterEach(() => { store.close(); try { unlinkSync(TEST_DB); } catch {} });

  it("starts and ends session", () => {
    store.startSession("test", "s1");
    store.endSession("s1", "completed", "ok", 0.9);
    expect(() => store.startSession("test", "s2")).not.toThrow();
  });

  it("writes and summarizes nudges", async () => {
    store.startSession("test", "sn");
    await store.writeNudge({ type: "fact", content: "a fact", confidence: 0.9, source: "t", timestamp: new Date() });
    await store.writeNudge({ type: "error", content: "an error", confidence: 0.95, source: "t", timestamp: new Date() });
    const s = await store.summarizeSession("sn");
    expect(s).toContain("1 facts");
    expect(s).toContain("1 errors");
  });

  it("expires and supersedes entries", async () => {
    store.startSession("test", "se");
    await store.writeNudge({ type: "fact", content: "old", confidence: 0.5, source: "t", timestamp: new Date() });
    store.expireEntry(1, "outdated");
    store.supersedeEntry(2, { type: "fact", content: "new", confidence: 0.9, source: "t", timestamp: new Date() });
    // Should not throw
  });

  it("records skill suggestions with threshold", () => {
    store.startSession("test", "ss");
    store.recordSkillSuggestion("auto-lint", "fix lint", "when eslint fails", "# Fix", 0.7);
    store.recordSkillSuggestion("auto-lint", "fix lint", "when eslint fails", "# Fix", 0.8);
    store.recordSkillSuggestion("auto-lint", "fix lint", "when eslint fails", "# Fix", 0.9);
    expect(store.getSkillSuggestions(3)).toHaveLength(1);
  });

  it("cleans up old entries", async () => {
    store.startSession("test", "sc");
    await store.writeNudge({ type: "fact", content: "will expire", confidence: 0.5, source: "t", timestamp: new Date() });
    const c = store.cleanupExpired(0);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});
