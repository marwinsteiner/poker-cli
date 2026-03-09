import Anthropic from '@anthropic-ai/sdk';
import type { GameState, LLMPlayerConfig } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { buildGamePrompt, parseResponse, SYSTEM_PROMPT } from './prompt.js';
import { getExternalDecision } from './file-bridge.js';
import type { LLMDecision } from './types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();  // Uses ANTHROPIC_API_KEY env var
  }
  return client;
}

async function getAPIDecision(state: GameState, config: LLMPlayerConfig): Promise<LLMDecision> {
  const anthropic = getClient();
  const prompt = buildGamePrompt(state);
  const availableActions = getAvailableActions(state);

  const message = await anthropic.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  const responseText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return parseResponse(responseText, availableActions);
}

export async function getLLMDecision(state: GameState, config: LLMPlayerConfig): Promise<LLMDecision> {
  if (config.provider === 'external') {
    return getExternalDecision(state);
  }
  return getAPIDecision(state, config);
}
