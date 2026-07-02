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

## Architecture: intent inference → parallel generation → scoring

Goal quality should not depend on the user pre-stating every requirement by hand.
This is the mechanism that replaces manually-built harnesses and hand-tuned
prompts: infer intent from context, generate multiple candidates, score them,
keep the winner, and feed the resolution back into memory so next time there is
less to infer.

```
                     goal is underspecified
                              │
              ┌───────────────┴───────────────┐
        generality axis                 personalization axis
   survey how this is commonly      pull prior decisions/preferences
   done (docs, codebase idioms,     for this user/project from the
   ecosystem conventions)           `memory` MCP (long-term memory)
              └───────────────┬───────────────┘
                       does the user have
                       an articulated concept?
                    ┌──────────┴──────────┐
              has a concept           no concept / open-ended
         (asked for something      ("you decide", exploratory)
          specific but incomplete)         │
                    │                      │
        infer their intended        research + produce the
        meaning from codebase +     canonical/best-practice
        memory + immediate ask      answer directly — don't
        ("揣摩意思")                 stall on clarification
                    └──────────┬───────────┘
                     non-trivial or ambiguous?
                    generate N candidates in
                    PARALLEL (subagents / Workflow
                    parallel()), not one first guess
                               │
                        score candidates against
                        the done-criteria + inferred
                        intent + codebase conventions
                               │
                     keep/merge the winner, verify,
                     ship as the final artifact
                               │
                  write the resolved interpretation
                  back to the `memory` MCP — narrows
                  the "no concept" gap next time
```

Practical rules:

- **Don't over-ask.** Use the `Frame the goal` step's 2–3-question budget for
  things that are truly load-bearing. For everything else, infer from the
  codebase, from prior `memory` MCP entries about this user/project, and from
  general best practice — then proceed.
- **User-has-a-concept vs no-concept is a fork, not a fallback.** If the ask is
  specific-but-incomplete, interpret it (don't re-ask for what's implied). If the
  ask is genuinely open, don't wait for specification — produce the researched
  canonical answer and let the user redirect it.
- **Parallelize candidate generation** for anything where a single first attempt
  is unlikely to be right (design choices, ambiguous asks, creative output) —
  reach for `Workflow`'s judge-panel / diverse-lens patterns rather than
  committing to one draft.
- **Score before shipping**, using the done-criteria from step 1 as the rubric.
- **Close the loop**: persist the resolved intent/decision to the `memory` MCP.
  This is what makes the "personalization" axis compound over time instead of
  re-deriving the same context every session.

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
