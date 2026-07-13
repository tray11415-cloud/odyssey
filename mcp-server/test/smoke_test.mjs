import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, ODYSSEY_STORE_PATH: join(__dirname, "test_decisions.json") },
});

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error("parse error:", e, line);
    }
  }
});

child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(req) + "\n");
  return new Promise((resolve) => pending.set(id, resolve));
}

function callTool(name, args) {
  return send("tools/call", { name, arguments: args });
}

async function main() {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = await send("tools/list", {});
  console.log("TOOLS:", tools.result.tools.map((t) => t.name).join(", "));

  const framed = await callTool("odyssey_frame_goal", {
    goal: "Pick a way to cache API responses",
    done_criteria: ["p99 < 50ms", "works offline"],
  });
  console.log("FRAME:", framed.result.structuredContent ?? framed.result);
  const goalId = framed.result.structuredContent.goal_id;

  console.log("\n--- testing min-2-candidates enforcement (should be REJECTED) ---");
  const singleCand = await callTool("odyssey_propose_candidates", {
    goal_id: goalId,
    candidates: [{ label: "only one", description: "should fail validation" }],
  });
  console.log("SINGLE CANDIDATE RESULT:", JSON.stringify(singleCand.result).slice(0, 300));

  console.log("\n--- proposing 2 real candidates (should SUCCEED) ---");
  const proposed = await callTool("odyssey_propose_candidates", {
    goal_id: goalId,
    candidates: [
      { label: "in-memory LRU", description: "fast, no persistence across restarts" },
      { label: "redis-backed", description: "persistent, works offline via local redis" },
    ],
  });
  const proposedOut = proposed.result.structuredContent;
  console.log("PROPOSE:", JSON.stringify(proposedOut, null, 2));
  const [cand1, cand2] = proposedOut.candidates;

  console.log("\n--- testing incomplete scoring (should be REJECTED) ---");
  const incompleteScore = await callTool("odyssey_score_candidates", {
    goal_id: goalId,
    scores: [
      { candidate_id: cand1.id, score: 5, rationale: "only one score should fail" },
    ],
  });
  console.log("INCOMPLETE SCORE RESULT:", JSON.stringify(incompleteScore.result).slice(0, 300));

  const scored = await callTool("odyssey_score_candidates", {
    goal_id: goalId,
    scores: [
      { candidate_id: cand1.id, score: 5, rationale: "fast but fails offline criterion" },
      { candidate_id: cand2.id, score: 9, rationale: "meets both done-criteria" },
    ],
  });
  console.log("SCORE leader:", scored.result.structuredContent.leader, "(expect", cand2.id, ")");

  console.log("\n--- testing invalid winner (should be REJECTED) ---");
  const invalidWinner = await callTool("odyssey_resolve", {
    goal_id: goalId,
    winning_candidate_id: "cand_not_real",
    rationale: "should fail validation",
  });
  console.log("INVALID WINNER RESULT:", JSON.stringify(invalidWinner.result).slice(0, 300));

  const resolved = await callTool("odyssey_resolve", {
    goal_id: goalId,
    winning_candidate_id: cand2.id,
    rationale: "redis-backed meets both done-criteria",
  });
  console.log("RESOLVE:", resolved.result.structuredContent.resolved, resolved.result.structuredContent.winning_candidate_id);

  const history = await callTool("odyssey_get_history", { limit: 5, only_unresolved: false });
  console.log("HISTORY count:", history.result.structuredContent.count);

  const singleText = JSON.stringify(singleCand.result).toLowerCase();
  const incompleteText = JSON.stringify(incompleteScore.result).toLowerCase();
  const invalidWinnerText = JSON.stringify(invalidWinner.result).toLowerCase();
  const allPass =
    tools.result.tools.length === 5 &&
    singleText.includes("least 2") &&
    incompleteText.includes("every candidate") &&
    invalidWinnerText.includes("not a candidate") &&
    scored.result.structuredContent.leader === cand2.id &&
    resolved.result.structuredContent.resolved === true &&
    history.result.structuredContent.count >= 1;

  console.log("\n=== SMOKE TEST", allPass ? "PASS" : "FAIL: CHECK OUTPUT ABOVE", "===");
  child.kill();
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  child.kill();
  process.exit(1);
});
