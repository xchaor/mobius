import { LLMClient } from "./llm-client.js";
import { OpenAIClient } from "./openai-client.js";
import { AnthropicClient } from "./anthropic-client.js";

export interface DefaultLLMConfig {
  provider?: "deepseek" | "openai" | "anthropic";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

const DEEPSEEK_DEFAULTS = {
  baseUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
  apiKey: "sk-77f8936606174138a322458eec91d628",
};

/**
 * Get the default LLM client.
 *
 * Priority:
 * 1. Explicit config (provider/apiKey/baseUrl/model)
 * 2. Environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY)
 * 3. Built-in DeepSeek defaults
 */
export function getDefaultLLMClient(config?: DefaultLLMConfig): LLMClient {
  const provider = config?.provider || detectProvider(config?.apiKey);

  switch (provider) {
    case "anthropic": {
      const apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || "";
      return new AnthropicClient({ apiKey, defaultModel: config?.model || "claude-sonnet-4-6" });
    }
    case "openai": {
      const apiKey = config?.apiKey || process.env.OPENAI_API_KEY || "";
      return new OpenAIClient({
        apiKey,
        baseUrl: config?.baseUrl || process.env.OPENAI_BASE_URL,
        defaultModel: config?.model || "gpt-4o",
      });
    }
    case "deepseek":
    default: {
      return new OpenAIClient({
        apiKey: config?.apiKey || process.env.DEEPSEEK_API_KEY || DEEPSEEK_DEFAULTS.apiKey,
        baseUrl: config?.baseUrl || process.env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULTS.baseUrl,
        defaultModel: config?.model || DEEPSEEK_DEFAULTS.model,
      });
    }
  }
}

function detectProvider(apiKey?: string): "deepseek" | "openai" | "anthropic" {
  if (apiKey?.startsWith("sk-ant")) return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) return "openai";
  return "deepseek"; // default
}
