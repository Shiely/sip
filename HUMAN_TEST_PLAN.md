# Human End-to-End Test Plan — Intelligent Model Router v0.2.0 (Product MVP)

**Purpose**: Verify that a real human can install the shipped extension and experience the full guiding user story with high quality:

> "I begin a planning process with the intelligent router. Using the frontier model we exchange prompts back and forth until I authorize orchestration. The flywheel process standardizes prompts/expectations for the lead orchestrator and sub-agents. Subagents use local models. Cost is calculated and represented. Subagents self-heal where possible with real feedback."

This plan focuses on **manual human steps inside a real VS Code instance**. It complements the automated Tier 1/2/3 smokes in `meta-process/E2E_VALIDATION_RUNBOOK.md`.

**Success Bar (Product MVP)**:
- Clean install from `.vsix` → one primary command completes a realistic task.
- Full flow visible: planning exchange → authorize (Run Task) → autonomous execution with states + timeline + cost.
- Grounded self-correction (real test runs, not just marker).
- Honest metrics and live reports back the README §6 claims (55–75% savings, 15–25% frontier in typical mixed sessions).
- Working memory is human-readable and complete.
- No silent failures.

---

## 1. Prerequisites

**Required**:
- VS Code (latest stable)
- A real workspace folder with some code + tests you can safely edit (e.g. a small TypeScript/JavaScript project with a failing/passing test you control)
- Ollama running locally with a capable coding model:
  - `ollama serve`
  - `ollama pull qwen2.5-coder:14b` (or `deepseek-coder-v2`, `codellama`, etc. — match your `localModel` setting)
- Frontier API key (recommended: xAI Grok for cost experiments):
  - `XAI_API_KEY=...` (or Anthropic/OpenAI equivalent)
- `.env` or shell exports for the above keys (see `.env.example`)

**Recommended**:
- A fresh temp workspace for clean-install testing (see Scenario 1).
- Ability to run `TIER3_SMOKE=1` tests locally for quantitative report data (optional but valuable).

**Note on Test Noise**: `npm test` will show ~11 pre-existing failures in certain P3/P4 contract describes. These are known, documented, test-only hygiene issues and **do not affect the running extension**. Ignore them for human product validation.

---

## 2. Installation & Clean Install Smoke (P6)

**Goal**: Prove a normal user can obtain and install the packaged extension.

1. Go to the latest CI run for this repo (GitHub Actions → "CI").
2. Download the `vsix` artifact (`intelligent-model-router-*.vsix`).
3. In VS Code: Extensions view → ⋮ menu → **Install from VSIX...**
4. Select the downloaded file and reload VS Code when prompted.
5. Open a new workspace folder (ideally a copy of a real project).

**Verify**:
- Extension activates (no errors in Output > "Intelligent Model Router" channel).
- Command Palette (`Cmd/Ctrl+Shift+P`) shows **"Router: Run Task (default — enter task once)"** as the prominent first item.
- Other commands are grouped under "Router (Advanced)".

**Pass if**: Installation succeeds with no manual commands required beyond Run Task, and the extension appears healthy.

---

## 3. Scenario A — The "One Task" Primary Flow (Guiding Story Core)

This is the most important scenario. A user should be able to give one task and have the system handle the rest with visibility.

**Setup**:
- Open your real workspace.
- Make sure Ollama is running and your frontier key is available.
- (Optional but recommended) Create or choose a small, self-contained task with an associated test (e.g. "Add a utility function + write a passing test for it").

**Steps**:

1. Open Command Palette and select **"Router: Run Task (default — enter task once)"**.
2. Enter a clear, realistic task in the input box (example):
   - "Add input validation to the user registration function and make sure the existing tests still pass."
3. Observe immediately:
   - Status bar changes (should go through states).
   - Information toast appears.
   - Output channel ("Intelligent Model Router") starts showing a readable timeline.

4. Watch the full autonomous flow:
   - Status bar shows `Planning`
   - Frontier (Grok/Claude/etc.) produces a plan in the Output timeline and/or working memory.
   - Status bar shows `Delegating (x/y)`
   - Local model (Ollama) receives the task and begins implementation.
   - You see file edits happen in your workspace (via `.cursor/delegate-output.ts` fallback or explicit paths).
   - If tests are involved: real `npm test` (or your `validationCommand`) is executed as part of self-correction.

5. During/after execution:
   - Open `.cursor/working-memory.md` (Command Palette → "Router: Open Working Memory" or just open the file).
   - Verify it contains: Active Tasks, Key Decisions, Session History with Local attempt entries, cost lines.
   - Status bar shows live cost + savings % (e.g. "Est $0.03 · saved 68%").
   - Output timeline contains readable entries like:
     - `[Planning] ...`
     - `[Delegating (1/2)] ... Cost: ...`
     - `[Testing] ...`
     - Local attempt notes with success/failure.

6. When complete:
   - Status bar reaches `Done`.
   - Working memory shows success markers and cost summary.
   - Any code changes + test results are visible in your editor and working memory.

**Expected Observations (High Quality)**:
- Frontier plans sensibly and suggests local delegation (anti-greed).
- Local agent makes 1–3 attempts when needed.
- Real tests run (exit code matters).
- Cost and savings are visible and credible.
- Everything is human-readable in one file (working memory) + status bar + Output.

**Pass if**: You can go from "Run Task" to a completed, grounded result with visible states, cost data, and useful artifacts in under ~5–10 minutes for a medium task, with minimal intervention.

---

## 4. Scenario B — Interactive Planning Exchange (Authorize Later)

**Goal**: Verify the "planning exchange until I authorize" part of the story.

