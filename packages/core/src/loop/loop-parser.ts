import * as yaml from "js-yaml";
import { readFileSync } from "fs";
import { LoopDefinitionSchema, LoopDefinition } from "./loop-definition.js";

export function parseLoopDefinition(yamlContent: string): LoopDefinition {
  const raw = yaml.load(yamlContent);
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid YAML: expected a mapping at the top level");
  }
  return LoopDefinitionSchema.parse(raw);
}

export function loadLoopDefinition(filePath: string): LoopDefinition {
  const content = readFileSync(filePath, "utf-8");
  return parseLoopDefinition(content);
}

export function serializeLoopDefinition(loop: LoopDefinition): string {
  return yaml.dump(LoopDefinitionSchema.parse(loop));
}
