import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import figlet from 'figlet';
import type { GameState } from '../engine/types.js';

interface TournamentResultsProps {
  state: GameState;
  onPlayAgain: () => void;
}

export function TournamentResults({ state, onPlayAgain }: TournamentResultsProps) {
  const { exit } = useApp();
  const [selectedOption, setSelectedOption] = useState(0);
  const [banner, setBanner] = useState('');

  const humanPlayer = state.players[0]!;
  const humanWon = !humanPlayer.isEliminated && state.players.filter(p => !p.isEliminated).length === 1;

  useEffect(() => {
    try {
      const text = humanWon ? 'YOU WIN!' : 'GAME OVER';
      const rendered = figlet.textSync(text, { font: 'Standard' });
      setBanner(rendered);
    } catch {
      setBanner(humanWon ? '=== YOU WIN! ===' : '=== GAME OVER ===');
    }
  }, [humanWon]);

  useInput((input, key) => {
    if (key.leftArrow) setSelectedOption(0);
    else if (key.rightArrow) setSelectedOption(1);
    else if (key.return) {
      if (selectedOption === 0) onPlayAgain();
      else exit();
    } else if (input === 'q') exit();
  });

  // Build finishing order: winner first, then reverse elimination order
  const finishingOrder: { name: string; position: number; chips: number }[] = [];

  // The last player standing is 1st
  const survivors = state.players.filter(p => !p.isEliminated);
  for (const p of survivors) {
    finishingOrder.push({ name: p.name, position: 1, chips: p.chips });
  }

  // Eliminated players in reverse order (last eliminated = 2nd place)
  const elimOrder = [...state.eliminationOrder].reverse();
  for (let i = 0; i < elimOrder.length; i++) {
    const p = state.players[elimOrder[i]!]!;
    finishingOrder.push({ name: p.name, position: survivors.length + i + 1, chips: 0 });
  }

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color={humanWon ? 'green' : 'red'}>{banner}</Text>
      <Box height={1} />

      <Text bold>Tournament Results</Text>
      <Box height={1} />

      <Box flexDirection="column" paddingX={2}>
        {finishingOrder.map((entry, i) => {
          const posColor = entry.position === 1 ? chalk.green.bold :
                          entry.position === 2 ? chalk.yellow :
                          entry.position === 3 ? chalk.red : chalk.dim;
          const medal = entry.position === 1 ? ' *' : '';
          return (
            <Text key={i}>
              {posColor(`${entry.position}${getOrdinal(entry.position)}`)}
              {' '}
              {entry.name}
              {entry.chips > 0 ? chalk.yellow(` $${entry.chips}`) : chalk.dim(' $0')}
              {medal}
            </Text>
          );
        })}
      </Box>

      <Box height={1} />
      <Text>Hands played: {chalk.yellow(String(state.handNumber))}</Text>

      <Box height={1} />
      <Box gap={4}>
        <Text
          bold={selectedOption === 0}
          inverse={selectedOption === 0}
          color={selectedOption === 0 ? 'green' : undefined}
        >
          {' Play Again '}
        </Text>
        <Text
          bold={selectedOption === 1}
          inverse={selectedOption === 1}
          color={selectedOption === 1 ? 'red' : undefined}
        >
          {' Quit '}
        </Text>
      </Box>

      <Box height={1} />
      <Text dimColor>[Left/Right Select]  [Enter Confirm]  [Q Quit]</Text>
    </Box>
  );
}

function getOrdinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
