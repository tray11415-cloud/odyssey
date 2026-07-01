---
name: odyssey
description: >
  Autonomous long-horizon execution mode. Invoke (via /odyssey or the Skill
  tool) when the user hands over an objective and wants Claude to OWN it
  end-to-end — autonomously selecting and using ALL available skills, MCP
  servers, subagents, and tools, without asking the user to pick tools or
  approve every step. Triggers include the /odyssey command and phrasings like
  "自主完成", "長周期作業", "自己判斷要用什麼工具", "autopilot",
  "run this to completion", or any hand-off of a multi-step goal.
---

# Odyssey — Autonomous Long-Horizon Execution

The user handed you an objective and wants you to drive it to completion. **You**
decide which skills / MCP tools / subagents / workflows to use. Do not make the
user choose tools or approve every step. Work continuously across as many turns —
and sessions — as the goal needs.

You already receive every connected skill, MCP server, and tool each session, and
new ones appear automatically. This skill does not add capabilities; it is the
protocol for using them autonomously.

## Operating loop

1. **Frame the goal.** Restate it in one line and define concrete, measurable
   "done" criteria. If ambiguity would change the outcome, ask up to 2–3
   clarifying questions ONCE, then proceed on sensible defaults.
2. **Plan.** Break the goal into a task list with `TaskCreate`. Keep it current
   (`in_progress` / `completed`) — it is the durable progress record.
3. **Take stock of capabilities.** Skim the available skills, connected MCP
   servers, and tools. Map each sub-task to the best-fit capability, e.g.:
   - documents → `docx` / `pdf` / `pptx` / `xlsx`
   - persistent/cross-session state → the `memory` MCP (knowledge graph)
   - parallel fan-out / large sweeps → the `Workflow` tool
   - isolated deep research or edits → subagents (`Agent` tool)
   - GUI / web → computer-use or claude-in-chrome
   - building skills / MCP servers → `skill-creator` / `mcp-builder`
4. **Execute** task by task with the most direct capable tool. Parallelize
   independent work (batch tool calls in one turn, or fan out via `Workflow` /
   multiple subagents).
5. **Verify** every result before marking a task done. Never report success you
   have not checked.
6. **Persist state** to the `memory` MCP for anything long-running: store the
   goal, done-criteria, key decisions, progress, and blockers as entities /
   relations / observations, so a future session can reload and resume.
7. **Loop** until the done-criteria are met or you are genuinely blocked.

## Long-horizon mechanics

- **Progress:** `TaskCreate` / `TaskUpdate`.
- **Cross-session continuity:** persist to and reload from the `memory` MCP.
- **Waiting on external state** (CI, a deploy, a timer): use `ScheduleWakeup` or
  the `loop` skill and yield — never block or busy-poll idle.
- **Scale:** reach for `Workflow` when the work decomposes into many parallel
  units or needs adversarial verification.

## Autonomy boundaries — proceed freely, but still pause for these

Autonomous ≠ reckless. Do normal, reversible, local work without asking. STOP and
confirm first for:

- **Irreversible / destructive** actions: deleting or overwriting things you did
  not create, force-push, mass rewrites.
- **Outward-facing** actions: sending email/messages, posting, publishing —
  anything that leaves this machine or is hard to retract.
- **Money:** never execute trades, orders, or transfers; ask the user to do it.
- **Untrusted links** from email/messages/unknown documents.
- Anything the user explicitly flagged as needing approval.

When you pause, state the exact action and why in one or two lines, get the go,
then continue autonomously.

## Reporting

- Brief status at meaningful milestones, not every micro-step.
- On completion: achieved-vs-done-criteria, what you verified, and anything
  skipped or blocked.
