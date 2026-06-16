/**
 * Intelligent Model Router — VS Code Extension Entry Point (Block 9)
 *
 * Full activation lifecycle, command palette surface, session management,
 * status bar wired to live Block 8 CostTracker, working memory management,
 * and end-to-end integration of all prior blocks (router, local agent, LLM clients,
 * cost tracking, protocol, memory) using wrapped clients for automatic telemetry.
 *
 * Strict TDD integration block. No new core business logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';

import { loadPricingSafe } from './core/config';
import { getDefaultRouterConfig } from './core/config';
import {
  type RouterConfig,
  type SessionState,
  type ToolResult,
} from './core/types';
import { STATUS_BAR_TEXT, EXTENSION_ID } from './core/constants';

import { createWorkingMemoryManager, type WorkingMemoryManager } from './core/working-memory';
import { createLLMClient, type LLMClient } from './llm/client';
import { createRouter, type Router } from './routing/router';
import { createLocalCodingAgent, type LocalCodingAgent } from './agents/local-coding-agent';
import {
  createCostTracker,
  getStatusBarText,
  getStatusBarTooltip,
  type CostTracker,
} from './cost/tracker';
import { createToolCall } from './tools/protocol';

// ============================================================================
// Session-scoped state (MVP: single active session)
// ============================================================================
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

let currentConfig: RouterConfig | undefined;
let currentMemoryManager: WorkingMemoryManager | undefined;
let currentRouter: Router | undefined;
let currentLocalAgent: LocalCodingAgent | undefined;
let currentCostTracker: CostTracker | undefined;
let currentSession: SessionState | undefined;

// ============================================================================
// Cost-recording wrapper (the Block 9 seam that feeds Block 8 from any LLM response)
// ============================================================================
export function createCostRecordingLLMClient(
  inner: LLMClient,
  tracker: CostTracker,
  role: 'orchestrator' | 'local_coding_agent',
  modelName: string
): LLMClient {
  return {
    async generate(messages: Array<{ role: string; content: string }>, options?: any) {
      const resp = await inner.generate(messages, options);
      if (resp && resp.usage) {
        tracker.recordUsage(resp.usage, resp.model || modelName, role);
      }
      return resp;
    },
    async *stream(messages: Array<{ role: string; content: string }>, options?: any) {
      for await (const chunk of inner.stream(messages, options)) {
        yield chunk;
      }
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================
function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}

function updateStatusBar(): void {
  if (!statusBarItem) return;
  if (!currentCostTracker) {
    statusBarItem.text = STATUS_BAR_TEXT;
    statusBarItem.tooltip = 'Intelligent Model Router — Orchestrator + Local Agent Routing (no active session)';
    return;
  }
  const summary = currentCostTracker.getSessionCost();
  statusBarItem.text = getStatusBarText(summary);
  statusBarItem.tooltip = getStatusBarTooltip(summary);
}

// Internal event router to dedicated OutputChannel (Phase 0 requirement).
// Always also emits to console for devtools / test stdout observability.
function logToChannel(message: string): void {
  const ts = new Date().toISOString();