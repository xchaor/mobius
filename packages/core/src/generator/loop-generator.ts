import { LoopDefinition, LoopDefinitionSchema } from "../loop/loop-definition.js";
import * as yaml from "js-yaml";

export interface LLMClient {
  complete(prompt: string, systemPrompt: string): Promise<string>;
}

export interface GeneratorResult {
  definition: LoopDefinition;
  yaml: string;
  warnings: string[];
}

export class LoopGenerator {
  private llm: LLMClient;
  private systemPrompt: string;

  constructor(llm: LLMClient, systemPrompt: string) {
    this.llm = llm;
    this.systemPrompt = systemPrompt;
  }

  async generate(userInput: string): Promise<GeneratorResult> {
    const warnings: string[] = [];
    const response = await this.llm.complete({
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userInput },
      ],
      maxTokens: 2000,
    });
    const yamlContent = this.extractYaml(response.content);

    let definition: LoopDefinition;
    try {
      const raw = yaml.load(yamlContent) as Record<string, unknown>;
      definition = LoopDefinitionSchema.parse(raw);
    } catch (err) {
      throw new Error(`LoopGenerator: LLM output is not a valid Loop Definition. ${(err as Error).message}\n\nRaw output:\n${yamlContent}`);
    }

    if (definition.eval.conditions.length === 0) {
      warnings.push("No eval conditions specified — loop may never complete. Consider adding at least one condition.");
    }
    if (definition.skills.length === 0) {
      warnings.push("No skills assigned — agent may lack domain knowledge.");
    }
    if (definition.delegation.maxDepth === 0 && definition.execution.maxIterations > 10) {
      warnings.push("Long-running loop with no delegation — consider enabling sub-agents.");
    }

    return { definition, yaml: yamlContent, warnings };
  }

  private extractYaml(raw: string): string {
    const fencedMatch = raw.match(/```ya?ml?\s*\n([\s\S]*?)\n```/);
    if (fencedMatch) return fencedMatch[1];
    const genericMatch = raw.match(/```\s*\n([\s\S]*?)\n```/);
    if (genericMatch) return genericMatch[1];
    return raw.trim();
  }
}
