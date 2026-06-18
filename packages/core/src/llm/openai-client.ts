import { LLMClient, LLMCompleteParams, LLMResponse, LLMMessage, LLMToolCall } from "./llm-client.js";

export interface OpenAIClientConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * OpenAI-compatible LLM Client.
 * Works with DeepSeek, OpenAI, and any OpenAI-compatible API.
 */
export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: OpenAIClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
    this.defaultModel = config.defaultModel || "gpt-4o";
  }

  async complete(params: LLMCompleteParams): Promise<LLMResponse> {
    const model = params.model || this.defaultModel;

    // Convert generic messages to OpenAI format
    const messages = params.messages.map(m => this.toOpenAIMessage(m));

    // Convert tools to OpenAI format
    const tools = params.tools?.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const url = this.baseUrl.endsWith("/chat/completions")
      ? this.baseUrl
      : `${this.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LLM API error ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const msg = choice?.message || {};

    const toolCalls: LLMToolCall[] = (msg.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function?.name || "",
        arguments: tc.function?.arguments || "{}",
      },
    }));

    return {
      content: msg.content || "",
      toolCalls,
      usage: data.usage ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } : undefined,
      model: data.model || model,
    };
  }

  private toOpenAIMessage(m: LLMMessage): Record<string, unknown> {
    switch (m.role) {
      case "system":
        return { role: "system", content: m.content };
      case "user":
        return { role: "user", content: m.content };
      case "assistant":
        if (m.tool_calls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.tool_calls.map(tc => ({
              id: tc.id,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
        }
        return { role: "assistant", content: m.content };
      case "tool":
        return { role: "tool", content: m.content, tool_call_id: m.tool_call_id };
      default:
        return { role: "user", content: m.content };
    }
  }
}
