/**
 * Core type system and interfaces for the Intelligent Model Router VS Code extension.
 * This file defines the complete public contract surface for all subsequent blocks.
 * All types are strictly defined with no `any` where avoidable.
 */

// ============================================================================
// Branded / Opaque Types for Safety
// ============================================================================

declare const brand: unique symbol;

/**
 * Branded string type for strong typing of identifiers.
 * Prevents accidental mixing of IDs (e.g. passing a TaskId where SessionId expected).
 */
export type Branded<T, Brand extends string> = T & { readonly [brand]: Brand };

export type SessionId = Branded<string, 'SessionId'>;
export type ToolCallId = Branded<string, 'ToolCallId'>;

// ============================================================================
// Model Roles & Providers
// ============================================================================

export type ModelRole = 'orchestrator' | 'local_coding_agent';

export type OrchestratorProvider = 'anthropic' | 'openai' | 'xai';
export type LocalProvider = 'ollama';
export type Provider = OrchestratorProvider | LocalProvider;

// ============================================================================
// Tool Names (MVP)
// ============================================================================

export type ToolName =
  | 'request_plan'
  | 'delegate_implementation'
  | 'escalate_to_orchestrator';

// ============================================================================
// Tool Call / Result Shapes
// ============================================================================

export interface ToolCall {
  name: ToolName;
  arguments: Record<string, unknown>;
  id?: ToolCallId; // Correlation ID (branded for safety)
}

export interface ToolResult {
  toolCallId: ToolCallId;
  success: boolean;
  content: string;
  metadata?: Record<string, unknown>;
};

// ============================================================================
// Working Memory (schema only — persistence in Block 2)
// ============================================================================

export interface KeyDecision {
  timestamp: string; // ISO 8601
  decision: string;
  rationale?: string;
}

export interface SessionMessage {
  role: 'orchestrator' | 'local' | 'system';
  content: string;
  timestamp: string; // ISO 8601
}

export interface WorkingMemory {
  activeTasks: string[];
  keyDecisions: KeyDecision[];
  blockers: string[];
  projectContext: string;
  sessionHistory: SessionMessage[];
  tokenCount?: number; // Approximate, maintained by persistence layer

  // Phase 6 additive (deliverable 23): skill usage tracking (active + decisions).
  // Optional for full backward compat with pre-Phase6 serialized memory + all existing callers.
  activeSkills?: string[];
  skillDecisions?: Array<{
    timestamp: string;
    skill: string;
    decision: string;
  }>;
}

// ============================================================================
// Cost & Usage Tracking
// ============================================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostSnapshot {
  model: string;
  usage: TokenUsage;
  estimatedCostUSD: number;
  timestamp: string; // ISO 8601
}

// ============================================================================
// Session & Routing State
// ============================================================================

export interface SessionState {
  sessionId: SessionId;
  workingMemoryPath: string;
  orchestratorModel: string;
  localModel: string;
  frontierUsageCount: number;
  totalInteractions: number;
  currentCost: CostSnapshot | null;
}

// ============================================================================
// Configuration
// ============================================================================

export interface RouterConfig {
  orchestratorProvider: OrchestratorProvider;
  orchestratorModel: string;
  localProvider: LocalProvider;
  localModel: string;
  maxLocalAttempts: number; // default 3
  workingMemoryTokenBudget: number; // default 6000
  // P4 (4.1): additive configurable validation command (default "npm test"); used by local agent real-tool guard for grounded success gate.
  // Does not affect protected surfaces or prior phases.
  validationCommand?: string;
}

// ============================================================================
// Routing & Escalation (supporting types added for clean contract)
// ============================================================================

/**
 * The decision output from any routing logic.
 * Added because a clean, typed decision object is required for the orchestrator/local
 * handoff contract. Prevents ad-hoc string/boolean returns in later blocks.
 */
export interface RoutingDecision {
  useOrchestrator: boolean;
  reason: string;
  confidence: number; // 0.0 - 1.0
  suggestedModel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payload when a local agent escalates a task back to the orchestrator.
 * Explicitly defined per spec guidance to avoid implicit any or loose objects.
 */
export interface EscalationPayload {
  originalTask: string;
  context: WorkingMemory;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  suggestedNextAction?: string;
}

// ============================================================================
// Error Hierarchy (centralized, typed errors)
// ============================================================================

export class RouterError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'ROUTER_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigurationError extends RouterError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class ModelClientError extends RouterError {
  constructor(message: string, public readonly provider?: Provider) {
    super(message, 'MODEL_CLIENT_ERROR');
  }
}

export class ToolValidationError extends RouterError {
  constructor(message: string, public readonly toolName?: ToolName) {
    super(message, 'TOOL_VALIDATION_ERROR');
  }
}

/**
 * Thrown when pricing.json fails schema validation or cannot be loaded.
 * Used by the config loader to give callers a precise, catchable error type.
 */
export class PricingLoadError extends ConfigurationError {
  constructor(message: string, public readonly path?: string) {
    super(`Pricing configuration error: ${message}`);
    this.name = 'PricingLoadError';
  }
}

// ============================================================================
// Working Memory Errors (Block 2)
// ============================================================================

/**
 * Base error for all working memory operations (I/O, parse, budget).
 * Enables callers to catch broadly: if (err instanceof WorkingMemoryError)
 */
export class WorkingMemoryError extends RouterError {
  constructor(message: string, code: string = 'WORKING_MEMORY_ERROR') {
    super(message, code);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown by save / mutators when after trimming history the memory still exceeds
 * the configured workingMemoryTokenBudget.
 */
export class TokenBudgetExceededError extends WorkingMemoryError {
  constructor(
    message: string,
    public readonly currentTokens: number,
    public readonly budget: number
  ) {
    super(message, 'TOKEN_BUDGET_EXCEEDED');
    this.name = 'TokenBudgetExceededError';
  }
}

// ============================================================================
// Block 4: Tool Protocol — Precise Argument & Result Shapes (additive only)
// These are the canonical shapes for the three MVP tools. Used by protocol.ts
// for validation, builders, and for constructing LLM tool schemas.
// ============================================================================

export interface RequestPlanArgs {
  taskDescription: string;
  context?: string;
}

export interface DelegateImplementationArgs {
  task: string;
  instructions?: string;
}

export interface EscalateToOrchestratorArgs {
  reason: string;
  partialResult?: string;
  error?: string;
}

export interface RequestPlanResult {
  plan: string;
  tasks: string[];
  decisions: any[];
}

export interface DelegateImplementationResult {
  codeChanges: string;
  testsPassed: boolean;
  summary: string;
}

export interface EscalateToOrchestratorResult {
  escalated: boolean;
  message: string;
}