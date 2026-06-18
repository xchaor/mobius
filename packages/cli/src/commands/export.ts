import { resolve, dirname } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { MemoryStore } from "@mobius/core/memory/memory-store.js";
import { exportClaudeMd, cleanKnowledge } from "@mobius/core/memory/claude-md-export.js";

export async function exportCommand(outputPath: string): Promise<void> {
  const dbPath = resolve(process.cwd(), ".mobius", "memory.db");
  const store = new MemoryStore(dbPath);

  // Clean first
  const { expired, lowConfidence } = cleanKnowledge(store);
  console.log(`[Mobius] 知识清理: ${expired} 过期, ${lowConfidence} 低置信度`);

  // Export
  const md = exportClaudeMd(store, { maxLines: 200 });
  const target = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, md, "utf-8");

  console.log(`[Mobius] 知识库已导出到: ${target}`);
  console.log(`[Mobius] 行数: ${md.split("\n").length}`);
  store.close();
}
