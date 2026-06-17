<p align="center">
  <img src="https://img.shields.io/badge/Mobius-Loop%20Engineering-%231a1a2e?style=for-the-badge" alt="Mobius Agent">
  <img src="https://img.shields.io/badge/Phase-1%20莫比乌斯之心-blue?style=for-the-badge" alt="Phase 1">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

<h1 align="center">Möbius Agent</h1>

<p align="center">
  <strong>踩在 OpenClaw 和 Hermes 的肩膀上，构建下一代 Loop Engineering AI Agent</strong><br>
  <em>Building the next-generation Loop Engineering AI Agent, standing on the shoulders of OpenClaw and Hermes</em>
</p>

<p align="center">
  <a href="#-简介">🇨🇳 中文</a> ·
  <a href="#-english">🇬🇧 English</a>
</p>

---

# 🇨🇳 中文

## 简介

**Möbius Agent** 是一个下一代 AI Agent 框架。它的核心命题是：**从 Prompt Engineering 到 Loop Engineering 的范式跃迁**。

2026 年 6 月，OpenClaw 创始人 Peter Steinberger 和 Claude Code 创始人 Boris Cherny 几乎同时宣告了同一个方向——"Prompt 该退环境了，未来属于 Loop Engineering"。Google 的 Addy Osmani 随后将 Loop Engineering 系统化为五个组件：Cron/Heartbeat、Worktree 隔离、Skill 知识体系、MCP 连接器、子 Agent 委派。

Möbius Agent 踩在这两个成熟项目的肩膀上：

| 借鉴来源 | 继承 | 超越 |
|---------|------|------|
| **OpenClaw** (TypeScript) | Gateway 微内核 + Plugin 系统 + 事件总线 + Worktree | 原生深度委派树 (N 层递归) |
| **Hermes Agent** (Python) | Tool Guardrails + Iteration Budget + Memory Nudge | 评估驱动自适应终止 + 自进化 Memory |

### 莫比乌斯环的隐喻

莫比乌斯环只有一个面——这意味着 **Loop 的每一轮都在同时"工作"和"学习"**，两者是同一过程的两个侧面。传统的 Agent 是"先干活，事后总结"；Möbius Agent 是"干活的每一秒都在积累经验"，下一轮自动受益。

### 核心差异化

```
传统 Harness 模式：
  人类 → 给任务 → Agent执行 → 人类检查 → 给反馈 → Agent再执行 → ...
  ↑ 人类是循环的发动机

Möbius Loop 模式：
  人类 → 定义Loop{目标, 验证条件, 失败策略} → 系统自主运行 → 人类看结果
  ↑ 人类是循环的设计师
```

**五大核心能力：**

1. **Möbius Loop 引擎** — 执行即学习，评估驱动自适应终止
2. **深度委派树** — Agent → SubAgent → SubSubAgent (N 层递归)
3. **CompositeJudge** — 硬性条件验证 + 软性 LLM 质量评分，双维度评估
4. **Memory 自进化** — 知识过期/替代/清理，Nudge 自动沉淀
5. **五层安全护栏** — 借鉴 Hermes，从工具权限到行为异常检测

---

## 项目状态

> **Phase 1: 莫比乌斯之心** — 实现计划已就绪，待开工。

| Phase | 目标 | 状态 |
|-------|------|------|
| 1 | 最小 Möbius Loop 跑通 (真实代码+真实命令+真实Memory) | 📋 计划就绪 |
| 2 | 深度委派树 + Hermes Python Guardrails + 自进化 Memory | 🔮 设计中 |
| 3 | 多通道 (HTTP/Slack/飞书) + 生产级安全 | 🔮 规划中 |

详细实现计划：[docs/plans/2026-06-17-mobius-agent-phase1.md](docs/plans/2026-06-17-mobius-agent-phase1.md)

---

## 架构全景

```
┌──────────────────────────────────────────────────────┐
│              🧠 Möbius Brain (TypeScript 自研)         │
│                                                       │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Loop 编排  │ │ Composite    │ │ Memory 自进化    │  │
│  │ DSL/状态机 │ │ Judge 评估   │ │ Nudge/Skill创建  │  │
│  └─────┬─────┘ └──────┬───────┘ └────────┬────────┘  │
│        └──────────────┼─────────────────┘            │
│                       ▼                               │
│            ┌────────────────────┐                     │
│            │ 深度委派树引擎 (Phase 2) │                │
│            └────────────────────┘                     │
├──────────────────────────────────────────────────────┤
│          🏗️ OpenClaw 骨架 (TypeScript)                │
│  Gateway · EventBus · PluginManager · Worktree       │
├──────────────────────────────────────────────────────┤
│          🛡️ Hermes 安全层 (Python, Phase 2)           │
│  Tool Guardrails · Injection Scan · Budget Control   │
└──────────────────────────────────────────────────────┘
```

