import fs from 'node:fs';
import path from 'node:path';
import type { GameState, AvailableAction } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { buildGamePrompt } from './prompt.js';
import { parseResponse } from './prompt.js';
import type { LLMDecision } from './types.js';

// Bridge directory lives in the project root
const BRIDGE_DIR = path.join(process.cwd(), '.poker-bridge');
const STATE_FILE = path.join(BRIDGE_DIR, 'pending-action.json');
const RESPONSE_FILE = path.join(BRIDGE_DIR, 'action-response.json');

export function ensureBridgeDir(): void {
  if (!fs.existsSync(BRIDGE_DIR)) {
    fs.mkdirSync(BRIDGE_DIR, { recursive: true });
  }
}

export function getBridgeDir(): string {
  return BRIDGE_DIR;
}

/**
 * Write the current game state to a file for an external agent to read.
 * Returns a promise that resolves when the external agent writes a response.
 */
export async function getExternalDecision(state: GameState): Promise<LLMDecision> {
  ensureBridgeDir();

  const availableActions = getAvailableActions(state);
  const humanReadablePrompt = buildGamePrompt(state);

  // Write structured state for the external agent
  const statePayload = {
    prompt: humanReadablePrompt,
    availableActions: availableActions.map(a => ({
      type: a.type,
      label: a.label,
      callAmount: a.callAmount,
      minRaise: a.minRaise,
      maxRaise: a.maxRaise,
    })),
    // Machine-readable summary for easy parsing
    summary: {
      street: state.street,
      pot: state.pots.reduce((s, p) => s + p.amount, 0),
      yourChips: state.players[0]!.chips,
      yourCurrentBet: state.players[0]!.currentBet,
      handNumber: state.handNumber,
    },
  };

  // Clean up any stale response
  if (fs.existsSync(RESPONSE_FILE)) {
    fs.unlinkSync(RESPONSE_FILE);
  }

  // Write state file — this signals "your turn"
  fs.writeFileSync(STATE_FILE, JSON.stringify(statePayload, null, 2));

  // Poll for response
  return new Promise<LLMDecision>((resolve) => {
    const poll = setInterval(() => {
      if (fs.existsSync(RESPONSE_FILE)) {
        try {
          const raw = fs.readFileSync(RESPONSE_FILE, 'utf-8');
          const response = JSON.parse(raw) as {
            action?: string;
            type?: string;
            amount?: number;
            reasoning?: string;
          };

          // Clean up bridge files
          try { fs.unlinkSync(STATE_FILE); } catch {}
          try { fs.unlinkSync(RESPONSE_FILE); } catch {}

          clearInterval(poll);

          // Parse response — support both structured and text formats
          if (response.action || response.type) {
            const actionType = (response.action || response.type || 'fold').toLowerCase();
            const reasoning = response.reasoning || '';

            if (actionType === 'fold') {
              resolve({ action: { type: 'fold' }, reasoning });
            } else if (actionType === 'check') {
              resolve({ action: { type: 'check' }, reasoning });
            } else if (actionType === 'call') {
              const callAction = availableActions.find(a => a.type === 'call');
              resolve({ action: { type: 'call', amount: callAction?.callAmount }, reasoning });
            } else if (actionType === 'allin' || actionType === 'all-in') {
              const allinAction = availableActions.find(a => a.type === 'allin');
              resolve({ action: { type: 'allin', amount: allinAction?.maxRaise }, reasoning });
            } else if (actionType.startsWith('raise')) {
              const raiseAction = availableActions.find(a => a.type === 'raise');
              const amount = response.amount ?? raiseAction?.minRaise ?? 0;
              const clamped = raiseAction
                ? Math.max(raiseAction.minRaise!, Math.min(raiseAction.maxRaise!, amount))
                : amount;
              resolve({ action: { type: 'raise', amount: clamped }, reasoning });
            } else {
              // Try text-based parsing as fallback
              resolve(parseResponse(raw, availableActions));
            }
          } else if (typeof raw === 'string') {
            // Treat entire file as text response (ACTION: format)
            resolve(parseResponse(raw, availableActions));
          }
        } catch {
          // Malformed response — wait for a valid one
        }
      }
    }, 500);
  });
}
