import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalExecutor } from "../local-executor.js";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("LocalExecutor", () => {
  let tmpDir: string;
  let executor: LocalExecutor;
  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), "mobius-test-")); executor = new LocalExecutor({ cwd: tmpDir }); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("writes and reads files", async () => {
    const w = await executor.execute("write_file", { path: "test.txt", content: "hello" });
    expect(w.success).toBe(true);
    const r = await executor.execute("read_file", { path: "test.txt" });
    expect(r.output).toBe("hello");
  });

  it("runs commands", async () => {
    const r = await executor.execute("run_command", { command: "echo mobius" });
    expect(r.success).toBe(true);
    expect(r.output.trim()).toBe("mobius");
  });

  it("blocks rm -rf / via guardrails", async () => {
    const r = await executor.execute("run_command", { command: "rm -rf /" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("GUARDRAIL");
  });

  it("lists directory", async () => {
    writeFileSync(join(tmpDir, "a.txt"), "a");
    const r = await executor.execute("list_dir", { path: "." });
    expect(r.output).toContain("FILE a.txt");
  });

  it("unknown tool returns error", async () => {
    const r = await executor.execute("unknown", {});
    expect(r.success).toBe(false);
  });
});
