# Odyssey

Autonomous long-horizon execution skill for Claude Code, Codex-style agents, and other skill-aware coding agents.

Hand the agent a goal and Odyssey gives it a protocol: frame the goal, plan, choose the best available tools, execute, verify, persist progress when possible, and keep going until the done criteria are met.

Odyssey does not grant new capabilities. It tells the agent how to use the capabilities already available in the current session.

## English

### What it is

`odyssey` is a skill folder with a `SKILL.md`. It is meant for multi-step hand-off requests such as:

```text
/odyssey Package the app in Desktop/project into an installer and produce a PDF user manual.
```

The skill tells the agent to:

1. frame the objective and done criteria
2. keep a live plan
3. select the best available skills, tools, MCP servers, subagents, or workflows
4. execute and verify each result
5. persist long-running state when the environment supports it
6. continue until done or genuinely blocked

### Candidate loop

For non-trivial choices, Odyssey uses a candidate loop:

1. infer intent from the request, project, ecosystem conventions, and available memory
2. generate at least two distinct candidates
3. score each candidate against the done criteria
4. keep or merge the winner
5. persist the decision for future related tasks

### odyssey-mcp-server

The optional MCP server in [`mcp-server/`](mcp-server/) turns the candidate loop into tools:

| Tool | Purpose |
|---|---|
| `odyssey_frame_goal` | Record a goal and measurable done criteria |
| `odyssey_propose_candidates` | Submit two or more candidate approaches |
| `odyssey_score_candidates` | Score every candidate against the done criteria |
| `odyssey_resolve` | Persist the winning candidate and rationale |
| `odyssey_get_history` | Retrieve prior goals and decisions |

The server enforces important invariants: at least two candidates, valid candidate IDs, complete scoring before resolution, and valid winning candidates.

### Install the skill

Clone the repository into your skills directory:

```bash
git clone https://github.com/tray11415-cloud/odyssey.git ~/.claude/skills/odyssey
```

For Codex-style local skills, use the equivalent skills directory, for example:

```bash
git clone https://github.com/tray11415-cloud/odyssey.git ~/.codex/skills/odyssey
```

Restart the agent so the skill is discovered.

### Install the MCP server

```bash
cd odyssey/mcp-server
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

Restart the agent after registering the server.

### Test

```bash
cd odyssey/mcp-server
npm run build
npm run smoke
```

On Windows PowerShell:

```powershell
npm.cmd run build
npm.cmd run smoke
```

## 繁體中文

### 這是什麼

`odyssey` 是一個長任務自主執行 skill。當你把一個多步驟目標交給 agent 時，它會要求 agent 先界定目標與完成標準，再自行選擇可用的工具、skills、MCP servers、subagents 或工作流，持續執行、驗證並保存進度。

它不會新增能力；它是一套「如何可靠使用既有能力」的工作協議。

### 適合的使用方式

```text
/odyssey 幫我把這個專案打包成安裝程式，並產出一份 PDF 使用手冊。
```

Agent 應該：

1. 重述目標並定義可驗證的完成標準
2. 維護任務清單
3. 根據目前環境選擇合適工具
4. 一步步執行並驗證結果
5. 在長任務中保存進度與關鍵決策
6. 直到完成或真的卡住才停止

### 候選方案機制

遇到重要或不明確的選擇時，不要只採用第一個想法。應該產生至少兩個候選方案，根據完成標準評分，選出或合併最佳方案，並保存決策理由。

### 安全邊界

一般、可逆、本機的操作可以直接進行。遇到刪除或覆寫使用者資料、force push、發信、發布、付款、交易、下單、外部不可撤回行為，或使用者明確要求先確認的行為，必須先停下來取得確認。

## License

MIT, 2026 tray11415-cloud. See [LICENSE](LICENSE).
