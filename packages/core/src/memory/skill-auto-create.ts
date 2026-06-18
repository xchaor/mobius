import { MemoryStore } from "./memory-store.js";

export interface SkillTemplate {
  name: string;
  description: string;
  triggerCondition: string;
  contentMarkdown: string;
}

/**
 * Analyzes memory patterns and suggests new Skills.
 * When the same pattern appears ≥3 times, it's promoted to a skill suggestion.
 * Phase 2: Phase 3 adds LLM-based content generation.
 */
export class SkillAutoCreator {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /** Scan recent errors and patterns, suggest skills */
  analyze(): SkillTemplate[] {
    const templates: SkillTemplate[] = [];

    // Pattern: repeated error messages suggest guardrail/validation skill
    const errorPatterns = this.detectErrorPatterns();
    for (const p of errorPatterns) {
      this.store.recordSkillSuggestion(
        p.name, p.description, p.triggerCondition, p.contentMarkdown, 0.6
      );
      templates.push(p);
    }

    // Check if any suggestions reached promotion threshold
    const suggestions = this.store.getSkillSuggestions(3);
    for (const s of suggestions) {
      templates.push({
        name: s.name,
        description: s.description,
        triggerCondition: "",
        contentMarkdown: s.content,
      });
    }

    return templates;
  }

  private detectErrorPatterns(): SkillTemplate[] {
    // Phase 2: simple prefix matching. Phase 3: LLM-based pattern detection.
    return [];
  }

  /**
   * Promote a skill suggestion to an actual skill file.
   * Phase 3: writes to .claude/skills/ directory.
   */
  promoteToSkill(name: string): string | null {
    const suggestions = this.store.getSkillSuggestions(1);
    const match = suggestions.find(s => s.name === name);
    if (!match) return null;

    const skillMd = `---
name: ${match.name}
description: ${match.description}
---

${match.content}
`;
    return skillMd;
  }
}
