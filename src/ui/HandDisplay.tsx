import React from 'react';
import { Box } from 'ink';
import type { Card } from '../engine/types.js';
import { CardDisplay } from './CardDisplay.js';

interface HandDisplayProps {
  cards: Card[];
  faceDown?: boolean;
  highlighted?: boolean;
}

export function HandDisplay({ cards, faceDown, highlighted }: HandDisplayProps) {
  return (
    <Box gap={1}>
      {cards.map((card, i) => (
        <CardDisplay
          key={`${card.suit}-${card.rank}-${i}`}
          card={card}
          faceDown={faceDown}
          highlighted={highlighted}
        />
      ))}
    </Box>
  );
}
