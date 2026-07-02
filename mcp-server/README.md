# odyssey-mcp-server

MCP server that turns Odyssey's "intent inference → parallel generation →
scoring → persistence" architecture from descriptive prose into callable
tools with an enforced schema — most importantly, `odyssey_propose_candidates`
**requires at least 2 candidates per call**, so an agent can no longer silently
skip parallel generation and just submit one plan.

## Tools

| Tool | Purpose |
|---|---|
| `odyssey_frame_goal` | Record a goal + measurable done-criteria. Returns `goal_id`. |
| `odyssey_propose_candidates` | Submit **2+** distinct candidate approaches (rejects fewer than 2). |
| `odyssey_score_candidates` | Score candidates 0-10 against done-criteria; returns current leader. |
| `odyssey_resolve` | Mark the winning candidate + rationale; persists the decision. |
| `odyssey_get_history` | Retrieve past goals/decisions (cross-session recall). |

## Storage

Decisions persist to a local JSON file (default
`%USERPROFILE%\.claude\odyssey-mcp\decisions.json`, override with
`ODYSSEY_STORE_PATH`).

## Install

```bash
cd odyssey-mcp-server
npm install
npm run build
```

Register in `~/.claude.json` under `mcpServers`:

```json
"odyssey": {
  "command": "node",
  "args": ["<path-to>/odyssey-mcp-server/dist/index.js"]
}
```

Restart Claude Code so the server is picked up.

## Test

```bash
npm run build
node test/smoke_test.mjs
```
