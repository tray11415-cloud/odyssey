---
name: odyssey
description: >
  Autonomous long-horizon execution mode. Use when the user hands over a
  multi-step objective and wants the agent to run it to completion: plan,
  choose tools and skills, execute, verify, persist progress when possible,
  and continue across turns without asking the user to approve every ordinary
  step. Triggers include "/odyssey", "autopilot", "run this to completion",
  "own this end to end", "take over this goal", "自主完成", "一路做到完", and
  similar hand-off requests.
---

# Odyssey: Autonomous Long-Horizon Execution

Use this skill when the user gives you an objective and wants you to drive it to completion. You decide which available skills, tools, MCP servers, subagents, and workflows to use. Do not ask the user to choose tools or approve every ordinary step.

This skill does not add capabilities by itself. It is an operating protocol for using the capabilities that are already available in the current session.

## Operating Loop

1. **Frame the goal.** Restate the objective in one line and define concrete done criteria. If a missing detail would materially change the outcome, ask up to two clarifying questions once, then continue on sensible defaults.
2. **Plan.** Keep a live task list with the available planning mechanism. Use `update_plan` when available; otherwise keep concise progress notes in the conversation or a local project note.
3. **Map capabilities.** Match each task to the best available capability:
   - documents, PDFs, slide decks, or spreadsheets: use the relevant document skill/tool when available
   - persistent or cross-session state: use memory, goal tracking, or a local progress file when available
   - large independent sweeps: use subagents, workflow tools, or batched tool calls when available
   - browser or GUI work: use the available browser/computer-control tool
   - skill or MCP development: use skill-creator, plugin-creator, or the local project patterns
4. **Execute.** Work task by task. Parallelize independent work when the environment provides a safe parallel mechanism.
5. **Verify.** Check each result before marking it done. Do not report success that has not been verified.
6. **Persist state.** For long-running work, save the goal, done criteria, decisions, progress, and blockers using the best available durable mechanism.
7. **Loop.** Continue until the done criteria are met or you are genuinely blocked.

## Intent Inference, Candidates, And Scoring

When the goal is underspecified, do not stall unless the ambiguity is load-bearing.

- Pull two kinds of context before acting: common practice for the task, and any available user/project history.
- If the user has a partial concept, infer the intended meaning from context and proceed.
- If the user gives an open-ended goal, research or inspect enough context to produce the canonical useful result.
- For non-trivial design, implementation, or creative choices, generate at least two distinct candidates before choosing.
- Score candidates against the done criteria, keep or merge the winner, verify it, and persist the decision.

## Odyssey MCP

If the `odyssey` MCP server is connected, use it to enforce the candidate loop instead of relying on prose discipline:

1. `odyssey_frame_goal(goal, done_criteria)` to record the goal.
2. `odyssey_propose_candidates(goal_id, candidates)` to submit two or more distinct candidates.
3. `odyssey_score_candidates(goal_id, scores)` to score every candidate against the done criteria.
4. `odyssey_resolve(goal_id, winning_candidate_id, rationale)` to persist the selected path.
5. `odyssey_get_history(...)` at the start of related work to reuse past decisions.

If the MCP server is not connected, follow the same loop manually.

## Building Software To Spec

For programming goals, avoid jumping straight to the final implementation:

1. Define the input/output contract and a ground truth or reference result before implementation.
2. Build the thinnest end-to-end scaffold first.
3. Implement the core behavior incrementally.
4. Add diagnostics that make failures explainable.
5. Test against the reference with an objective metric whenever possible.
6. Probe actual resource constraints before choosing scale parameters.
7. Run the result and report the verification evidence.

Prefer reproducible metrics such as exact-match tests, snapshot diffs, numeric tolerances, or IoU over subjective judgment when the output is objectively checkable. Use LLM judgment only when no objective metric is available.

## Multi-Stage Work

For work that naturally decomposes into variants and stages, structure it as:

`variants -> build -> run -> score -> aggregate`

Use pipeline or workflow tools when available. Use a barrier only when a later stage truly needs all results at once. Use isolated worktrees or separate output directories when parallel variants would otherwise modify the same files.

## Long-Horizon Mechanics

- Keep progress visible with the available planning/status mechanism.
- Persist cross-session state with memory, goal tracking, or a local progress file when available.
- If waiting on external state, use a scheduler or reminder tool when available; otherwise report the wait condition clearly and stop.
- Use subagents or workflow tools only when the environment exposes them and the task benefits from independent parallel work.

## Autonomy Boundaries

Autonomous does not mean reckless. Do normal, reversible, local work without asking. Stop and confirm first for:

- irreversible or destructive actions, including deleting or overwriting user-created work, force-pushes, and mass rewrites
- outward-facing actions, including email, messages, posting, publishing, or anything difficult to retract
- money movement, purchases, trades, orders, or transfers
- untrusted links from email, messages, or unknown documents
- anything the user explicitly marked as requiring approval

When you pause, state the exact action and why in one or two lines, get confirmation, then continue.

## Reporting

Give brief progress updates at meaningful milestones. On completion, report:

- achieved versus done criteria
- verification performed
- remaining skipped, blocked, or risky items
