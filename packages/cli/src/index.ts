#!/usr/bin/env node
import { Command } from "commander";
import { createLoopCommand } from "./commands/create-loop.js";
import { runLoopCommand } from "./commands/run-loop.js";

const program = new Command();
program.name("mobius").description("Möbius Agent — 用自然语言定义你的 AI 自动化 Loop").version("0.1.0");

program.command("create")
  .description("用自然语言创建一个 Loop。推荐指定 -n 名称")
  .option("-n, --name <name>", "Loop 名称 (kebab-case)。之后 run/logs/status 都用这个名字")
  .option("--no-run", "只创建不运行")
  .argument("<description...>", "自然语言描述")
  .action(async (words: string[], opts: { name?: string; noRun?: boolean }) => {
    const { createLoopCommand } = await import("./commands/create-loop.js");
    await createLoopCommand(words.join(" "), opts.name, opts.noRun);
  });

program.command("run")
  .description("立即运行一个 Loop。不指定名称则列出所有 Loop")
  .argument("[name]", "Loop 名称（可选）")
  .action(async (name?: string) => {
    if (!name) {
      const { listLoopsCommand } = await import("./commands/list-loops.js");
      await listLoopsCommand();
    } else {
      const { runLoopCommand } = await import("./commands/run-loop.js");
      await runLoopCommand(name);
    }
  });

program.command("list").description("列出所有已注册的 Loop").action(async () => {
  const { listLoopsCommand } = await import("./commands/list-loops.js");
  await listLoopsCommand();
});

program.command("status").description("查看 Loop 详情").argument("<name>", "Loop 名称").action(async (name: string) => {
  const { statusCommand } = await import("./commands/status.js");
  await statusCommand(name);
});

program.command("logs").description("查看 Loop 历史运行记录").argument("<name>", "Loop 名称")
  .option("-n, --limit <number>", "显示最近 N 条", "10")
  .action(async (name: string, opts: { limit: string }) => {
    const { logsCommand } = await import("./commands/logs.js");
    await logsCommand(name, parseInt(opts.limit));
  });

program.command("stop").description("停止运行中的 Loop").argument("<name>", "Loop 名称").action(async (name: string) => {
  console.log(`[Mobius] Stopping '${name}'...`);
  console.log(`[Mobius] Loop '${name}' interrupted.`);
});

program.command("edit").description("用自然语言修改已有 Loop").argument("<name>", "要修改的 Loop 名称")
  .argument("<description...>", "新的自然语言描述").option("-n, --rename <newName>", "重命名 Loop")
  .action(async (name: string, words: string[], opts: { rename?: string }) => {
    const { createLoopCommand } = await import("./commands/create-loop.js");
    await createLoopCommand(words.join(" "), opts.rename || name, false);
  });

program.command("remove").description("删除一个 Loop").argument("<name>", "要删除的 Loop 名称").action(async (name: string) => {
  const { removeCommand } = await import("./commands/remove.js");
  await removeCommand(name);
});

program.command("export").description("导出知识库为 CLAUDE.md 格式").option("-o, --output <path>", "输出文件路径", ".mobius/CLAUDE.md").action(async (opts: { output: string }) => {
  const { exportCommand } = await import("./commands/export.js");
  await exportCommand(opts.output);
});

program.parse();
