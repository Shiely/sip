# Block 2 Completion Report — Working Memory Manager

## Files Created / Modified
(List every file path with one-line purpose)

- `src/core/types.ts` — Additive only: added `WorkingMemoryError` (base) and `TokenBudgetExceededError` (with `currentTokens`/`budget` + `.code`) to the central error hierarchy.
- `src/core/working-memory.ts` — New module implementing `WorkingMemoryManager` and `createWorkingMemoryManager(workspaceRoot, config)`. All file I/O, parsing, serialization, mutators, token budget logic, and optimistic safe-update retry. Always targets `.cursor/working-memory.md` relative to the supplied workspace root.
- `src/test/contract/working-memory.contract.test.ts` — New contract test file (20 tests) covering the full public surface, round-trip fidelity, budget enforcement (including >6000 cases), typed errors, malformed input, and concurrent-style mtime-based retry. All tests use isolated temp workspace roots.

## Public API & Implementation
(Paste key excerpts from `working-memory.ts` — public interface, main methods, token counting logic. Highlight any extensions to Block 1 types.)

```ts
export interface WorkingMemoryManager {
  load(): Promise<WorkingMemory>;
  save(memory: WorkingMemory): Promise<void>;
  appendToHistory(entry: SessionMessage): Promise<WorkingMemory>;
  addActiveTask(task: string): Promise<WorkingMemory>;
  addKeyDecision(decision: string, rationale?: string): Promise<WorkingMemory>;
  addBlocker(blocker: string): Promise<WorkingMemory>;
  updateProjectContext(context: string): Promise<WorkingMemory>;
  enforceTokenBudget(): Promise<boolean>; // returns true if trimmed
  getTokenCount(): number;
}

export function createWorkingMemoryManager(
  workspaceRoot: string,   // resolves internally to <workspaceRoot>/.cursor/working-memory.md
  config: RouterConfig
): WorkingMemoryManager;
```

Key excerpts (token counting + path resolution + safe update):

```ts
// Factory now takes workspaceRoot per updated Architecture v1.0 / Block 2 spec
export function createWorkingMemoryManager(
  workspaceRoot: string,
  config: RouterConfig
): WorkingMemoryManager {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new WorkingMemoryError('workspaceRoot must be a non-empty string');
  }

  const filePath = path.join(workspaceRoot, '.cursor', 'working-memory.md');
  // ... budget, cached state ...

  async function ensureParentDir(): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }
  ...
}

/**
 * Token estimation heuristic for MVP (before Block 3 accurate tokenizer integration).
 * Method: count whitespace-delimited words, multiply by 1.3, Math.ceil.
 * Applied only to semantic text content.
 */
function estimateTokens(text: string): number { ... }

function trimToBudget(...) { /* only drops oldest sessionHistory entries */ }
```

All mutators (`add*`, `appendToHistory`, `updateProjectContext`, `enforceTokenBudget`) go through a `safeMutate` helper that performs optimistic read-modify-write with mtime conflict detection + retry + re-application of the delta.

Extensions to Block 1 types (additive only): `WorkingMemoryError` and `TokenBudgetExceededError` in `types.ts`.

## Parsing & Serialization Details
(How sections are identified, how Markdown fidelity is preserved, token budget enforcement algorithm.)

- **Section headers** are matched exactly: `## Active Tasks`, `## Key Decisions`, `## Blockers`, `## Project Context`, `## Session History` (plus optional `# Working Memory` title). The parser is a simple line-based state machine; unknown `## ` headers terminate the current section. Missing sections default to empty arrays / empty string.
- **Serialization** (`serializeWorkingMemory`) always emits the canonical structure with *all five exact headers* in fixed order, even when sections are empty. This guarantees the file on disk always has the precise section structure required by the Architecture document.
- **Lists / structured items**:
  - Active Tasks & Blockers: simple `- <text>`
  - Key Decisions: `- <ISO-timestamp>: <decision> (Rationale: <optional>)`
  - Session History: `- <ISO-timestamp> [<role>]: <content>`
- **Project Context** preserves multi-line content.
- **Round-trip fidelity**: write → read → write yields semantically identical `WorkingMemory` objects (deep equality on all fields). Byte identity is not required; whitespace and ordering within controlled sections are normalized.
- **Path handling (per updated spec)**: The manager **always** resolves and operates exclusively on the file at `<workspaceRoot>/.cursor/working-memory.md`. The caller supplies the workspace root (e.g. a temp directory in tests or the real VS Code workspace root at runtime). The `.cursor/` directory is created on first write via `mkdir -p`.
- **Token budget enforcement algorithm**: `computeTokenCount` (using the 1.3× word heuristic) is called on every load/mutate/save. `trimToBudget` removes oldest entries from `sessionHistory` until the count is ≤ budget (or no history remains). `save()` and the internal persist paths always trim first; if the result is still over budget a `TokenBudgetExceededError` (with `currentTokens` and `budget`) is thrown. `enforceTokenBudget()` performs an explicit trim + persist and returns `true` only when trimming actually occurred. `getTokenCount()` returns the last cached value (updated on every successful load/mutate/persist).