---

## 安装

### 前置条件

- **Node.js** >= 20
- **pnpm** >= 8
- **Python** >= 3.12 (仅 Phase 2)
- **Git**

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/xchaor/mobius.git
cd mobius

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm build

# 4. 运行测试
pnpm test

# 5. 用自然语言创建并运行你的第一个 Loop
mobius create "写一个 hello world 函数，写好测试，跑通为止"
```

### 内置 Skills

项目已内置两套 Skills，clone 后自动生效：

```bash
ls .claude/skills/
# brainstorming/  executing-plans/  test-driven-development/  ...
# contradiction-analysis/  investigation-first/  concentrate-forces/  ...
```

---

## 使用方法

### 核心理念：用自然语言定义 Loop

你不需要手写 YAML。你只需要用一句话告诉 Möbius 你想做什么，它会自动生成 Loop 定义、注册并运行。

```bash
# 一句话创建一个 Loop（推荐指定名称）
mobius create -n pr-babysitter "每2小时检查所有PR，CI挂了就自动修，修完提review"

# 输出：
# ✨ Loop 已创建: pr-babysitter
#   触发: 定时 0 */2 * * *
#   条件: 2 个验证条件
#   技能: test-driven-development, systematic-debugging
#   > 运行: mobius run pr-babysitter
#   > 日志: mobius logs pr-babysitter
```

`-n <name>` 是你给 Loop 起的名字，之后用 `mobius run <name>` / `mobius logs <name>` 都靠它。如果不指定 `-n`，Möbius 会自动从你的描述中生成一个，并在创建后**醒目展示**。

### 命令参考

#### `mobius create` — 创建 Loop

```bash
mobius create [options] <description...>
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-n, --name <name>` | Loop 名称（kebab-case），之后 run/logs/status 都用它 | 从描述自动生成 |
| `--no-run` | 只创建不运行（定时任务默认不立即运行） | 手动触发类型会询问 |

```bash
# 推荐：指定名称
mobius create -n pr-babysitter "监控我的所有GitHub PR，CI挂了就自动修"

# 不指定名称：自动生成（注意看创建后的输出）
mobius create "每天早上9点跑数据质量检查并发Slack"

# 只创建不运行
mobius create -n weekly-report --no-run "每周五生成项目进展报告"
```

#### `mobius run` — 运行 Loop

```bash
mobius run [name]
```

| 参数 | 说明 |
|------|------|
| `name` | Loop 名称。**不指定则交互式列出所有 Loop 让你选择** |

```bash
mobius run                  # 不记得名字？不传参数，交互式选择
mobius run pr-babysitter    # 指定名称直接运行
```

#### `mobius list` — 查看所有 Loop

```bash
mobius list
```

输出示例：
```
已注册 3 个 Loop:

  pr-babysitter      (12次)    上次: 2026-06-17 14:30
  daily-data-check   (5次)     上次: 2026-06-17 09:00
  weekly-report      (0次)     从未运行
```

#### `mobius status` — 查看 Loop 详情

```bash
mobius status <name>
```

输出 Loop 的触发方式、验证条件、技能、运行次数、上次运行时间。

#### `mobius logs` — 查看运行历史

```bash
mobius logs [options] <name>
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-n, --limit <n>` | 显示最近 N 条 | 10 |

```bash
mobius logs pr-babysitter           # 最近10次
mobius logs -n 20 pr-babysitter     # 最近20次
```

#### `mobius edit` — 用自然语言修改 Loop

```bash
mobius edit [options] <name> <description...>
```

| 参数 | 说明 |
|------|------|
| `-n, --rename <newName>` | 重命名 Loop |

```bash
mobius edit pr-babysitter "每1小时检查PR，CI挂了自动修，还要发Slack通知"
mobius edit -n pr-guardian pr-babysitter "..."   # 顺便改名
```

#### `mobius stop` — 停止运行中的 Loop

```bash
mobius stop <name>
```

#### `mobius remove` — 删除 Loop

```bash
mobius remove <name>
# 需要确认: Are you sure you want to remove 'pr-babysitter'? (y/N)
```

### 典型工作流

```bash
# 1. 创建（给个名字，后面全靠它）
mobius create -n pr-babysitter "每2小时检查PR，CI挂了自动修"

