import { LLMClient, LLMCompleteParams, LLMResponse, LLMToolCall } from "./llm-client.js";

export class MockLLMClient implements LLMClient {
  private responses: string[] = [];
  private toolCallResponses: LLMToolCall[][] = [];
  private callCount = 0;

  /** Set predetermined text responses (no tool calls) */
  setResponses(responses: string[]): void { this.responses = responses; this.callCount = 0; }

  /** Set predetermined tool call sequences */
  setToolCallResponses(responses: LLMToolCall[][]): void { this.toolCallResponses = responses; this.callCount = 0; }

  async complete(params: LLMCompleteParams): Promise<LLMResponse> {
    // If tool call responses are set, use those
    if (this.toolCallResponses.length > 0) {
      const idx = Math.min(this.callCount, this.toolCallResponses.length - 1);
      const calls = this.toolCallResponses[idx];
      this.callCount++;
      return {
        content: calls.length === 0 ? "Task complete." : "",
        toolCalls: calls,
        model: "mock",
      };
    }

    // Otherwise return text responses
    const idx = Math.min(this.callCount, this.responses.length - 1);
    const content = this.responses[idx] || "Done.";
    this.callCount++;
    return { content, toolCalls: [], model: "mock" };
  }
}
