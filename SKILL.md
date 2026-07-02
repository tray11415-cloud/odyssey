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

## Program Architecture: building software to spec

When the goal is "build/construct a program" (a simulation, a tool, a service),
follow this scaffold instead of writing the final implementation in one shot:

1. **Spec.** Define the I/O contract (inputs, outputs, parameters) and — critically
   — a **ground truth or reference** to validate against, decided *before* writing
   implementation code. If no reference exists, either derive one analytically,
   compute one with a trusted independent method (e.g. a high-precision numerical
   solver), or use an authoritative existing implementation's output. Without this,
   "it ran without crashing" gets mistaken for "it's correct."
2. **Scaffold.** Build the thinnest skeleton that runs end-to-end on trivial input
   before adding complexity — proves the plumbing (build system, I/O format,
   invocation) works before the algorithm does.
3. **Implement the core.** Build the real algorithm incrementally on top of the
   proven scaffold.
4. **Instrument.** Add logging/metrics/checkpoints so failures are diagnosable,
   not silent. A run that produces wrong output with no diagnostics is worse than
   one that crashes loudly.
5. **Test against the ground truth from step 1** with a quantitative fidelity
   metric (not eyeballing) — see "fair metrics" below.
6. **Calibrate to real constraints.** Probe actual available resources (CPU/GPU/
   RAM/time budget) before picking scale parameters — don't guess a particle
   count or dataset size and hope; measure the machine, then size the problem to
   fit the budget.
7. **Verify** by actually running it and checking the metric against a threshold.
   Iterate if below threshold; report the number either way.

**Fair, non-LLM-judge metrics.** Prefer an objective, reproducible metric over
subjective scoring whenever the output is checkable — e.g. **IoU** (intersection-
over-union) between a candidate result and ground truth, computed by discretizing
continuous state (particle positions, pixel regions, etc.) into a grid/bins and
comparing occupancy: `IoU = |A ∩ B| / |A ∪ B|`. Reach for LLM-as-judge scoring
only when no objective metric is derivable (subjective quality, open-ended prose).

## Pipeline Architecture: multi-stage execution with Workflow

For work that decomposes into repeatable stages across multiple variants (build
N things, run N things, score N things), structure execution as an explicit
pipeline using the `Workflow` tool's primitives rather than one linear pass:

```
variants → build (parallel, per-variant) → run/execute → score against
ground truth (parallel, independent verifiers) → aggregate/synthesize
```

- **Default to `pipeline()`**, not `parallel()` — each variant flows through
  build → run → score independently, with no barrier between stages. A fast
  variant finishing "score" shouldn't wait on a slow variant still "building."
- **Reach for a barrier (`parallel()` awaited fully) only when a later stage
  genuinely needs every variant's result at once** — e.g. a comparison table
  that ranks all variants together, or deduping findings across all of them
  before an expensive next step.
- **Isolate with `{isolation: 'worktree'}`** when parallel builds mutate
  overlapping files and would otherwise clobber each other; skip it (cheaper)
  when each variant writes to its own directory already.
- **Named pattern — comparative benchmark** (variants competing on the same
  task): `pipeline(variants, build, run, score)` then aggregate into a table;
  this is the shape for "compare N approaches/conditions on the same tasks."
- Workflow requires the user's explicit opt-in per session (it is not implied
  by Odyssey's general autonomy) — confirm before invoking it, same as any
  other autonomy-boundary action.

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
