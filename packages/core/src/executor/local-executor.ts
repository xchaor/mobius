import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, appendFile, mkdir, readdir } from "fs/promises";
import { dirname } from "path";
import { ToolExecutor, ToolResult } from "../loop/loop-engine.js";
import { SimpleGuardrails } from "../guardrails/simple-guardrails.js";

const execAsync = promisify(exec);

export interface LocalExecutorConfig { cwd: string; allowedCommands?: string[]; maxOutputLength?: number; }

export class LocalExecutor implements ToolExecutor {
  private config: { cwd: string; allowedCommands: string[]; maxOutputLength: number };
  private guardrails: SimpleGuardrails;

  constructor(config: LocalExecutorConfig, guardrails?: SimpleGuardrails) {
    this.config = { cwd: config.cwd, allowedCommands: config.allowedCommands || [], maxOutputLength: config.maxOutputLength || 50000 };
    this.guardrails = guardrails || new SimpleGuardrails();
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    const check = this.guardrails.check(toolName, params);
    if (!check.allowed) return { success: false, output: "", error: `GUARDRAIL BLOCKED: ${check.violations.join("; ")}` };

    try {
      switch (toolName) {
        case "write_file": return await this.writeFile(params.path as string, params.content as string);
        case "read_file": return await this.readFile(params.path as string);
        case "append_file": return await this.appendFile(params.path as string, params.content as string);
        case "run_command": return await this.runCommand(params.command as string, (params.cwd as string) || this.config.cwd);
        case "list_dir": return await this.listDir(params.path as string);
        default: return { success: false, output: "", error: `Unknown tool: ${toolName}. Available: write_file, read_file, append_file, run_command, list_dir` };
      }
    } catch (err) {
      return { success: false, output: "", error: (err as Error).message };
    }
  }

  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
    return { success: true, output: `Wrote ${filePath} (${content.length} bytes)`, artifacts: [{ type: "file", path: filePath, description: `Created ${filePath}` }] };
  }

  private async appendFile(filePath: string, content: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await appendFile(fullPath, content, "utf-8");
    return { success: true, output: `Appended to ${filePath} (${content.length} bytes)` };
  }

  private async readFile(filePath: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    const content = await readFile(fullPath, "utf-8");
    return { success: true, output: content };
  }

  private async runCommand(command: string, cwd: string): Promise<ToolResult> {
    const normalized = command.trim().toLowerCase();
    if (normalized.includes("rm -rf /") || normalized.includes("rm -rf /*")) {
      return { success: false, output: "", error: "FORBIDDEN: recursive delete of root blocked" };
    }
    const { stdout, stderr, exitCode } = await this.execWithTimeout(command, cwd);
    const output = this.truncate(stderr ? `${stdout}\n---STDERR---\n${stderr}` : stdout);
    return { success: exitCode === 0, output, error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined };
  }

  private async listDir(dirPath: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(dirPath);
    const entries = await readdir(fullPath, { withFileTypes: true });
    const lines = entries.map(e => `${e.isDirectory() ? "DIR " : "FILE"} ${e.name}`);
    return { success: true, output: lines.join("\n") };
  }

  private resolvePath(filePath: string): string {
    return filePath.startsWith("/") ? filePath : `${this.config.cwd}/${filePath}`;
  }

  private async execWithTimeout(command: string, cwd: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeoutMs });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.code || 1 };
    }
  }

  private truncate(str: string): string {
    if (str.length <= this.config.maxOutputLength) return str;
    return str.slice(0, this.config.maxOutputLength) + `\n... [truncated ${str.length - this.config.maxOutputLength} chars]`;
  }
}
