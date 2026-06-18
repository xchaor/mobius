import { randomUUID } from "crypto";
import { LLMClient, LLMMessage, LLMTool, LLMToolCall } from "../llm/llm-client.js";
import { ToolExecutor, ToolResult } from "../loop/loop-engine.js";

export interface AgentConfig {
  llm: LLMClient;
  tools: LLMTool[];
  toolExecutor: ToolExecutor;
  systemPrompt?: string;
  maxIterations?: number;
  model?: string;
  onStep?: (step: AgentStep) => void;
}

export interface AgentStep {
  iteration: number;
  type: "llm_call" | "tool_exec" | "done" | "error";
  messages: LLMMessage[];
  toolCalls?: LLMToolCall[];
  toolResults?: ToolResult[];
  content?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AgentResult {
  output: string;
  steps: AgentStep[];
  totalUsage: { inputTokens: number; outputTokens: number };
  artifacts: Array<{ type: string; path: string; description: string }>;
}

/**
 * Agent Core — LLM-driven tool execution loop.
 *
 * This is the "brain" of the Möbius Agent. It takes a task description,
 * calls an LLM with available tools, executes tool calls, feeds results back,
 * and continues until the LLM signals completion or budget is exhausted.
 *
 * Phase 1 had a hollow executePhase(). This fills it with a real LLM loop.
 */
export class AgentCore {
  private config: Required<AgentConfig>;

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 30,
      systemPrompt: "You are a software engineering agent. Use available tools to complete the task. Write code, run tests, and iterate until done.",
      model: "claude-sonnet-4-6",
      onStep: () => {},
      ...config,
    };
  }

  async run(task: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    const artifacts: AgentResult["artifacts"] = [];
    let totalUsage = { inputTokens: 0, outputTokens: 0 };

    // Build initial messages
    const messages: LLMMessage[] = [];
    if (this.config.systemPrompt) {
      messages.push({ role: "system", content: this.config.systemPrompt });
    }
    messages.push({ role: "user", content: task });

    for (let i = 0; i < this.config.maxIterations; i++) {
      // 1. Call LLM
      const response = await this.config.llm.complete({
        messages: [...messages],
        tools: this.config.tools,
        maxTokens: 4096,
        model: this.config.model,
      });

      steps.push({
        iteration: i + 1,
        type: response.toolCalls.length > 0 ? "llm_call" : "done",
        messages: [...messages],
        toolCalls: response.toolCalls,
        content: response.content,
        usage: response.usage,
      });
      this.config.onStep(steps[steps.length - 1]);

      if (response.usage) {
        totalUsage.inputTokens += response.usage.inputTokens;
        totalUsage.outputTokens += response.usage.outputTokens;
      }

      // 2. If no tool calls, LLM is done → return final content
      if (response.toolCalls.length === 0) {
        return { output: response.content, steps, totalUsage, artifacts };
      }

      // 3. Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.toolCalls,
      });

      // 4. Execute each tool call
      const toolResults: ToolResult[] = [];
      for (const tc of response.toolCalls) {
        let params: Record<string, unknown> = {};
        try { params = JSON.parse(tc.function.arguments); } catch { params = {}; }

        const result = await this.config.toolExecutor.execute(tc.function.name, params);
        toolResults.push(result);

        if (result.artifacts) artifacts.push(...result.artifacts);

        // Add tool result message
        messages.push({
          role: "tool",
          content: result.success ? result.output : `ERROR: ${result.error || "Unknown error"}`,
          tool_call_id: tc.id,
        });
      }

      steps.push({
        iteration: i + 1,
        type: "tool_exec",
        messages: [...messages],
        toolResults,
      });
      this.config.onStep(steps[steps.length - 1]);
    }

    // Max iterations reached
    return { output: "Max iterations reached without completion.", steps, totalUsage, artifacts };
  }
}