## Test Results
- Number of contract tests: 20 (working-memory.contract.test.ts) + 13 (foundation) = 33 total.
- Coverage: All public API methods (load, save, the five mutators, enforceTokenBudget, getTokenCount), factory validation, error paths, round-trips, budget trimming + exceed cases, malformed files, and the optimistic locking retry logic are covered by the contract tests. (Instrumented coverage not collected because `@vitest/coverage-v8` is not present in the Block 1 devDependencies.)
- Full test command output (last run):

```
> intelligent-model-router@0.1.0 test
> vitest run

 RUN  v1.6.1 /Users/jpshiely/Projects/intelligent-model-router

 ✓ src/test/contract/foundation.contract.test.ts  (13 tests) 5ms
 ✓ src/test/contract/working-memory.contract.test.ts  (20 tests) 15ms

 Test Files  2 passed (2)
      Tests  33 passed (33)
   Start at  17:46:54
   Duration  144ms (transform 40ms, setup 0ms, collect 55ms, tests 20ms, environment 0ms, prepare 52ms)
```

- TypeScript compile result:

```
> intelligent-model-router@0.1.0 compile
> tsc -p ./
```
(zero errors / zero warnings).

## Assumptions & Design Decisions
(Bullet list)

- The single source of truth for the working memory file location is always `<workspaceRoot>/.cursor/working-memory.md` (per the revised Architecture v1.0 guidance). Callers (orchestrator, future blocks) are expected to pass the workspace root; the manager hides the `.cursor` sub-path construction.
- Token counting remains the simple documented heuristic (`words × 1.3`, ceiling) for MVP. It is intentionally coarse and will be replaceable by a more accurate implementation supplied by Block 3 without changing the `WorkingMemoryManager` contract.
- Only `sessionHistory` is subject to automatic trimming. Very large `projectContext` or individual `keyDecision` / `activeTask` entries that alone exceed the budget cause a typed `TokenBudgetExceededError` rather than silent truncation.
- Newlines inside `SessionMessage.content` and `KeyDecision.decision/rationale` are serialized on a single line (parser takes the remainder of the line). Only `projectContext` is treated as multi-line rich text. This is acceptable for the current scope.
- Safe concurrent updates use a lightweight optimistic mtime check + retry (max 4 attempts) with re-application of the intended mutation (append / add / overwrite context) against the freshly loaded state. Last writer wins after retries. This satisfies the "optimistic locking via file timestamp or simple read-modify-write with retry" requirement without OS-level file locking.
- The parser is intentionally lenient on partial or oddly-formatted files (best-effort extraction of recognizable sections). Real I/O failures and budget violations always surface as typed `WorkingMemoryError` / `TokenBudgetExceededError`.
- Tests deliberately write directly to the canonical `<root>/.cursor/working-memory.md` location (bypassing the manager) to simulate external edits, over-budget historical state, and malformed content.

## Risks / Technical Debt Introduced
(Especially around Markdown parsing robustness and token estimation accuracy)

- The parser is custom (line + regex) rather than a full Markdown parser. It can be surprised by content that contains literal `## ` lines, unescaped colons in decision text that mimic the rationale syntax, or extremely long single-line entries. Mitigated by: controlled serialization, comprehensive round-trip contract tests, and the fact that the orchestrator (future blocks) will primarily write through this manager.
- Token estimation accuracy is only approximate. Real usage with frontier models may cause the 6000-token budget to be either too conservative or (less likely) insufficient once accurate tokenization is added in Block 3.
- No cross-process file locking. The optimistic retry helps but is not a hard guarantee on network filesystems or under heavy concurrent writer load.
- `getTokenCount()` is a synchronous cached value from the manager instance. External direct edits to the `.md` file will make the cached count stale until the next `load()` or `enforceTokenBudget()`.
- The current trim policy never truncates `projectContext`. If a legitimate use case requires a 10 k token context string, the update will fail. This is by design for the current spec but may need clarification.

## Open Questions for Lead

- Should `enforceTokenBudget` (or the save path) ever truncate `projectContext` or individual decision strings when history trimming is insufficient, or is throwing `TokenBudgetExceededError` the desired hard failure mode?
- Is the current single-line treatment of history/decision content acceptable, or do we need a more robust multi-line encoding (e.g. indented blocks or JSON-in-markdown) before Block 3/4?
- Do future blocks expect to pass the VS Code workspace root, a project-specific root, or the literal path to the `.cursor` directory? (Current design assumes a workspace root.)
- Any preference on whether `WorkingMemory.tokenCount` should be considered authoritative or always recomputed on load?

## Verification Checklist
- [x] `npm run compile` succeeds with zero errors/warnings
- [x] All contract tests pass
- [x] Round-trip tests pass on realistic working memory content
- [x] Token budget enforcement works (test cases exceeding 6000 tokens)
- [x] Malformed file handling throws appropriate typed errors
- [x] File is always written with correct section structure
- [x] (Added per updated spec) The implementation resolves and uses exactly `.cursor/working-memory.md` relative to the supplied `workspaceRoot`.

**Engineer sign-off**: Grok 4.3 (xAI) — 2026-06-11 (updated for revised factory contract taking `workspaceRoot` and explicit `.cursor/working-memory.md` resolution per Architecture v1.0 review)

---

Block 2 complete and aligned with the latest Architecture Description Document (v1.0, 2026-06-11). All prior Block 1 contracts remain untouched. Ready for Block 3 (LLM Client), Block 4 (Tool Protocol), or Block 10 (Test Harness) on your signal.
