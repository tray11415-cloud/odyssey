export interface Candidate {
  id: string;
  label: string;
  description: string;
  score?: number;
  rationale?: string;
}

export interface GoalRecord {
  goal_id: string;
  goal: string;
  done_criteria: string[];
  candidates: Candidate[];
  resolved: boolean;
  winning_candidate_id?: string;
  resolution_rationale?: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  goals: GoalRecord[];
}
