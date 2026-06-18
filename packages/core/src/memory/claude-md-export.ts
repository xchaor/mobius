import { MemoryStore } from "./memory-store.js";

export interface ClaudeMdConfig {
  maxLines: number;
  title: string;
  sections: Array<{ heading: string; types: string[] }>;
}

const DEFAULT_CONFIG: ClaudeMdConfig = {
  maxLines: 200,
  title: "# Mobius Agent Knowledge Base",
  sections: [
    { heading: "## Key Facts", types: ["fact"] },
    { heading: "## Patterns", types: ["pattern"] },
    { heading: "## Known Issues", types: ["error"] },
  ],
};

/**
 * Exports active memory entries as CLAUDE.md-formatted knowledge base.
 */
export function exportClaudeMd(store: MemoryStore, config: Partial<ClaudeMdConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const lines: string[] = [cfg.title, ""];

  // Get entries from store
  const allEntries = store.getActiveEntries(cfg.maxLines);

  for (const section of cfg.sections) {
    const entries = allEntries.filter(e => section.types.includes(e.type));
    if (entries.length === 0) continue;
    lines.push(section.heading);
    lines.push("");
    for (const e of entries) {
      lines.push(`- ${e.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * "洁癖" — prune stale, superseded, and low-confidence entries.
 * Returns count of cleaned entries.
 */
export function cleanKnowledge(store: MemoryStore): { expired: number; lowConfidence: number } {
  const expired = store.cleanupExpired(30); // 30 days
  const lowConf = store.removeLowConfidence(0.3); // confidence < 0.3
  return { expired, lowConfidence: lowConf };
}
