import { exec } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { EvalCondition, BoundaryCondition } from "../loop/loop-definition.js";

const execAsync = promisify(exec);

export interface ConditionResult { description: string; passed: boolean; suggestion?: string; }
export interface BoundaryResult { description: string; violated: boolean; reason?: string; }

export class CommandBasedJudge {
  private cwd: string;
  constructor(cwd: string = process.cwd()) { this.cwd = cwd; }

  async checkConditions(conditions: EvalCondition[]): Promise<{ results: ConditionResult[]; allPassed: boolean }> {
    const results: ConditionResult[] = [];
    for (const condition of conditions) {
      const result = await this.checkCondition(condition);
      results.push(result);
    }
    return { results, allPassed: results.every(r => r.passed) };
  }

  async checkBoundaries(boundaries: BoundaryCondition[]): Promise<{ violations: string[] }> {
    const violations: string[] = [];
    for (const boundary of boundaries) {
      const result = await this.checkBoundary(boundary);
      if (result.violated) violations.push(result.reason || result.description);
    }
    return { violations };
  }

  private async checkCondition(condition: EvalCondition): Promise<ConditionResult> {
    try {
      switch (condition.type) {
        case "command_exit_code": {
          const { exitCode } = await this.exec(condition.command);
          const passed = exitCode === condition.expected;
          return { description: condition.description, passed, suggestion: passed ? undefined : `Command exited ${exitCode}, expected ${condition.expected}` };
        }
        case "command_output_contains": {
          const { stdout, exitCode } = await this.exec(condition.command);
          const passed = exitCode === 0 && stdout.includes(condition.expected);
          return { description: condition.description, passed, suggestion: passed ? undefined : `Output missing "${condition.expected}"` };
        }
        case "file_exists": {
          const passed = await this.fileExists(condition.path);
          return { description: condition.description, passed, suggestion: passed ? undefined : `File ${condition.path} does not exist` };
        }
        case "file_not_empty": {
          const exists = await this.fileExists(condition.path);
          return { description: condition.description, passed: exists, suggestion: exists ? undefined : `File ${condition.path} is missing or empty` };
        }
        case "custom": {
          const { exitCode } = await this.exec(condition.script);
          return { description: condition.description, passed: exitCode === 0, suggestion: exitCode === 0 ? undefined : `Custom check failed (exit ${exitCode})` };
        }
        default:
          return { description: condition.description, passed: false, suggestion: "Unknown condition type" };
      }
    } catch (err) {
      return { description: condition.description, passed: false, suggestion: `Check error: ${(err as Error).message}` };
    }
  }

  private async checkBoundary(boundary: BoundaryCondition): Promise<BoundaryResult> {
    try {
      switch (boundary.type) {
        case "file_count_min": {
          const { stdout } = await this.exec(`find ${boundary.path} -type f 2>/dev/null | wc -l`);
          const count = parseInt(stdout.trim(), 10);
          return { description: boundary.description, violated: count < boundary.min, reason: count < boundary.min ? `Expected >=${boundary.min} files, found ${count}` : undefined };
        }
        case "no_file_deleted": {
          const { stdout } = await this.exec("git diff --name-status --diff-filter=D 2>/dev/null | wc -l");
          const deleted = parseInt(stdout.trim(), 10);
          return { description: boundary.description, violated: deleted > 0, reason: deleted > 0 ? `${deleted} file(s) deleted` : undefined };
        }
        case "command_forbidden":
          return { description: boundary.description, violated: false };
        default:
          return { description: boundary.description, violated: false };
      }
    } catch {
      return { description: boundary.description, violated: false, reason: "Boundary check failed to execute" };
    }
  }

  private async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd, timeout: 30000 });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.code || 1 };
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try { await access(path); return true; } catch { return false; }
  }
}
