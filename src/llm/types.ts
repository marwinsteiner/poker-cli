import type { PlayerAction } from '../engine/types.js';

export interface LLMDecision {
  action: PlayerAction;
  reasoning: string;
}
