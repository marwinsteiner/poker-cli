import React from 'react';
import { Box } from 'ink';
import type { Card } from '../engine/types.js';
import { CardDisplay } from './CardDisplay.js';

interface CommunityCardsProps {
  cards: Card[];
  revealCount?: number; // for animation: how many to show
}

export function CommunityCards({ cards, revealCount }: CommunityCardsProps) {
  const count = revealCount ?? cards.length;

  return (
    <Box gap={1} justifyContent="center">
      {Array.from({ length: 5 }, (_, i) => {
        const card = i < count ? cards[i] : undefined;
        return <CardDisplay key={i} card={card ?? null} />;
      })}
    </Box>
  );
}
