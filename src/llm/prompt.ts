import type { GameState, AvailableAction, Card, Player } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { getTotalPot } from '../engine/side-pots.js';
import { getPositionLabel } from '../engine/positions.js';
import type { PlayerAction } from '../engine/types.js';
import type { LLMDecision } from './types.js';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
};

const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

function formatCard(card: Card): string {
  return `${RANK_NAMES[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

function formatPlayer(p: Player, state: GameState, isSelf: boolean): string {
  const pos = getPositionLabel(p.seatIndex, state.dealerIndex, state.players);
  const posStr = pos ? ` [${pos}]` : '';
  const status = p.isEliminated ? ' (eliminated)' : p.hasFolded ? ' (folded)' : p.isAllIn ? ' (all-in)' : '';
  const lastAct = p.lastAction ? ` — last action: ${p.lastAction}` : '';
  const name = isSelf ? `You (${p.name})` : p.name;
  return `${name}: $${p.chips} chips${posStr}${status}${lastAct}, current bet: $${p.currentBet}`;
}

export const SYSTEM_PROMPT = `You are playing Texas Hold'em poker for real money. You are a poker player sitting at a table. Analyze the game state carefully and make your decision.

Rules reminder:
- You can fold, check, call, raise, or go all-in depending on the situation.
- A raise amount is the TOTAL bet you are putting in, not the incremental amount on top of a call.
- Consider pot odds, your hand strength, position, and opponent behavior.

You must respond with EXACTLY this format at the end of your message:

ACTION: fold
ACTION: check
ACTION: call
ACTION: raise <total_amount>
ACTION: allin

Before your ACTION line, explain your reasoning briefly. The ACTION line must be the last line of your response.`;

export function buildGamePrompt(state: GameState): string {
  const human = state.players[0]!;
  const actions = getAvailableActions(state);
  const totalPot = getTotalPot(state.pots);

  let prompt = `=== CURRENT GAME STATE ===\n`;
  prompt += `Mode: ${state.mode} | Hand #${state.handNumber} | Street: ${state.street}\n`;
  prompt += `Blinds: $${state.smallBlind}/$${state.bigBlind}\n`;
  prompt += `Pot: $${totalPot}`;
  if (state.pots.length > 1) {
    prompt += ` (${state.pots.map((p, i) => i === 0 ? `main: $${p.amount}` : `side ${i}: $${p.amount}`).join(', ')})`;
  }
  prompt += `\n\n`;

  // Your cards
  prompt += `Your hole cards: ${formatCards(human.holeCards)}\n`;

  // Community cards
  if (state.communityCards.length > 0) {
    prompt += `Community cards: ${formatCards(state.communityCards)}\n`;
  } else {
    prompt += `Community cards: (none yet — preflop)\n`;
  }
  prompt += `\n`;

  // All players
  prompt += `=== PLAYERS ===\n`;
  for (const p of state.players) {
    prompt += `${formatPlayer(p, state, p.seatIndex === 0)}\n`;
  }
  prompt += `\n`;

  // Available actions
  prompt += `=== YOUR AVAILABLE ACTIONS ===\n`;
  for (const a of actions) {
    prompt += `- ${a.label}`;
    if (a.type === 'raise' && a.minRaise !== undefined && a.maxRaise !== undefined) {
      prompt += ` (min: $${a.minRaise}, max: $${a.maxRaise})`;
    }
    if (a.type === 'allin' && a.maxRaise !== undefined) {
      prompt += ` ($${a.maxRaise})`;
    }
    prompt += `\n`;
  }

  // Recent action log for context
  if (state.messageLog.length > 0) {
    const recent = state.messageLog.slice(-10);
    prompt += `\n=== RECENT ACTION LOG ===\n`;
    for (const msg of recent) {
      prompt += `${msg}\n`;
    }
  }

  prompt += `\nIt is your turn. What do you do?`;
  return prompt;
}

/**
 * Parse the LLM's response into a PlayerAction.
 * Looks for the last line matching ACTION: <type> [amount]
 */
export function parseResponse(response: string, availableActions: AvailableAction[]): LLMDecision {
  const lines = response.trim().split('\n');

  // Find the ACTION line (last one that matches)
  let actionLine: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line.toUpperCase().startsWith('ACTION:')) {
      actionLine = line;
      break;
    }
  }

  // Extract reasoning (everything before the ACTION line)
  const actionLineIndex = actionLine ? lines.lastIndexOf(lines.find(l => l.trim() === actionLine)!) : -1;
  const reasoningLines = actionLineIndex > 0 ? lines.slice(0, actionLineIndex) : lines.slice(0, -1);
  const reasoning = reasoningLines.join(' ').replace(/\s+/g, ' ').trim();

  if (!actionLine) {
    // Fallback: try to infer from text
    return fallbackParse(response, availableActions, reasoning);
  }

  const actionPart = actionLine.substring(actionLine.indexOf(':') + 1).trim().toLowerCase();

  if (actionPart === 'fold') {
    return { action: { type: 'fold' }, reasoning };
  }
  if (actionPart === 'check') {
    return { action: { type: 'check' }, reasoning };
  }
  if (actionPart === 'call') {
    const callAction = availableActions.find(a => a.type === 'call');
    return { action: { type: 'call', amount: callAction?.callAmount }, reasoning };
  }
  if (actionPart === 'allin' || actionPart === 'all-in' || actionPart === 'all in') {
    const allinAction = availableActions.find(a => a.type === 'allin');
    return { action: { type: 'allin', amount: allinAction?.maxRaise }, reasoning };
  }
  if (actionPart.startsWith('raise')) {
    const amountStr = actionPart.replace('raise', '').replace('$', '').replace(',', '').trim();
    const amount = parseInt(amountStr, 10);
    const raiseAction = availableActions.find(a => a.type === 'raise');
    if (!isNaN(amount) && raiseAction) {
      const clamped = Math.max(raiseAction.minRaise!, Math.min(raiseAction.maxRaise!, amount));
      return { action: { type: 'raise', amount: clamped }, reasoning };
    }
    // If we can't parse the amount, just min-raise
    if (raiseAction) {
      return { action: { type: 'raise', amount: raiseAction.minRaise! }, reasoning };
    }
  }

  return fallbackParse(response, availableActions, reasoning);
}

function fallbackParse(response: string, availableActions: AvailableAction[], reasoning: string): LLMDecision {
  const lower = response.toLowerCase();

  // Try to detect intent from the full text
  if (lower.includes('all-in') || lower.includes('all in') || lower.includes('allin')) {
    const allin = availableActions.find(a => a.type === 'allin');
    if (allin) return { action: { type: 'allin', amount: allin.maxRaise }, reasoning };
  }
  if (lower.includes('raise') || lower.includes('bet')) {
    const raise = availableActions.find(a => a.type === 'raise');
    if (raise) return { action: { type: 'raise', amount: raise.minRaise! }, reasoning };
  }
  if (lower.includes('call')) {
    const call = availableActions.find(a => a.type === 'call');
    if (call) return { action: { type: 'call', amount: call.callAmount }, reasoning };
  }
  if (lower.includes('check')) {
    return { action: { type: 'check' }, reasoning };
  }

  // Ultimate fallback: check if available, else fold
  const check = availableActions.find(a => a.type === 'check');
  if (check) return { action: { type: 'check' }, reasoning: reasoning || 'Could not parse LLM response, defaulting to check.' };
  return { action: { type: 'fold' }, reasoning: reasoning || 'Could not parse LLM response, defaulting to fold.' };
}
