import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import figlet from 'figlet';
import type { GameState } from '../engine/types.js';
import { formatChips } from '../engine/chip-format.js';

interface GameOverScreenProps {
  state: GameState;
  onPlayAgain: () => void;
}

export function GameOverScreen({ state, onPlayAgain }: GameOverScreenProps) {
  const { exit } = useApp();
  const [selectedOption, setSelectedOption] = useState(0);
  const [banner, setBanner] = useState('');

  const humanPlayer = state.players[0]!;
  const humanWon = humanPlayer.chips > 0;

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
    if (key.leftArrow) {
      setSelectedOption(0);
    } else if (key.rightArrow) {
      setSelectedOption(1);
    } else if (key.return) {
      if (selectedOption === 0) {
        onPlayAgain();
      } else {
        exit();
      }
    } else if (input === 'q') {
      exit();
    }
  });

  // Sort players by chips for multi-player display
  const sortedPlayers = [...state.players].sort((a, b) => b.chips - a.chips);

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color={humanWon ? 'green' : 'red'}>{banner}</Text>

      <Box height={1} />

      <Box flexDirection="column" alignItems="center">
        <Text>Hands played: {chalk.yellow(String(state.handNumber))}</Text>
        <Box height={1} />
        {state.playerCount <= 2 ? (
          <Text>
            Final chips: {chalk.green(`You ${formatChips(state.players[0]!.chips)}`)}
            {'  '}
            {chalk.red(`${state.players[1]!.name} ${formatChips(state.players[1]!.chips)}`)}
          </Text>
        ) : (
          <Box flexDirection="column" alignItems="center">
            <Text bold>Final Standings:</Text>
            {sortedPlayers.map((p, i) => (
              <Text key={p.seatIndex}>
                {p.isHuman ? chalk.green(`${i + 1}. ${p.name} ${formatChips(p.chips)}`) :
                             chalk.white(`${i + 1}. ${p.name} ${formatChips(p.chips)}`)}
              </Text>
            ))}
          </Box>
        )}
      </Box>

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
