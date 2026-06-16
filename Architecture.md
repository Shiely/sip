# Architecture Description: Intelligent Model Router for Agentic Coding
**Version**: 1.0 (MVP + Future Vision)
**Date**: June 11, 2026
**Author**: Grok (as System Architect)

## 1. Executive Summary
The Intelligent Model Router is a VS Code extension that dramatically reduces the cost of agentic coding while maintaining high quality. It uses a frontier LLM as a smart **Orchestrator** that maintains a lightweight structured working memory document and intelligently delegates routine implementation work to fast, low-cost local models.

Target outcomes:
- 60-70% reduction in token cost vs. all-frontier baseline
- Equivalent task completion quality on complex engineering work
- Familiar, low-friction experience for developers who use GitHub Copilot daily

## 2. System Objectives and Success Metrics
**Primary Goals**
- Deliver significant, measurable cost savings
- Create a system developers actually prefer to use
- Build a clean, extensible foundation for future multi-agent capabilities

**Success Metrics (MVP)**
- 60-70% cost reduction
- High task completion rate comparable to frontier-only usage
- Frontier model usage limited to 15-25% of interactions
- Minimal developer babysitting

## 3. Key Architectural Principles
- Hierarchical control with a single frontier Orchestrator
- Persistent, human-readable Working Memory (`.cursor/working-memory.md`)
- Explicit tool-based delegation (no free-form code generation by default)
- Cost-quality optimization (frontier for reasoning, local for implementation)
- Transparency and visibility into routing and cost
- Familiar UX consistent with GitHub Copilot workflows
- Strong extensibility for future agents and agentic loops

## 4. High-Level System Architecture
The system is a **hierarchical orchestrator-worker** architecture:
- **Orchestrator** (frontier model) maintains overall session state and makes high-level decisions.
- **VS Code Extension** acts as the runtime mediator and tool executor.
- **Local Coding Agent** handles implementation, testing, and basic self-healing.
- All communication flows through the extension using explicit tool calls.

## 5. Core Components
### 5.1 Orchestrator
- Uses a frontier model (Claude, Grok, OpenAI, etc.)
- Handles task decomposition, planning, architecture, and complex debugging
- Can perform direct coding when necessary (especially on escalated tasks)
- Strongly encouraged via system prompt to delegate routine work

### 5.2 Working Memory
- Single markdown file (`.cursor/working-memory.md`)
- Contains Active Tasks, Key Decisions, Blockers, Project Context, Session History
- Kept intentionally small (< 6,000 tokens)

### 5.3 Local Coding Agent
- Fast local model (DeepSeek Coder or Qwen2.5-Coder recommended)
- Performs implementation, writes tests, runs validation, and attempts self-healing
- Escalates to Orchestrator after configurable failed attempts (default: 3)

### 5.4 VS Code Extension Core
- Built with the standard VS Code Extension API in TypeScript
- Manages frontier and local model connections
- Handles tool call parsing, routing, and working memory I/O
- Provides UI and cost tracking

### 5.5 Tool Protocol
- `request_plan()`
- `delegate_implementation()`
- `escalate_to_orchestrator()`

## 6. Data Flow and Interaction Sequences
1. User starts task → Orchestrator activated
2. Orchestrator updates working memory and decides action
3. Orchestrator issues tool call (enforced by prompt)
4. Extension routes task to Local Coding Agent
5. Local agent works (code + test + fix loop)
6. Results written back to working memory
7. Escalation path returns control to Orchestrator if needed

Strong prompt engineering and tool enforcement help prevent Orchestrator greed.

## 7. MVP Scope vs Future Extensibility
**MVP**: Orchestrator + single Local Coding Agent, synchronous operation, basic cost tracking.  
**Future Phases**: Multi-agent support, dynamic agent discovery, skill files, asynchronous execution, rich agentic looping (e.g., dedicated Testing Agent coordinating with Coding Agent).

## 8. Technology Stack and Implementation Approach
- **Language**: TypeScript
- **Extension Framework**: Official VS Code Extension API
- **Local Models**: Ollama (primary)
- **Frontier Models**: Official SDKs
- **Development**: Agentic test-driven development using Grok

## 9. File Structure and Code Organization
(See detailed folder structure in the full project template — clean separation across `core/`, `agents/`, `llm/`, `ui/`, `tools/`, and `utils/`).

## 10. User Experience and Interface Design
- **Status Bar**: Real-time agent state and estimated cost/savings
- **Command Palette**: Standard VS Code commands (`Router: Start New Session`, `Router: Open Working Memory`, `Router: Reroute to Frontier`, etc.)
- **Toast Notifications**: Brief feedback on state changes
- **Working Memory File**: Transparent human-readable session log

## 11. Cost Tracking and Monitoring
- Uses official token counts returned by each provider’s API
- Pricing loaded from configurable `pricing.json`
- All displayed values clearly marked as **“Estimated Cost”**
- Prominent disclaimers and warnings to prevent billing surprises
- Detailed cost log written to working memory

## 12. Extensibility and Future Phases
The architecture is designed to evolve into a full multi-agent platform supporting:
- Dynamic agent discovery (`list_available_agents()`)
- Skill-based agent definitions (`skills/*.md`)
- Rich agentic looping and collaboration patterns
- Asynchronous operation

## 13. Risks and Trade-off Decisions
**Key Risks & Mitigations**
- Orchestrator greed → strong prompting + tool enforcement
- Cost estimation error → clear disclaimers + official token counts
- Local model quality → escalation path to Orchestrator
- Extension complexity → narrow MVP scope

**Accepted Trade-offs**
- Synchronous execution (MVP) vs. parallel operation
- Hardcoded prompt (MVP) vs. skill files (Phase 2)
- Simplicity now vs. sophistication later
