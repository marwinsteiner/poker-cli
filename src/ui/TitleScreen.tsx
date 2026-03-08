import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import figlet from 'figlet';

interface TitleScreenProps {
  onStart: (startingChips: number, smallBlind: number) => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  const { exit } = useApp();
  const [title, setTitle] = useState('');
  const [selectedOption, setSelectedOption] = useState(0); // 0=Start, 1=Quit
  const [chips, setChips] = useState(1500);
  const [blind, setBlind] = useState(10);
  const [configField, setConfigField] = useState(0); // 0=chips, 1=blind, 2=buttons

  useEffect(() => {
    try {
      const rendered = figlet.textSync('POKER', { font: 'Standard' });
      setTitle(rendered);
    } catch {
      setTitle('=== P O K E R ===');
    }
  }, []);

  useInput((input, key) => {
    if (key.upArrow) {
      setConfigField(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setConfigField(prev => Math.min(2, prev + 1));
    } else if (key.leftArrow) {
      if (configField === 0) setChips(prev => Math.max(100, prev - 100));
      else if (configField === 1) setBlind(prev => Math.max(5, prev - 5));
      else setSelectedOption(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      if (configField === 0) setChips(prev => Math.min(10000, prev + 100));
      else if (configField === 1) setBlind(prev => Math.min(100, prev + 5));
      else setSelectedOption(prev => Math.min(1, prev + 1));
    } else if (key.return) {
      if (configField === 2) {
        if (selectedOption === 0) {
          onStart(chips, blind);
        } else {
          exit();
        }
      } else {
        setConfigField(prev => prev + 1);
      }
    } else if (input === 'q') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color="red">{title}</Text>
      <Text bold>Heads-Up No-Limit Texas Hold'em</Text>
      <Box height={1} />

      <Box flexDirection="column" gap={0} paddingX={2}>
        <Text>
          {configField === 0 ? chalk.green.bold('> ') : '  '}
          Starting Chips: {chalk.yellow(`$${chips}`)}
          {configField === 0 ? chalk.dim(' [←/→ adjust]') : ''}
        </Text>
        <Text>
          {configField === 1 ? chalk.green.bold('> ') : '  '}
          Small Blind:    {chalk.yellow(`$${blind}`)}
          {configField === 1 ? chalk.dim(' [←/→ adjust]') : ''}
        </Text>
      </Box>

      <Box height={1} />

      <Box gap={4}>
        <Text
          bold={configField === 2 && selectedOption === 0}
          inverse={configField === 2 && selectedOption === 0}
          color={configField === 2 && selectedOption === 0 ? 'green' : undefined}
          dimColor={configField !== 2}
        >
          {' Start '}
        </Text>
        <Text
          bold={configField === 2 && selectedOption === 1}
          inverse={configField === 2 && selectedOption === 1}
          color={configField === 2 && selectedOption === 1 ? 'red' : undefined}
          dimColor={configField !== 2}
        >
          {' Quit '}
        </Text>
      </Box>

      <Box height={1} />
      <Text dimColor>[↑/↓ Navigate]  [←/→ Adjust]  [Enter Select]  [Q Quit]</Text>
    </Box>
  );
}