1. Use **"Router: Start New Session"** (or just Run Task).
2. Use the advanced commands to iterate manually:
   - "Router: Request Plan from Orchestrator"
   - Review the plan in working memory / Output.
   - Optionally "Router: Reroute to Frontier" or "Continue / Next Turn" to refine.
3. When satisfied, use **"Router: Run Task (default)"** (or the authorize path) to hand off the final plan to autonomous local execution.

**Verify**:
- Multiple frontier turns are recorded in working memory.
- Cost accumulates correctly across planning turns.
- When you finally authorize, the system respects the plan from memory and proceeds with local agents (P3 loop).

**Pass if**: You can do 1–3 rounds of planning refinement with frontier before authorizing full autonomous execution, and the final run uses the refined context.

---

## 5. Scenario C — Grounded Self-Healing (P4)

**Goal**: Prove subagents self-heal using real test feedback.

1. Start a task that will initially produce incorrect code (or deliberately introduce a bug in a test file first).
2. Authorize via Run Task.
3. Watch the local agent:
   - It runs your validation command (usually `npm test`).
   - On failure, the actual test output is fed back into the next local attempt (you should see this language in working memory / Output: "validation output (exit non-0)", prior failures, etc.).
   - It makes a second (or third) attempt with the feedback.
4. Ideally the second or third attempt succeeds with a corrected implementation + passing tests.

**Pass if**:
- First attempt fails with real test output visible in memory.
- Subsequent attempt(s) use that feedback.
- Final success requires both the `[TASK_SUCCESS]` marker **and** exit code 0 from the real test run.

---

## 6. Scenario D — Cost, Savings, and Live Reports (P2 + P6)

1. Complete at least one full task (from Scenario A).
2. In the working memory and status bar, note the final cost summary:
   - Actual total cost
   - Baseline (what it would have cost with only frontier)
   - Savings %
   - Frontier interaction %
3. (Optional but powerful) From the terminal in the project root, run a live report for quantitative data:
   ```bash
   TIER3_SMOKE=1 npm test -- src/test/real/tier3-daily-workflow.smoke.test.ts
   ```
   Look for the scorecard and the new P6 `runLiveSessionReport` JSON output (or the golden in `src/test/fixtures/`).
4. Compare the numbers against README §6:
   - Typical savings 55–75%
   - Frontier usage 15–25%
   - Report references the full P2/P3/P4/P5 flow.

**Pass if**: Savings % and frontier % are visible during and after the session, and a live report produces credible JSON numbers in the documented band.

---

## 7. Scenario E — UX Polish & Visibility (P5)

Throughout the above scenarios, specifically watch:
- **Status bar**: Cycles through `Planning` → `Delegating (1/2)` → `Testing` → `Escalating` (if needed) → `Done`. Cost/savings appear alongside.
- **Output channel**: Produces a clean, timestamped, human-readable timeline. Every state change produces a toast **and** an Output line (no silent progress).
- **Working memory**: Always up-to-date, sections are populated, cost lines appear after frontier and local calls.
- **Command discoverability**: New users primarily need only "Run Task". The other 7 commands are still there under Advanced for power users/debugging.

**Pass if**: At no point are you guessing what is happening. The extension feels like "an enhanced GitHub Copilot" with full transparency.

---

## 8. Quick Scoring Checklist (Human)

Use this simple scorecard while running the scenarios (aim for most items ✅):

| Area                        | Check                                                                 | Result |
|-----------------------------|-----------------------------------------------------------------------|--------|
| Clean .vsix install         | Installed from artifact, Run Task is default command                  |        |
| One-command task completion | Gave task via Run Task, system finished with minimal intervention     |        |
| Visible states & timeline   | Status bar + Output showed Planning → Delegating → Testing → Done     |        |
| Cost & savings              | Status bar + WM showed actual cost + savings %                        |        |
| Grounded self-correction    | Real test output fed back; success required exit code 0               |        |
| Working memory quality      | Complete sections, local attempts logged, human readable              |        |
| Planning exchange           | Could iterate with frontier before authorizing                        |        |
| Live report / claims        | Numbers in README §6 band (or credible savings >50%)                  |        |
| No silent failures          | Every state produced toast + Output entry                             |        |
| Local model usage           | Most work done by Ollama (frontier only for planning)                 |        |

**Overall Pass**: 8+ ✅ with no critical ❌ (silent progress, no cost visibility, no self-healing, broken install).

---

## 9. Notes & Known Limitations

- Real smokes cost real money and require keys + Ollama. Use small tasks for human testing.
- The 11 test failures on `npm test` are pre-existing test-suite noise (P3/P4 contract describes) and do not impact runtime behavior.
- Grounding and self-healing quality depends heavily on the strength of your local Ollama model.
- First runs may feel slower while models load.
- For production-like validation, combine this human plan with the automated `TIER3_SMOKE=1` run and the live report JSON.

---

## 10. Sign-off

**Date / Tester**: ____________________

**VS Code version**: ____________________

**Ollama model used**: ____________________

**Frontier model used**: ____________________

**Overall Verdict**: ☐ Ready for users / ☐ Needs polish / ☐ Not yet

**Key observations / issues**:

---

**References**:
- `meta-process/E2E_VALIDATION_RUNBOOK.md` (automated one-liners + Tier 3 checklist)
- `README.md` §3 (Quick Start) and §6 (Performance claims backed by live reports)
- `PRODUCT_MVP_P6_WORK_SUMMARY.md` (detailed deliverable evidence)
- `src/test/fixtures/golden-session-report.json` (example report output)
- `src/test/harness/evaluation-harness.ts` (`runLiveSessionReport`)

This plan should let any motivated early user or reviewer validate that the Product MVP delivers on its promises in a real-world setting. 

Begin testing. Maintain notes after each major scenario. 
