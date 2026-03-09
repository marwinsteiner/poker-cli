import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import figlet from 'figlet';
import type { GameConfig, GameMode, LLMProvider } from '../engine/types.js';
import { getBlindSchedule, type BlindSpeed } from '../engine/blind-schedule.js';
import { getBridgeDir } from '../llm/file-bridge.js';

interface TitleScreenProps {
  onStart: (config: GameConfig) => void;
}

type Step = 'mode' | 'config';

const MODE_OPTIONS: { mode: GameMode; label: string; desc: string }[] = [
  { mode: 'headsup', label: 'Heads-Up (1v1)', desc: 'Classic 1-on-1 poker' },
  { mode: 'cash', label: 'Cash Game', desc: '6 or 8-handed with AI opponents' },
  { mode: 'tournament', label: 'Tournament', desc: 'Increasing blinds, last one standing wins' },
];

// index 0 = External Agent (file bridge, no API key needed)
// index 1+ = API models (require ANTHROPIC_API_KEY)
const LLM_OPTIONS: { provider: LLMProvider; model: string; display: string }[] = [
  { provider: 'external', model: 'external', display: 'External Agent (file bridge)' },
  { provider: 'api', model: 'claude-opus-4-6', display: 'Claude Opus 4.6 (API)' },
  { provider: 'api', model: 'claude-sonnet-4-6', display: 'Claude Sonnet 4.6 (API)' },
  { provider: 'api', model: 'claude-opus-4-20250514', display: 'Claude Opus 4 (API)' },
  { provider: 'api', model: 'claude-sonnet-4-20250514', display: 'Claude Sonnet 4 (API)' },
  { provider: 'api', model: 'claude-haiku-4-5-20251001', display: 'Claude Haiku 4.5 (API)' },
];

const hasApiKey = !!process.env['ANTHROPIC_API_KEY'];

