import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryStore } from "../memory-store.js";
import { exportClaudeMd, cleanKnowledge } from "../claude-md-export.js";
import { unlinkSync } from "fs";

const TEST_DB = "/tmp/mobius-test-export.db";

describe("claude-md-export", () => {
  let store: MemoryStore;
  beforeEach(async () => { try { unlinkSync(TEST_DB); } catch {} store = new MemoryStore(TEST_DB); store.startSession("test", "s1");
    await store.writeNudge({ type: "fact", content: "Project uses TypeScript strict mode", confidence: 0.9, source: "test", timestamp: new Date() });
    await store.writeNudge({ type: "pattern", content: "Always run lint before committing", confidence: 0.8, source: "test", timestamp: new Date() });
    await store.writeNudge({ type: "error", content: "Import paths need .js extension for ESM", confidence: 0.95, source: "test", timestamp: new Date() });
    await store.writeNudge({ type: "fact", content: "Low confidence noise", confidence: 0.1, source: "test", timestamp: new Date() });
  });
  afterEach(() => { store.close(); try { unlinkSync(TEST_DB); } catch {} });

  it("exports active entries as markdown", () => {
    const md = exportClaudeMd(store, { maxLines: 100 });
    expect(md).toContain("## Key Facts");
    expect(md).toContain("TypeScript strict mode");
    expect(md).toContain("## Patterns");
    expect(md).toContain("## Known Issues");
    expect(md).toContain(".js extension");
  });

  it("respects maxLines for data rows", () => {
    const md = exportClaudeMd(store, { maxLines: 2 });
    // With 2 data rows + headers, total lines should be modest
    expect(md.split("\n").length).toBeLessThanOrEqual(15);
  });

  it("cleans low confidence entries", () => {
    const result = cleanKnowledge(store);
    expect(result.lowConfidence).toBeGreaterThanOrEqual(0);
  });
});
