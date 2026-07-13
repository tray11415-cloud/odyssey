import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import type { Store, GoalRecord } from "./types.js";

const STORE_PATH = process.env.ODYSSEY_STORE_PATH
  || (process.env.USERPROFILE ? `${process.env.USERPROFILE}\\.claude\\odyssey-mcp\\decisions.json` : "./decisions.json");

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function load(): Store {
  if (!existsSync(STORE_PATH)) return { goals: [] };
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    if (!raw.trim()) return { goals: [] };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.goals)) {
      throw new Error("expected top-level object with a goals array");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Odyssey store at ${STORE_PATH}: ${message}`);
  }
}

function save(store: Store): void {
  ensureDir(STORE_PATH);
  const tempPath = `${STORE_PATH}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
  renameSync(tempPath, STORE_PATH);
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function frameGoal(goal: string, doneCriteria: string[]): GoalRecord {
  const store = load();
  const now = new Date().toISOString();
  const record: GoalRecord = {
    goal_id: newId("goal"),
    goal,
    done_criteria: doneCriteria,
    candidates: [],
    resolved: false,
    created_at: now,
    updated_at: now,
  };
  store.goals.push(record);
  save(store);
  return record;
}

export function getGoal(goalId: string): GoalRecord | undefined {
  return load().goals.find((g) => g.goal_id === goalId);
}

export function proposeCandidates(
  goalId: string,
  candidates: { label: string; description: string }[]
): GoalRecord | undefined {
  const store = load();
  const goal = store.goals.find((g) => g.goal_id === goalId);
  if (!goal) return undefined;
  const added = candidates.map((c) => ({
    id: newId("cand"),
    label: c.label,
    description: c.description,
  }));
  goal.candidates.push(...added);
  goal.updated_at = new Date().toISOString();
  save(store);
  return goal;
}

export function scoreCandidates(
  goalId: string,
  scores: { candidate_id: string; score: number; rationale: string }[]
): GoalRecord | undefined {
  const store = load();
  const goal = store.goals.find((g) => g.goal_id === goalId);
  if (!goal) return undefined;
  for (const s of scores) {
    const cand = goal.candidates.find((c) => c.id === s.candidate_id);
    if (cand) {
      cand.score = s.score;
      cand.rationale = s.rationale;
    }
  }
  goal.updated_at = new Date().toISOString();
  save(store);
  return goal;
}

export function resolveGoal(
  goalId: string,
  winningCandidateId: string,
  rationale: string
): GoalRecord | undefined {
  const store = load();
  const goal = store.goals.find((g) => g.goal_id === goalId);
  if (!goal) return undefined;
  goal.resolved = true;
  goal.winning_candidate_id = winningCandidateId;
  goal.resolution_rationale = rationale;
  goal.updated_at = new Date().toISOString();
  save(store);
  return goal;
}

export function listGoals(limit: number, onlyUnresolved: boolean): GoalRecord[] {
  const store = load();
  let goals = [...store.goals].reverse();
  if (onlyUnresolved) goals = goals.filter((g) => !g.resolved);
  return goals.slice(0, limit);
}

export { STORE_PATH };