export function TitleScreen({ onStart }: TitleScreenProps) {
  const { exit } = useApp();
  const [title, setTitle] = useState('');
  const [step, setStep] = useState<Step>('mode');

  // Mode selection
  const [modeIndex, setModeIndex] = useState(0);

  // Config fields
  const [chips, setChips] = useState(1500);
  const [blind, setBlind] = useState(10);
  const [playerCount, setPlayerCount] = useState(6);
  const [blindSpeed, setBlindSpeed] = useState<BlindSpeed>('normal');
  const [actionTimer, setActionTimer] = useState(30);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmOptionIndex, setLlmOptionIndex] = useState(0);
  const [configField, setConfigField] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);

  const selectedMode = MODE_OPTIONS[modeIndex]!.mode;
  const selectedLlm = LLM_OPTIONS[llmOptionIndex]!;

  useEffect(() => {
    try {
      const rendered = figlet.textSync('POKER', { font: 'Standard' });
      setTitle(rendered);
    } catch {
      setTitle('=== P O K E R ===');
    }
  }, []);

  // Number of config fields depends on mode
  const getConfigFields = (): readonly string[] => {
    const base: string[] = [];
    switch (selectedMode) {
      case 'headsup':
        base.push('chips', 'blind');
        break;
      case 'cash':
        base.push('chips', 'blind', 'playerCount');
        break;
      case 'tournament':
        base.push('chips', 'playerCount', 'blindSpeed', 'actionTimer');
        break;
    }
    base.push('llmPlayer');
    if (llmEnabled) base.push('llmOption');
    base.push('buttons');
    return base;
  };

  const configFields = getConfigFields();
  const maxField = configFields.length - 1;
  const currentFieldName = configFields[Math.min(configField, maxField)]!;

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (step === 'mode') {
      if (key.upArrow) {
        setModeIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModeIndex(prev => Math.min(MODE_OPTIONS.length - 1, prev + 1));
      } else if (key.return) {
        setStep('config');
        setConfigField(0);
      }
      return;
    }

    // Config step
    if (key.upArrow) {
      setConfigField(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setConfigField(prev => Math.min(maxField, prev + 1));
    } else if (key.leftArrow) {
      if (currentFieldName === 'chips') setChips(prev => Math.max(100, prev - 100));
      else if (currentFieldName === 'blind') setBlind(prev => Math.max(5, prev - 5));
      else if (currentFieldName === 'playerCount') setPlayerCount(prev => prev === 8 ? 6 : 6);
      else if (currentFieldName === 'blindSpeed') {
        setBlindSpeed(prev => prev === 'normal' ? 'turbo' : prev === 'deep' ? 'normal' : 'turbo');
      }
      else if (currentFieldName === 'actionTimer') setActionTimer(prev => prev === 30 ? 15 : prev === 60 ? 30 : 15);
      else if (currentFieldName === 'llmPlayer') setLlmEnabled(prev => !prev);
      else if (currentFieldName === 'llmOption') setLlmOptionIndex(prev => Math.max(0, prev - 1));
      else if (currentFieldName === 'buttons') setButtonIndex(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      if (currentFieldName === 'chips') setChips(prev => Math.min(10000, prev + 100));
      else if (currentFieldName === 'blind') setBlind(prev => Math.min(100, prev + 5));
      else if (currentFieldName === 'playerCount') setPlayerCount(prev => prev === 6 ? 8 : 8);
      else if (currentFieldName === 'blindSpeed') {
        setBlindSpeed(prev => prev === 'turbo' ? 'normal' : prev === 'normal' ? 'deep' : 'deep');
      }
      else if (currentFieldName === 'actionTimer') setActionTimer(prev => prev === 15 ? 30 : prev === 30 ? 60 : 60);
      else if (currentFieldName === 'llmPlayer') setLlmEnabled(prev => !prev);
      else if (currentFieldName === 'llmOption') setLlmOptionIndex(prev => Math.min(LLM_OPTIONS.length - 1, prev + 1));
      else if (currentFieldName === 'buttons') setButtonIndex(prev => Math.min(1, prev + 1));
    } else if (key.return) {
      if (currentFieldName === 'llmPlayer') {
        setLlmEnabled(prev => !prev);
      } else if (currentFieldName === 'buttons') {
        if (buttonIndex === 0) {
          // Start
          const config: GameConfig = {
            mode: selectedMode,
            playerCount: selectedMode === 'headsup' ? 2 : playerCount,
            startingChips: chips,
            smallBlind: selectedMode === 'tournament' ? getBlindSchedule(blindSpeed)[0]!.small : blind,
          };
          if (selectedMode === 'tournament') {
            config.blindSchedule = getBlindSchedule(blindSpeed);
            config.actionTimerSeconds = actionTimer;
          }
          if (llmEnabled) {
            config.llmPlayer = {
              enabled: true,
              provider: selectedLlm.provider,
              model: selectedLlm.model,
              displayName: selectedLlm.provider === 'external' ? 'External Agent' : selectedLlm.display.replace(' (API)', ''),
            };
          }
          onStart(config);
        } else {
          setStep('mode');
        }
      } else {
        setConfigField(prev => Math.min(maxField, prev + 1));
      }
    } else if (key.escape) {
      if (step === 'config') {
        setStep('mode');
      }
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color="red">{title}</Text>
      <Text bold>Texas Hold'em Poker</Text>
      <Box height={1} />

      {step === 'mode' && (
        <>
          <Text bold>Select Mode:</Text>
          <Box height={1} />
          <Box flexDirection="column" paddingX={2}>
            {MODE_OPTIONS.map((opt, i) => {
              const isSelected = i === modeIndex;
              return (
                <Box key={opt.mode}>
                  <Text>
                    {isSelected ? chalk.green.bold('> ') : '  '}
                    {isSelected ? chalk.green.bold(opt.label) : opt.label}
                    {isSelected ? chalk.dim(` - ${opt.desc}`) : ''}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Box height={1} />
          <Text dimColor>[Up/Down Select]  [Enter Confirm]  [Q Quit]</Text>
        </>
      )}

      {step === 'config' && (
        <>
          <Text bold>{MODE_OPTIONS[modeIndex]!.label} Settings:</Text>
          <Box height={1} />
          <Box flexDirection="column" paddingX={2}>
            {configFields.map((field, i) => {
              const isActive = configField === i;
              const prefix = isActive ? chalk.green.bold('> ') : '  ';
              const hint = isActive ? chalk.dim(' [Left/Right adjust]') : '';

              if (field === 'chips') {
                return (
                  <Text key={field}>
                    {prefix}Starting Chips: {chalk.yellow(`$${chips}`)}{hint}
                  </Text>
                );
              }
              if (field === 'blind') {
                return (
                  <Text key={field}>
                    {prefix}Small Blind: {chalk.yellow(`$${blind}`)}{hint}
                  </Text>
                );
              }
              if (field === 'playerCount') {
                return (
                  <Text key={field}>
                    {prefix}Players: {chalk.yellow(`${playerCount}`)}{hint}
                  </Text>
                );
              }
              if (field === 'blindSpeed') {
                const speedLabel = blindSpeed === 'turbo' ? 'Turbo (3min)' :
                                   blindSpeed === 'normal' ? 'Normal (5min)' : 'Deep (10min)';
                return (
                  <Text key={field}>
                    {prefix}Blind Speed: {chalk.yellow(speedLabel)}{hint}
                  </Text>
                );
              }
              if (field === 'actionTimer') {
                return (
                  <Text key={field}>
                    {prefix}Action Timer: {chalk.yellow(`${actionTimer}s`)}{hint}
                  </Text>
                );
              }
              if (field === 'llmPlayer') {
                const statusText = llmEnabled
                  ? chalk.green.bold('ON')
                  : chalk.dim('OFF');
                return (
                  <Text key={field}>
                    {prefix}LLM Player: {statusText}
                    {isActive ? chalk.dim(' [Enter/Left/Right toggle]') : ''}
                  </Text>
                );
              }
              if (field === 'llmOption') {
                const needsKey = selectedLlm.provider === 'api' && !hasApiKey;
                return (
                  <Box key={field} flexDirection="column">
                    <Text>
                      {prefix}Agent: {chalk.magenta(selectedLlm.display)}
                      {needsKey ? chalk.red(' (needs ANTHROPIC_API_KEY)') : ''}
                      {hint}
                    </Text>
                    {isActive && selectedLlm.provider === 'external' && (
                      <Text dimColor>
                        {'    Bridge dir: '}{getBridgeDir()}
                      </Text>
                    )}
                  </Box>
                );
              }
              if (field === 'buttons') {
                return (
                  <Box key={field} gap={4} marginTop={1}>
                    <Text
                      bold={isActive && buttonIndex === 0}
                      inverse={isActive && buttonIndex === 0}
                      color={isActive && buttonIndex === 0 ? 'green' : undefined}
                      dimColor={!isActive}
                    >
                      {' Start '}
                    </Text>
                    <Text
                      bold={isActive && buttonIndex === 1}
                      inverse={isActive && buttonIndex === 1}
                      color={isActive && buttonIndex === 1 ? 'red' : undefined}
                      dimColor={!isActive}
                    >
                      {' Back '}
                    </Text>
                  </Box>
                );
              }
              return null;
            })}
          </Box>
          <Box height={1} />
          <Text dimColor>[Up/Down Navigate]  [Left/Right Adjust]  [Enter Select]  [Esc Back]</Text>
        </>
      )}
    </Box>
  );
}
