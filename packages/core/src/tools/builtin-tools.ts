import { LLMTool } from "../llm/llm-client.js";

export const BUILTIN_TOOLS: LLMTool[] = [
  {
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to worktree root, e.g. src/index.ts" },
        content: { type: "string", description: "File content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "read_file",
    description: "Read the content of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "append_file",
    description: "Append content to the end of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to append to" },
        content: { type: "string", description: "Content to append" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the worktree. Use for: npm test, npx vitest run, npx eslint, git status, etc.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
      },
      required: ["command"],
    },
  },
  {
    name: "list_dir",
    description: "List files and directories in a given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list. Use '.' for root." },
      },
      required: ["path"],
    },
  },
];
