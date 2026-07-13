# odyssey-mcp-server

MCP server for the Odyssey candidate loop:

`frame goal -> propose candidates -> score candidates -> resolve -> recall history`

The server turns the loop from guidance into enforceable tool calls. In particular, `odyssey_propose_candidates` requires at least two candidates, `odyssey_score_candidates` requires valid candidate IDs and complete scoring, and `odyssey_resolve` requires a valid scored winner.

## Tools

| Tool | Purpose |
|---|---|
| `odyssey_frame_goal` | Record a goal and measurable done criteria |
| `odyssey_propose_candidates` | Submit two or more distinct candidate approaches |
| `odyssey_score_candidates` | Score every candidate 0-10 against the done criteria |
| `odyssey_resolve` | Mark the winning candidate and persist the rationale |
| `odyssey_get_history` | Retrieve prior goals and decisions |

## Storage

Decisions persist to a local JSON file:

- default on Windows: `%USERPROFILE%\.claude\odyssey-mcp\decisions.json`
- default elsewhere: `./decisions.json`
- override with `ODYSSEY_STORE_PATH`

If the store file exists but cannot be parsed, the server returns an error instead of silently replacing history with an empty store.

## Install

```bash
npm install
npm run build
```

On Windows PowerShell, if `npm.ps1` is blocked by execution policy, use:

```powershell
npm.cmd install
npm.cmd run build
```

Register the built server in your MCP configuration:

```json
"odyssey": {
  "command": "node",
  "args": ["<path-to>/odyssey/mcp-server/dist/index.js"]
}
```

Restart the agent after changing MCP configuration.

## Test

```bash
npm run build
npm run smoke
```

On Windows PowerShell:

```powershell
npm.cmd run build
npm.cmd run smoke
```
