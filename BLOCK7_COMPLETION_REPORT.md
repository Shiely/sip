# Block 7 Completion Report — Local Coding Agent & Self-Correction Loop

## Files Created / Modified
- **Created**: `src/agents/local-coding-agent.ts` (new module implementing the LocalCodingAgent)
- **Created**: `src/test/contract/local-coding-agent.contract.test.ts` (15 new contract + integration tests using Block 10 mocks)
- **Created**: `src/agents/` directory
- No modifications to locked blocks (Blocks 1-6, 10). Router's inline delegate stub left untouched per "only modify files relevant to Block 7" and no scope creep.

## Public API & Self-Correction Logic
```ts
export interface LocalCodingAgent {
  executeDelegatedTask(task: string, instructions?: string, session: SessionState): Promise<ToolResult>;
}

export function createLocalCodingAgent(
  localClient: LLMClient,
  router: Router,           // for escalation
  memoryManager: WorkingMemoryManager
): LocalCodingAgent;
```

Key excerpts from implementation (attempt loop + escalation contract):

```ts
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const messages = buildLocalAgentMessages(trimmedTask, instructions, attempt, priorFailures);
  // ... await localClient.generate ...
  await memoryManager.appendToHistory({ role: 'local', content: `Local attempt ${attempt}/...`, ... });

  const hasSuccessMarker = /\[TASK_SUCCESS\]/i.test(respContent);
  const failMatch = respContent.match(/\[TASK_FAILED:\s*([^\]\n]+)\]/i);
  const thisSuccess = hasSuccessMarker && !failMatch;

  if (thisSuccess) {
    ... build DelegateImplementationResult { testsPassed: true, ... }
    return buildToolResult(...);
  } else {
    priorFailures.push(reason);
  }
}

// after 3 failures
const escArgs = { reason: `Local coding agent failed after ${MAX_ATTEMPTS} ...`, partialResult: lastContent, error: lastReason };
await router.handleEscalation(escArgs, session);
... return failure DelegateImplementationResult (testsPassed=false) ...
```

- Prompt builder injects task + instructions + prior failure feedback for self-correction on retries.
- Uses `DEFAULT_MAX_LOCAL_ATTEMPTS` (3) from constants.
- Success detection via explicit `[TASK_SUCCESS]` / `[TASK_FAILED: ...]` markers (MVP simulation, fully controllable via Block 10 mock `responses`).
- Always updates working memory (addActiveTask + per-attempt local history entries).
- Escalation is a side-effect call to router (records blocker + local history entry) while the execute still returns a typed DelegateImplementationResult-shaped failure for caller compatibility.

## Test Results
- Number of new tests: **15**
- Total tests: **156** (141 prior + 15)
- Full test command output:
```
 ✓ src/test/contract/tool-protocol.contract.test.ts  (29 tests) 5ms
 ✓ src/test/contract/foundation.contract.test.ts  (16 tests) 17ms
 ✓ src/test/contract/test-infrastructure.contract.test.ts  (21 tests) 8ms
 ✓ src/test/contract/orchestrator-prompt.contract.test.ts  (20 tests) 7ms
 ✓ src/test/contract/router.contract.test.ts  (22 tests) 9ms
 ✓ src/test/contract/local-coding-agent.contract.test.ts  (15 tests) 15ms
 ✓ src/test/contract/working-memory.contract.test.ts  (20 tests) 84ms
 ✓ src/test/contract/llm-client.contract.test.ts  (13 tests) 2122ms

 Test Files  8 passed (8)
      Tests  156 passed (156)
```

## Assumptions & Design Decisions
- Kept to exact public API surface and "Scope (In)" from the Block 7 spec. No VS Code FileSystem / real edit / real test execution (explicitly out of scope for MVP; simulation via LLM response + markers).
- Used marker protocol in local prompts for deterministic loop control in tests (robust against varying mock response text). Fallback heuristic exists for non-marker responses.
- Returned ToolResults always carry DelegateImplementationResult-shaped JSON content (even on the escalation path) so that a future drop-in replacement in router's delegate handler remains compatible with Block 5 contracts/parsers.
- Synthetic toolCallId for agent-standalone results (when wired, the outer delegate ToolCall id would be used instead).
- Router is injected only for the escalation contract (handleEscalation). No changes were made to router.ts (Block 5 locked).
- Best-effort (try/catch) memory updates and task recording to match patterns from Block 5 router.
- max attempts sourced from existing `DEFAULT_MAX_LOCAL_ATTEMPTS` / RouterConfig value rather than hardcoding a bare `3`.
- Call-signature normalization (small wrapper + overloads on interface) to realize the exact documented `(task, instructions?, session)` ergonomics while producing valid TypeScript and clean `tsc`.

## Risks / Technical Debt Introduced
- None critical. The marker-based success signal is a testability aid for Block 7; a later block (or Block 9 wiring) can evolve to parse richer structured output or actual test results from the local model.
- Agent not yet wired into the router's `handleDelegateImplementation` (intentionally — keeps Block 5 locked and avoids scope creep). The existing single-shot stub in router continues to satisfy its own contracts. Future integration point is clear and low-risk.
- Synthetic IDs on direct agent returns are fine for its contract tests; real usage will flow through toolCall correlation.

## Open Questions for Lead
- Should the LocalCodingAgent eventually become the exclusive implementation of the `delegate_implementation` path inside the router (small refactor in a post-Block-7 pass), or stay as a parallel collaborator?
- Do we want a companion `src/prompts/local-coding-agent.md` + builder (like Block 6) in a follow-up, or is the inline builder in the agent module sufficient for MVP?
- Any preference on whether escalation from the agent should return the *escalate* ToolResult shape vs. a delegate-failure shape to the execute caller?

## Verification Checklist
- [x] npm run compile clean
- [x] All tests pass (including multi-attempt + escalation paths)
- [x] Self-correction loop respects max 3 attempts
- [x] Escalation works via Block 4/5 (calls router.handleEscalation with proper payload)
- [x] Integrates with router and memory manager (via constructor injection + side effects)
- [x] 15 new tests, total now 156, zero regressions on prior locked blocks
- [x] Strict TDD followed (failing test written and observed first; impl then made green)
