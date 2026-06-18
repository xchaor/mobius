export interface GuardrailRule {
  id: string;
  type: "tool_deny" | "param_validate" | "output_scan";
  pattern: RegExp | string;
  action: "block" | "warn" | "require_approval";
  description: string;
}

export interface GuardrailCheckResult { allowed: boolean; violations: string[]; }

export class SimpleGuardrails {
  private rules: GuardrailRule[] = [];

  constructor() {
    this.addRule({ id: "block-rm-rf-root", type: "tool_deny", pattern: /\brm\s+-rf\s+\//i, action: "block", description: "Block recursive delete of root filesystem" });
    this.addRule({ id: "block-curl-pipe-sh", type: "tool_deny", pattern: /curl[^|]*\|\s*(ba)?sh/i, action: "block", description: "Block curl | sh execution" });
    this.addRule({ id: "block-chmod-777", type: "tool_deny", pattern: /chmod\s+(-R\s+)?777/i, action: "warn", description: "Warn on chmod 777" });
  }

  addRule(rule: GuardrailRule): void { this.rules.push(rule); }

  check(toolName: string, params: Record<string, unknown>): GuardrailCheckResult {
    const violations: string[] = [];
    const text = `${toolName} ${JSON.stringify(params)}`;

    for (const rule of this.rules) {
      const pattern = typeof rule.pattern === "string" ? new RegExp(rule.pattern, "i") : rule.pattern;
      if (pattern.test(text)) {
        if (rule.action === "block") return { allowed: false, violations: [rule.description] };
        violations.push(rule.description);
      }
    }
    return { allowed: true, violations };
  }
}