# 2. 看看有哪些 Loop
mobius list

# 3. 手动跑一次看看效果
mobius run pr-babysitter

# 4. 看日志
mobius logs pr-babysitter

# 5. 不满意？用自然语言改
mobius edit pr-babysitter "检查PR的同时还要自动回复review comment"

# 6. 不想要了？
mobius remove pr-babysitter
```

### 场景示例

```bash
# 场景1: PR 自动守护
mobius create -n pr-babysitter "监控我的所有 GitHub PR，CI 挂了就自动修，有新 review 意见就改代码"

# 场景2: 定时数据巡检
mobius create -n daily-check "每天早上9点跑一遍数据质量检查，发现异常发 Slack 告警"

# 场景3: 代码库健康维护
mobius create -n friday-upgrade "每周五下午自动升级依赖、跑全量测试、生成 CHANGELOG"

# 场景4: 一次性重构任务
mobius create -n refactor-auth "重构 src/auth 模块，保持所有测试通过，改完自己 review 一遍"
mobius run refactor-auth       # 一次性任务创建后手动触发
mobius logs refactor-auth      # 看执行过程
```

### 背后发生了什么

```
你的自然语言 + -n 名称
    │
    ▼
┌──────────────┐
│  Mobius 理解  │  拆解意图 → 选择 skills → 设定验证条件
└──────┬───────┘
       ▼
┌──────────────┐
│  生成 YAML   │  Loop DSL (内部表示，你不需要关心)
└──────┬───────┘
       ▼
┌──────────────┐
│  注册 & 运行  │  cron 触发 / 立即执行 → worktree 隔离 → 评估 → 记忆沉淀
└──────────────┘
```

### Loop 生命周期

```
IDLE → PREPARING → EXECUTING → EVALUATING → REFLECTING → DECIDING
                                            ↑                        │
                                            └────── 继续循环 ────────┘
                                                     ↓
                                              COMPLETED   (条件通过 + 分数达标)
                                              STAGNANT    (连续多轮无进展)
                                              FAILED      (预算耗尽/异常)
```

### 高级用法

如果你想手动控制 Loop 定义（比如团队共享一个精确的 Loop 模板），YAML 文件仍然可以直接编辑：

```bash
mobius run ./my-custom-loop.yaml
```

但日常使用中，`mobius create "自然语言"` 就足够了。

---

## 文档

| 文档 | 说明 |
|------|------|
| [Phase 1 实现计划](docs/plans/2026-06-17-mobius-agent-phase1.md) | 12 个 Task，38 个测试，4 周工期 |
| [意见01 评审](docs/plans/意见01.md) | 10 条修正建议及采纳决策 |
| [Guardrails Proto 设计](docs/design/guardrails-proto.md) | Phase 2 gRPC 接口契约 |
| [Loop Proto 设计](docs/design/loop-proto.md) | Phase 2 Loop 服务接口 |

### 参考资料

- [Prompt 该退环境了，未来属于 Loop Engineering](https://zhuanlan.zhihu.com/p/2049870242541728471) — 引子文章（卡兹克）
- [OpenClaw](https://github.com/openclaw/openclaw) — TypeScript 微内核 Agent 框架
- [Hermes Agent](https://github.com/hermes-agent/hermes) — Python 安全护栏 Agent

---

## 内置 Skills

项目的 `.claude/skills/` 包含 32 个 Skill，来自两个知识体系：

### Superpowers (18 skills)

工程方法论：`brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `dispatching-parallel-agents`, `subagent-driven-development`, `defense-in-depth` 等。

### 元始天尊 (9 skills)

基于唯物辩证法的思维武器：`contradiction-analysis` (矛盾分析), `investigation-first` (调查研究), `practice-cognition` (实践认识论), `concentrate-forces` (集中兵力), `protracted-strategy` (持久战), `overall-planning` (统筹兼顾), `mass-line` (群众路线), `criticism-self-criticism` (批评与自我批评), `spark-prairie-fire` (星火燎原)。

### 斜杠命令

`/brainstorm`, `/write-plan`, `/execute-plan`, `/contradiction-analysis`, `/investigation-first`, `/concentrate-forces`, `/overall-planning` 等 13 个。

---

## 贡献

