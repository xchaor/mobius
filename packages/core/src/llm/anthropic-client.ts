import { LLMClient, LLMCompleteParams, LLMResponse, LLMToolCall } from "./llm-client.js";

export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Anthropic (Claude) LLM Client.
 * Requires ANTHROPIC_API_KEY env var or explicit apiKey in config.
 */
export class AnthropicClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.anthropic.com";
    this.defaultModel = config.defaultModel || "claude-sonnet-4-6";
  }

  async complete(params: LLMCompleteParams): Promise<LLMResponse> {
    const model = params.model || this.defaultModel;

    // Convert our generic format to Anthropic Messages API format
    const systemMessages = params.messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    const messages = params.messages
      .filter(m => m.role !== "system")
      .map(m => {
        if (m.role === "tool") {
          return {
            role: "user" as const,
            content: [{ type: "tool_result" as const, tool_use_id: m.tool_call_id || "", content: m.content }],
          };
        }
        if (m.role === "assistant" && m.tool_calls?.length) {
          return {
            role: "assistant" as const,
            content: m.tool_calls.map(tc => ({
              type: "tool_use" as const,
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            })),
          };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      });

    const tools = params.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: params.maxTokens || 4096,
      messages,
    };
    if (systemMessages) body.system = systemMessages;
    if (tools?.length) body.tools = tools;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    const content = data.content || [];
    const textParts = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const toolUseParts = content.filter((c: any) => c.type === "tool_use");

    const toolCalls: LLMToolCall[] = toolUseParts.map((tu: any) => ({
      id: tu.id,
      type: "function" as const,
      function: { name: tu.name, arguments: JSON.stringify(tu.input) },
    }));

    return {
      content: textParts,
      toolCalls,
      usage: data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : undefined,
      model: data.model || model,
    };
  }
}
