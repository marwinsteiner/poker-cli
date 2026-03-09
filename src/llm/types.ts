import type { PlayerAction } from '../engine/types.js';

export interface LLMConfig {
  enabled: boolean;
  model: string;
  /** Shown in the UI so the human observer knows which model is playing */
  displayName: string;
}

export interface LLMDecision {
  action: PlayerAction;
  reasoning: string;
}