欢迎提 Issue 和 PR。当前项目处于 Phase 1 早期——如果你想参与核心开发，请先阅读 [实现计划](docs/plans/2026-06-17-mobius-agent-phase1.md)。

## 许可证

MIT License — 详见 [LICENSE](LICENSE)。

## 致谢

- **Peter Steinberger** ([OpenClaw](https://github.com/openclaw/openclaw)) — Loop Engineering 概念发起者
- **Boris Cherny** (Claude Code) — Loop 实践的极致探索者
- **Addy Osmani** (Google) — Loop Engineering 五组件的系统化者
- **Hermes Agent** 团队 — Tool Guardrails + Memory Nudge 的先行者
- **卡兹克** — [引子文章](https://zhuanlan.zhihu.com/p/2049870242541728471) 作者
- **元始天尊 Skill** ([xchaor/ystz-skill](https://github.com/xchaor/ystz-skill)) — 实事求是的方法论武器

---

---

# 🇬🇧 English

## Introduction

**Möbius Agent** is a next-generation AI Agent framework. Its core proposition: **the paradigm leap from Prompt Engineering to Loop Engineering.**

In June 2026, OpenClaw founder Peter Steinberger and Claude Code founder Boris Cherny almost simultaneously declared the same direction — "Prompt is retiring, the future belongs to Loop Engineering." Google's Addy Osmani subsequently systematized Loop Engineering into five components: Cron/Heartbeat, Worktree Isolation, Skills Knowledge System, MCP Connectors, and Sub-Agent Delegation.

Möbius Agent stands on the shoulders of two mature projects:

| Source | What We Inherit | What We Transcend |
|--------|----------------|-------------------|
| **OpenClaw** (TypeScript) | Gateway microkernel + Plugin system + Event bus + Worktree | Native depth-N delegation tree |
| **Hermes Agent** (Python) | Tool Guardrails + Iteration Budget + Memory Nudge | Eval-driven adaptive termination + Self-evolving Memory |

### The Möbius Strip Metaphor

A Möbius strip has only one side — meaning **every iteration of the Loop simultaneously "works" and "learns."** Traditional agents "do the work first, then summarize." Möbius Agent "accumulates experience every second it works," and the next iteration benefits automatically — hence the name.

### Core Differentiators

```
Traditional Harness Pattern:
  Human → Assign Task → Agent Executes → Human Checks → Feedback → Agent Retries → ...
  ↑ Human is the engine of the loop

Möbius Loop Pattern:
  Human → Define Loop{Goal, Validation, Failure Strategy} → System Runs Autonomously → Human Sees Results
  ↑ Human is the designer of the loop
```

**Five Core Capabilities:**

1. **Möbius Loop Engine** — Execute-and-learn in one pass, eval-driven adaptive termination
2. **Depth-N Delegation Tree** — Agent → SubAgent → SubSubAgent (recursive delegation)
3. **CompositeJudge** — Hard condition verification + Soft LLM quality scoring, dual-dimension evaluation
4. **Self-Evolving Memory** — Knowledge expiration/superseding/cleanup, Nudge auto-accumulation
5. **Five-Layer Guardrails** — Inspired by Hermes, from tool permissions to behavioral anomaly detection

---

## Project Status

> **Phase 1: Möbius Heart** — Implementation plan ready, pending execution.

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Minimal Möbius Loop (real code + real commands + real Memory) | 📋 Plan Ready |
| 2 | Delegation tree + Hermes Python Guardrails + Self-evolving Memory | 🔮 Designing |
| 3 | Multi-channel (HTTP/Slack/Feishu) + Production-grade security | 🔮 Planning |

Full implementation plan: [docs/plans/2026-06-17-mobius-agent-phase1.md](docs/plans/2026-06-17-mobius-agent-phase1.md)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│           🧠 Möbius Brain (TypeScript, Custom)        │
│                                                       │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Loop DSL   │ │ Composite    │ │ Self-Evolving   │  │
│  │ & Engine   │ │ Judge        │ │ Memory          │  │
│  └─────┬─────┘ └──────┬───────┘ └────────┬────────┘  │
│        └──────────────┼─────────────────┘            │
│                       ▼                               │
│            ┌────────────────────┐                     │
│            │ Delegation Tree     │ (Phase 2)          │
│            └────────────────────┘                     │
├──────────────────────────────────────────────────────┤
│         🏗️ OpenClaw Skeleton (TypeScript)             │
│  Gateway · EventBus · PluginManager · Worktree       │
├──────────────────────────────────────────────────────┤
│        🛡️ Hermes Guardrails (Python, Phase 2)         │
│  Tool Guardrails · Injection Scan · Budget Control   │
└──────────────────────────────────────────────────────┘
```

---

## Installation

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 8
- **Python** >= 3.12 (Phase 2 only)
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/xchaor/mobius.git
cd mobius

# 2. Install dependencies
pnpm install

# 3. Build
pnpm build

# 4. Run tests
pnpm test

# 5. Create and run your first Loop in natural language
mobius create "Write a hello world function with tests, keep iterating until everything passes"
```

### Built-in Skills

The project ships with 32 Skills in `.claude/skills/`:

```bash
ls .claude/skills/
# brainstorming/  executing-plans/  test-driven-development/  ...
# contradiction-analysis/  investigation-first/  concentrate-forces/  ...
```

---

## Usage

### Core Philosophy: Define Loops in Natural Language

You don't write YAML by hand. You tell Möbius what you want in one sentence, give it a name, and it generates, registers, and optionally runs the Loop — automatically.

```bash
# Create a Loop with an explicit name (recommended)
mobius create -n pr-babysitter "Check all my PRs every 2 hours, auto-fix CI failures"

# Output:
# ✨ Loop created: pr-babysitter
#   Trigger: cron 0 */2 * * *
#   Conditions: 2
#   Skills: test-driven-development, systematic-debugging
#   > Run: mobius run pr-babysitter
#   > Logs: mobius logs pr-babysitter
```

`-n <name>` is the name you give your Loop. Use it with `mobius run <name>` / `mobius logs <name>` / `mobius status <name>`. If you omit `-n`, Möbius auto-generates a name from your description and displays it prominently.

### Command Reference

#### `mobius create` — Create a Loop

```bash
mobius create [options] <description...>
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Loop name (kebab-case). Use this name with run/logs/status | Auto-generated from description |
| `--no-run` | Create only, don't run (cron loops default to not running immediately) | Manual loops prompt to run |

```bash
# Recommended: give it a name
mobius create -n pr-babysitter "Monitor all my GitHub PRs, auto-fix CI on failure"

# Auto-named: watch the output for the generated name
mobius create "Run data quality checks every morning at 9am, alert on Slack"

# Create only, don't run
mobius create -n weekly-report --no-run "Generate project progress report every Friday"
```

#### `mobius run` — Run a Loop

```bash
mobius run [name]
```

| Argument | Description |
|----------|-------------|
| `name` | Loop name. **Omit to interactively pick from a list** |

```bash
mobius run                   # Forgot the name? Run without args to pick interactively
mobius run pr-babysitter     # Run directly by name
```

#### `mobius list` — List All Loops

```bash
mobius list
```

Example output:
```
3 registered Loops:

  pr-babysitter      (12 runs)  last: 2026-06-17 14:30
  daily-data-check   (5 runs)   last: 2026-06-17 09:00
  weekly-report      (0 runs)   never
```

#### `mobius status` — View Loop Details

```bash
mobius status <name>
```

Shows trigger type, validation conditions, skills, run count, and last run time.

#### `mobius logs` — View Run History

```bash
mobius logs [options] <name>
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <n>` | Show last N entries | 10 |

```bash
mobius logs pr-babysitter           # Last 10 runs
mobius logs -n 20 pr-babysitter     # Last 20 runs
```

#### `mobius edit` — Modify a Loop in Natural Language

```bash
mobius edit [options] <name> <description...>
```

| Option | Description |
|--------|-------------|
| `-n, --rename <newName>` | Rename the Loop |

```bash
mobius edit pr-babysitter "Check PRs every hour, auto-fix CI, also send Slack notifications"
mobius edit -n pr-guardian pr-babysitter "..."   # Rename at the same time
```

#### `mobius stop` — Stop a Running Loop

```bash
mobius stop <name>
```

#### `mobius remove` — Delete a Loop

```bash
mobius remove <name>
# Prompts for confirmation: Are you sure you want to remove 'pr-babysitter'? (y/N)
```

### Typical Workflow

```bash
# 1. Create (give it a name — you'll need it later)
mobius create -n pr-babysitter "Check PRs every 2 hours, auto-fix CI failures"

# 2. See what you have
mobius list

# 3. Run it once to test
mobius run pr-babysitter

# 4. Check the logs
mobius logs pr-babysitter

# 5. Not quite right? Edit in natural language
mobius edit pr-babysitter "Check PRs and auto-reply to review comments"

# 6. Don't need it anymore?
mobius remove pr-babysitter
```

### Scenario Examples

```bash
# Scenario 1: PR Babysitter
mobius create -n pr-babysitter "Monitor all my GitHub PRs, auto-fix CI, update code on new reviews"

# Scenario 2: Scheduled Data Checks
mobius create -n daily-check "Run data quality checks every morning at 9am, alert on Slack if anomalies found"

# Scenario 3: Codebase Health
mobius create -n friday-upgrade "Every Friday afternoon, auto-upgrade deps, run full tests, generate CHANGELOG"

# Scenario 4: One-shot Refactor
mobius create -n refactor-auth "Refactor src/auth, keep tests passing, self-review when done"
mobius run refactor-auth
mobius logs refactor-auth
```

### What Happens Behind the Scenes

```
Your natural language + -n name
    │
    ▼
┌──────────────┐
│  Mobius LLM  │  Deconstruct intent → choose skills → set validation
└──────┬───────┘
       ▼
┌──────────────┐
│  Generate    │  Loop DSL YAML (internal — you never see it)
│  YAML        │
└──────┬───────┘
       ▼
┌──────────────┐
│  Register &  │  Saved to registry → cron trigger / manual run → worktree → eval → memory
│  Run         │
└──────────────┘

All you need to remember: the name you gave it. Everything else is automatic.
```

### Loop Lifecycle

```
IDLE → PREPARING → EXECUTING → EVALUATING → REFLECTING → DECIDING
                                            ↑                        │
                                            └─────── continue ───────┘
                                                      ↓
                                              COMPLETED   (conditions met + score ≥ threshold)
                                              STAGNANT    (no progress for N rounds)
                                              FAILED      (budget exhausted / error)
```

### Advanced Usage

If you need precise control (e.g., sharing an exact Loop template across a team), YAML files remain directly editable:

```bash
mobius run ./my-custom-loop.yaml
```

But for daily use, `mobius create -n <name> "natural language"` is all you need.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Phase 1 Plan](docs/plans/2026-06-17-mobius-agent-phase1.md) | 12 Tasks, 38 tests, 4 weeks |
| [Review #01](docs/plans/意见01.md) | 10 revision proposals and adoption decisions |
| [Guardrails Proto](docs/design/guardrails-proto.md) | Phase 2 gRPC interface contract |
| [Loop Proto](docs/design/loop-proto.md) | Phase 2 Loop service interface |

### References

- [Prompt is Retiring — The Future Belongs to Loop Engineering](https://zhuanlan.zhihu.com/p/2049870242541728471) (Chinese)
- [OpenClaw](https://github.com/openclaw/openclaw) — TypeScript microkernel Agent framework
- [Hermes Agent](https://github.com/hermes-agent/hermes) — Python guardrail Agent framework

---

## Built-in Skills

The `.claude/skills/` directory contains 32 Skills from two knowledge systems:

### Superpowers (18 skills)

Engineering methodology: `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `dispatching-parallel-agents`, `subagent-driven-development`, `defense-in-depth`, and more.

### Primeval Lord of Heaven (9 skills)

Dialectical thinking tools: `contradiction-analysis`, `investigation-first`, `practice-cognition`, `concentrate-forces`, `protracted-strategy`, `overall-planning`, `mass-line`, `criticism-self-criticism`, `spark-prairie-fire`.

### Slash Commands

`/brainstorm`, `/write-plan`, `/execute-plan`, `/contradiction-analysis`, `/investigation-first`, `/concentrate-forces`, `/overall-planning`, and 6 more — 13 total.

---

## Contributing

Issues and PRs are welcome. The project is in early Phase 1 — if you'd like to contribute to core development, please read the [implementation plan](docs/plans/2026-06-17-mobius-agent-phase1.md) first.

## License

MIT License — see [LICENSE](LICENSE).

## Acknowledgments

- **Peter Steinberger** ([OpenClaw](https://github.com/openclaw/openclaw)) — Loop Engineering concept originator
- **Boris Cherny** (Claude Code) — Loop practice pioneer
- **Addy Osmani** (Google) — Loop Engineering five-component systematizer
- **Hermes Agent** team — Tool Guardrails + Memory Nudge pioneers
- **卡兹克** — [Introductory article](https://zhuanlan.zhihu.com/p/2049870242541728471) author
- **元始天尊 Skill** ([xchaor/ystz-skill](https://github.com/xchaor/ystz-skill)) — Dialectical methodology toolkit
