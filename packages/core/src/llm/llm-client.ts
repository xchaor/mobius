export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMCompleteParams {
  messages: LLMMessage[];
  tools?: LLMTool[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls: LLMToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface LLMClient {
  complete(params: LLMCompleteParams): Promise<LLMResponse>;
}

export interface LLMClientConfig {
  provider: "anthropic" | "openai" | "mock";
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
}
