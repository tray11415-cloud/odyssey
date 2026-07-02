#!/usr/bin/env node
/**
 * odyssey-mcp-server
 *
 * Operationalizes the Odyssey skill's "intent inference -> parallel
 * generation -> scoring -> persistence" architecture as callable tools,
 * instead of leaving it as descriptive prose that an agent can silently
 * skip. In particular, odyssey_propose_candidates REQUIRES at least 2
 * candidates per call -- the schema itself is the forcing function for
 * parallel candidate generation, closing the gap where agents described
 * "generating multiple candidates" without actually doing it.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  frameGoal,
  getGoal,
  proposeCandidates,
  scoreCandidates,
  resolveGoal,
  listGoals,
  STORE_PATH,
} from "./store.js";
import type { GoalRecord } from "./types.js";

const server = new McpServer({
  name: "odyssey-mcp-server",
  version: "1.0.0",
});

function goalSummary(goal: GoalRecord) {
  return {
    goal_id: goal.goal_id,
    goal: goal.goal,
    done_criteria: goal.done_criteria,
    candidates: goal.candidates.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      score: c.score ?? null,
      rationale: c.rationale ?? null,
    })),
    resolved: goal.resolved,
    winning_candidate_id: goal.winning_candidate_id ?? null,
    resolution_rationale: goal.resolution_rationale ?? null,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
  };
}

// ---------------------------------------------------------------------
// odyssey_frame_goal
// ---------------------------------------------------------------------
const FrameGoalInput = z.object({
  goal: z.string().min(3).max(2000)
    .describe("One-line restatement of the objective being decided/built."),
  done_criteria: z.array(z.string().min(1)).min(1).max(20)
    .describe("Concrete, measurable conditions that define 'done' for this goal."),
}).strict();

server.registerTool(
  "odyssey_frame_goal",
  {
    title: "Frame a Goal",
    description: `Start a new tracked decision by recording the goal and its measurable done-criteria. This is step 1 of Odyssey's operating loop and MUST be called before odyssey_propose_candidates for the same decision.

Args:
  - goal (string): one-line restatement of the objective.
  - done_criteria (string[]): concrete, measurable conditions for "done".

Returns: { goal_id, goal, done_criteria, candidates: [], resolved: false }

Example:
  - Use when: starting any non-trivial build/design decision -> odyssey_frame_goal({goal: "Pick a caching strategy", done_criteria: ["p99 latency < 50ms", "works with existing Redis infra"]})`,
    inputSchema: FrameGoalInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ goal, done_criteria }) => {
    const record = frameGoal(goal, done_criteria);
    const output = goalSummary(record);
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// ---------------------------------------------------------------------
// odyssey_propose_candidates
// ---------------------------------------------------------------------
const CandidateInput = z.object({
  label: z.string().min(1).max(200).describe("Short name for this candidate approach."),
  description: z.string().min(1).max(4000).describe("What this candidate does and why it might win."),
});

const ProposeCandidatesInput = z.object({
  goal_id: z.string().min(1).describe("goal_id returned by odyssey_frame_goal."),
  candidates: z.array(CandidateInput).min(2).max(10)
    .describe("At least 2 genuinely distinct candidate approaches. A single candidate is rejected -- Odyssey's architecture requires generating multiple candidates before scoring, not committing to a first guess."),
}).strict();

server.registerTool(
  "odyssey_propose_candidates",
  {
    title: "Propose Parallel Candidates",
    description: `Record 2+ distinct candidate approaches for a goal, generated in parallel (e.g. via separate subagents or independent reasoning passes) rather than a single first guess. REQUIRES at least 2 candidates -- this is deliberate: it is the mechanism that forces Odyssey's "parallel generation" step to actually happen instead of being skipped.

Args:
  - goal_id (string): from odyssey_frame_goal.
  - candidates (array, min 2): [{label, description}, ...]

Returns: updated goal record with candidate ids assigned.

Error Handling:
  - Returns "Error: goal_id not found" if the goal_id is invalid/unknown -- call odyssey_frame_goal first.

Example:
  - Use when: you have sketched out 3 different architectures for a feature -> submit all 3 here before scoring, not just the one you like best.`,
    inputSchema: ProposeCandidatesInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ goal_id, candidates }) => {
    const record = proposeCandidates(goal_id, candidates);
    if (!record) {
      return { content: [{ type: "text", text: `Error: goal_id '${goal_id}' not found. Call odyssey_frame_goal first.` }] };
    }
    const output = goalSummary(record);
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// ---------------------------------------------------------------------
// odyssey_score_candidates
// ---------------------------------------------------------------------
const ScoreEntryInput = z.object({
  candidate_id: z.string().min(1).describe("candidate id from odyssey_propose_candidates."),
  score: z.number().min(0).max(10).describe("Score 0-10 against the goal's done-criteria."),
  rationale: z.string().min(1).max(2000).describe("Why this score, referencing specific done-criteria."),
});

const ScoreCandidatesInput = z.object({
  goal_id: z.string().min(1),
  scores: z.array(ScoreEntryInput).min(1).max(10),
}).strict();

server.registerTool(
  "odyssey_score_candidates",
  {
    title: "Score Candidates",
    description: `Record scores (0-10) for previously-proposed candidates against the goal's done-criteria, and returns the current leader. Score every candidate from odyssey_propose_candidates before calling odyssey_resolve.

Args:
  - goal_id (string)
  - scores (array): [{candidate_id, score (0-10), rationale}, ...]

Returns: updated goal record including a "leader" field (candidate_id with the highest score so far, or null if no scores yet).

Error Handling:
  - Returns "Error: goal_id not found" if invalid.
  - Unknown candidate_id entries are silently skipped (not present in the goal's candidate list).`,
    inputSchema: ScoreCandidatesInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ goal_id, scores }) => {
    const record = scoreCandidates(goal_id, scores);
    if (!record) {
      return { content: [{ type: "text", text: `Error: goal_id '${goal_id}' not found.` }] };
    }
    const scored = record.candidates.filter((c) => typeof c.score === "number");
    const leader = scored.length
      ? scored.reduce((a, b) => ((b.score ?? -Infinity) > (a.score ?? -Infinity) ? b : a))
      : null;
    const output = { ...goalSummary(record), leader: leader?.id ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// ---------------------------------------------------------------------
// odyssey_resolve
// ---------------------------------------------------------------------
const ResolveInput = z.object({
  goal_id: z.string().min(1),
  winning_candidate_id: z.string().min(1).describe("candidate id being kept/shipped."),
  rationale: z.string().min(1).max(2000).describe("Why this candidate won -- persisted for future recall."),
}).strict();

server.registerTool(
  "odyssey_resolve",
  {
    title: "Resolve a Decision",
    description: `Mark a goal resolved with the winning candidate and rationale. This is the final step of Odyssey's loop -- call this instead of just picking silently, so the decision is durably recorded and retrievable via odyssey_get_history in future sessions (the "personalization compounds over time" mechanism from Odyssey's Architecture section).

Args:
  - goal_id (string)
  - winning_candidate_id (string): candidate id from odyssey_propose_candidates.
  - rationale (string): why this one won.

Returns: the final resolved goal record.

Error Handling:
  - Returns "Error: goal_id not found" if invalid.`,
    inputSchema: ResolveInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ goal_id, winning_candidate_id, rationale }) => {
    const record = resolveGoal(goal_id, winning_candidate_id, rationale);
    if (!record) {
      return { content: [{ type: "text", text: `Error: goal_id '${goal_id}' not found.` }] };
    }
    const output = goalSummary(record);
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// ---------------------------------------------------------------------
// odyssey_get_history
// ---------------------------------------------------------------------
const GetHistoryInput = z.object({
  limit: z.number().int().min(1).max(100).default(20)
    .describe("Max number of goals to return, most recent first."),
  only_unresolved: z.boolean().default(false)
    .describe("If true, only return goals that haven't been resolved yet."),
}).strict();

server.registerTool(
  "odyssey_get_history",
  {
    title: "Get Decision History",
    description: `Retrieve past goals/decisions recorded via odyssey_frame_goal, most recent first. Use this at the start of a related task to check whether a similar decision was already made and resolved (avoids re-deriving the same context every session).

Args:
  - limit (number, default 20): max goals to return.
  - only_unresolved (boolean, default false): filter to in-progress goals only.

Returns: { count, goals: [...] }`,
    inputSchema: GetHistoryInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ limit, only_unresolved }) => {
    const goals = listGoals(limit, only_unresolved).map(goalSummary);
    const output = { count: goals.length, goals };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`odyssey-mcp-server running via stdio (store: ${STORE_PATH})`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
