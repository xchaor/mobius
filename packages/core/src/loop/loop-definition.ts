import { z } from "zod";

// ---- Trigger ----
export const CronTriggerSchema = z.object({
  type: z.literal("cron"),
  cronExpression: z.string(),
});
export const EventTriggerSchema = z.object({
  type: z.literal("event"),
  eventType: z.string(),
  filter: z.string().optional(),
});
export const ManualTriggerSchema = z.object({
  type: z.literal("manual"),
  commandName: z.string(),
});
export const TriggerSchema = z.discriminatedUnion("type", [
  CronTriggerSchema, EventTriggerSchema, ManualTriggerSchema,
]);

// ---- Eval Conditions ----
export const EvalConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("command_exit_code"), command: z.string(), expected: z.number().int().default(0), description: z.string() }),
  z.object({ type: z.literal("command_output_contains"), command: z.string(), expected: z.string(), description: z.string() }),
  z.object({ type: z.literal("file_exists"), path: z.string(), description: z.string() }),
  z.object({ type: z.literal("file_not_empty"), path: z.string(), description: z.string() }),
  z.object({ type: z.literal("custom"), script: z.string(), description: z.string() }),
]);
export type EvalCondition = z.infer<typeof EvalConditionSchema>;

// ---- Boundary Conditions ----
export const BoundaryConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("file_count_min"), path: z.string(), min: z.number().int(), description: z.string() }),
  z.object({ type: z.literal("no_file_deleted"), path: z.string(), description: z.string() }),
  z.object({ type: z.literal("command_forbidden"), forbiddenPattern: z.string(), description: z.string() }),
]);
export type BoundaryCondition = z.infer<typeof BoundaryConditionSchema>;

// ---- Config schemas ----
export const ExecutionConfigSchema = z.object({
  maxIterations: z.number().int().positive().default(100),
  maxTokensPerIter: z.number().int().positive().default(50000),
  timeoutSeconds: z.number().int().positive().default(3600),
  useWorktree: z.boolean().default(true),
  worktreeMode: z.enum(["fresh", "head"]).default("fresh"),
});

export const EvalConfigSchema = z.object({
  judgeModel: z.string().default("claude-sonnet-4-6"),
  threshold: z.number().min(0).max(1).default(0.7),
  maxRetries: z.number().int().positive().default(3),
  stagnantRounds: z.number().int().positive().default(3),
  conditions: z.array(EvalConditionSchema).default([]),
  boundaryConditions: z.array(BoundaryConditionSchema).default([]),
});

export const DelegationConfigSchema = z.object({
  maxDepth: z.number().int().min(0).max(10).default(0),
  maxSubagents: z.number().int().positive().default(10),
  budgetPerNode: z.number().int().positive().default(100000),
});

export const MemoryConfigSchema = z.object({
  autoNudge: z.boolean().default(true),
  autoSkillCreation: z.boolean().default(false),
  claudeMdMaxLines: z.number().int().positive().default(200),
});

export const FailureConfigSchema = z.object({
  strategy: z.enum(["retry", "escalate_to_human", "graceful_degrade", "abort"]).default("retry"),
  maxRetries: z.number().int().positive().default(3),
  escalationChannel: z.string().optional(),
});

export const LoopDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  trigger: TriggerSchema,
  execution: ExecutionConfigSchema.default({}),
  eval: EvalConfigSchema.default({}),
  skills: z.array(z.string()).default([]),
  mcpConnectors: z.array(z.string()).default([]),
  delegation: DelegationConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  onFailure: FailureConfigSchema.default({}),
});

export type LoopDefinition = z.infer<typeof LoopDefinitionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type EvalConfig = z.infer<typeof EvalConfigSchema>;
export type FailureConfig = z.infer<typeof FailureConfigSchema>;
