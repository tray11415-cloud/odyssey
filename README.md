# Odyssey 🧭

**Autonomous long-horizon execution skill for Claude Code / Claude Agent SDK.**
Hand Claude a goal — it plans, picks its own tools, executes, verifies, and keeps
going until done. No per-step hand-holding.

**給 Claude Code 的自主長周期執行技能。** 丟一個目標給 Claude,它自己規劃、挑工具、
執行、驗證,一路跑到完成 —— 不用你逐步下指令。

---

## English

### What it is

`odyssey` is a **skill** (a folder with a `SKILL.md`) that puts Claude into an
**autonomous, long-horizon operating mode**. Instead of you invoking each tool by
hand, you hand over an objective and Claude decides — on its own — which of the
*currently available* skills, MCP servers, subagents, and tools to use, and drives
the work to completion across as many turns (and sessions) as it takes.

It does **not** grant new capabilities. Claude already receives every connected
skill / MCP / tool each session (and new ones appear automatically). Odyssey is
the **protocol** for using them autonomously.

### How it works — the loop

1. **Frame** the goal + define measurable "done" criteria (asks 2–3 clarifying
   questions once if truly ambiguous, then proceeds).
2. **Plan** into a live task list (`TaskCreate`).
3. **Take stock** of available skills / MCP / tools and map each sub-task to the
   best-fit capability.
4. **Execute**, parallelizing independent work (batched calls, `Workflow`, or
   subagents).
5. **Verify** every result before marking it done.
6. **Persist** state to the `memory` MCP so a future session can resume.
7. **Loop** until the done-criteria are met or genuinely blocked.

### Architecture: intent inference → parallel generation → scoring

Odyssey doesn't require the user to spell out every requirement. It infers
intent, generates multiple candidates, scores them, and feeds the resolution
back into memory so next time there's less to infer — this is the mechanism
meant to replace hand-built harnesses and hand-tuned prompts:

- **Generality vs. personalization** — pull two kinds of context before acting:
  how this is commonly done (docs/codebase/ecosystem conventions), and this
  user/project's prior decisions from the `memory` MCP (long-term memory).
- **Concept vs. no-concept fork** — if the ask is specific-but-incomplete,
  *infer* the intended meaning from context (don't re-ask for what's implied).
  If it's genuinely open-ended, research and produce the canonical answer
  directly rather than stalling on clarification.
- **Parallel candidates, then score** — for anything a single first guess is
  unlikely to nail, generate N candidates in parallel (subagents / `Workflow`),
  score them against the done-criteria, ship the winner.
- **Close the loop** — persist the resolved interpretation back to `memory` so
  personalization compounds across sessions instead of resetting every time.

See the "Architecture" section in [`SKILL.md`](SKILL.md) for the full diagram
and operating rules.

### Safety boundaries

Autonomous ≠ reckless. Claude proceeds freely on normal, reversible, local work,
but **pauses to confirm** before: irreversible/destructive actions, outward-facing
actions (sending mail, posting, publishing), moving money, or following untrusted
links.

### Install

Clone straight into your Claude skills directory:

```bash
git clone https://github.com/tray11415-cloud/odyssey.git ~/.claude/skills/odyssey
```

Then **restart Claude Code** so the skill is picked up.

> `~/.claude/skills/odyssey/SKILL.md` is all Claude needs; the `README` and
> `LICENSE` in the same folder are ignored by the loader.

### Usage

```
/odyssey <your goal>
```

Example:

```
/odyssey Package the app in Desktop/project into an installer and produce a PDF user manual
```

---

## 繁體中文

### 這是什麼

`odyssey` 是一個 **技能**(一個含 `SKILL.md` 的資料夾),讓 Claude 進入
**自主、長周期的運作模式**。你不用逐一手動呼叫工具,只要交付一個目標,Claude 會
**自己判斷**要動用當下可用的哪些技能 / MCP 伺服器 / 子代理 / 工具,並跨多個回合
(甚至多個工作階段)把事情做到完成。

它**不會**新增能力。Claude 每個工作階段本來就會收到所有已連接的技能 / MCP / 工具
(新增的也會自動出現)。Odyssey 提供的是「**自主運用這些能力**」的協定。

### 運作方式 —— 循環

1. **框定** 目標並訂出可衡量的「完成條件」(真的模糊時一次問 2–3 題,之後即依預設進行)。
2. **規劃** 成即時任務清單(`TaskCreate`)。
3. **盤點** 可用的技能 / MCP / 工具,把每個子任務對應到最適合的能力。
4. **執行**,並把獨立工作平行化(批次呼叫、`Workflow`、或多個子代理)。
5. **驗證** 每個結果才標記完成。
6. **持久化** 狀態到 `memory` MCP,讓未來的工作階段能續作。
7. **循環** 直到達成完成條件或真的被卡住。

### 架構:意圖推論 → 平行生成 → 評分

Odyssey 不要求使用者把每個需求都講清楚。它會推論意圖、平行生成多個候選、評分、
再把定案的解讀寫回記憶,讓下次需要推論的部分變少 —— 這正是用來**部份取代
harness engineering、全部取代 prompt engineering** 的機制:

- **一般普遍性 vs 个人化** —— 動手前先拉兩種脈絡:市場/文件/程式庫的常見做法
  (一般普遍性),以及這個使用者/專案在 `memory` MCP 裡的既有決策(長期記憶、个人化)。
- **有概念 vs 無概念 分岔** —— 若需求「具體但不完整」,直接**揣摩**其真正意思
  (不用把已隱含的部分再問一次)。若需求真的開放,就直接研究並產出「正解」
  (最佳實務答案),不要卡在等釐清。
- **先平行生成候選,再打分** —— 對單次猜測不太可能一次到位的任務(設計選擇、
  模糊需求、創意產出),平行生成多個樣品(子代理 / `Workflow`),依完成條件打分,
  選出最終成品。
- **閉環** —— 把定案的解讀持久化回 `memory`,讓「个人化」隨時間累積,而不是
  每個 session 都重新推導一次。

完整圖示與操作規則見 [`SKILL.md`](SKILL.md) 的「Architecture」章節。

### 安全邊界

自主 ≠ 亂衝。一般可逆的本機作業 Claude 會直接做,但遇到以下情況會**先徵求確認**:
不可逆 / 破壞性動作、對外送出(寄信、發文、發佈)、動用金流、或點擊不明連結。

### 安裝

直接 clone 進你的 Claude 技能目錄:

```bash
git clone https://github.com/tray11415-cloud/odyssey.git ~/.claude/skills/odyssey
```

然後**重新啟動 Claude Code**,技能才會被載入。

> Claude 只需要 `~/.claude/skills/odyssey/SKILL.md`;同資料夾內的 `README` 與
> `LICENSE` 載入器會自動忽略。

### 用法

```
/odyssey <你的目標>
```

範例:

```
/odyssey 把 Desktop/專案 打包成安裝程式並產生使用手冊 PDF
```

---

## License

MIT © 2026 tray11415-cloud. See [LICENSE](LICENSE).
