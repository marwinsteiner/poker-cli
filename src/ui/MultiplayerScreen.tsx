import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { GameConfig, GameMode } from '../engine/types.js';
import { getBlindSchedule, type BlindSpeed } from '../engine/blind-schedule.js';
import { BLIND_PRESETS, STACK_PRESETS } from '../engine/constants.js';
import { formatChips } from '../engine/chip-format.js';
import { LANHost } from '../net/host.js';
import { LANClient } from '../net/client.js';
import { DiscoveryListener } from '../net/discovery.js';
import type { DiscoveredGame } from '../net/types.js';

interface MultiplayerScreenProps {
  playerName: string;
  onGameReady: (
    config: GameConfig,
    lanRole: 'host' | 'client',
    host?: LANHost,
    client?: LANClient,
    mySeat?: number,
  ) => void;
  onBack: () => void;
}

type SubScreen = 'menu' | 'host-config' | 'hosting' | 'lobby' | 'connecting' | 'waiting';

type HostGameMode = 'headsup' | 'cash' | 'tournament';

const HOST_MODE_OPTIONS: { mode: HostGameMode; label: string }[] = [
  { mode: 'headsup', label: 'Heads-Up (1v1)' },
  { mode: 'cash', label: 'Cash Game' },
  { mode: 'tournament', label: 'Tournament' },
];

export function MultiplayerScreen({ playerName, onGameReady, onBack }: MultiplayerScreenProps) {
  const { exit } = useApp();
  const [subScreen, setSubScreen] = useState<SubScreen>('menu');
  const [menuIndex, setMenuIndex] = useState(0);

  // Host config
  const [hostModeIndex, setHostModeIndex] = useState(0);
  const [blindPresetIndex, setBlindPresetIndex] = useState(0);
  const [stackPresetIndex, setStackPresetIndex] = useState(2); // default $20
  const [hostPlayerCount, setHostPlayerCount] = useState(6);
  const [hostBlindSpeed, setHostBlindSpeed] = useState<BlindSpeed>('normal');
  const [hostConfigField, setHostConfigField] = useState(0);
  const [hostButtonIndex, setHostButtonIndex] = useState(0);

  const hostChips = STACK_PRESETS[stackPresetIndex]!;
  const hostBlindPreset = BLIND_PRESETS[blindPresetIndex]!;

  // Host waiting room
  const [host, setHost] = useState<LANHost | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<{ seat: number; name: string }[]>([]);
  const [hostReady, setHostReady] = useState(false);

  // Client lobby
  const [listener, setListener] = useState<DiscoveryListener | null>(null);
  const [discoveredGames, setDiscoveredGames] = useState<DiscoveredGame[]>([]);
  const [lobbyIndex, setLobbyIndex] = useState(0);

  // Client waiting room
  const [client, setClient] = useState<LANClient | null>(null);
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [waitingPlayers, setWaitingPlayers] = useState<{ seatIndex: number; name: string }[]>([]);
  const [connectTarget, setConnectTarget] = useState('');

  const hostRef = useRef(host);
  hostRef.current = host;
  const clientRef = useRef(client);
  clientRef.current = client;
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hostRef.current?.stop();
      clientRef.current?.disconnect();
      listenerRef.current?.stop();
    };
  }, []);

  // Host config fields
  const selectedHostMode = HOST_MODE_OPTIONS[hostModeIndex]!.mode;
  const getHostConfigFields = (): string[] => {
    const fields: string[] = ['mode'];
    if (selectedHostMode !== 'headsup') fields.push('playerCount');
    fields.push('chips', 'blind');
    if (selectedHostMode === 'tournament') fields.push('blindSpeed');
    fields.push('buttons');
    return fields;
  };
  const hostConfigFields = getHostConfigFields();
  const hostMaxField = hostConfigFields.length - 1;
  const currentHostField = hostConfigFields[Math.min(hostConfigField, hostMaxField)]!;

  // Start hosting
  const startHosting = useCallback(() => {
    const mode = selectedHostMode;
    const pc = mode === 'headsup' ? 2 : hostPlayerCount;

    const lanHost = new LANHost({
      hostName: playerName,
      mode,
      playerCount: pc,
    });

    lanHost.on('player-joined', (seat: number, name: string) => {
      setConnectedPlayers(prev => [...prev, { seat, name }]);
    });

    lanHost.on('player-disconnected', (seat: number) => {
      setConnectedPlayers(prev => prev.filter(p => p.seat !== seat));
    });

    lanHost.on('ready', () => {
      setHostReady(true);
    });

    lanHost.start();
    setHost(lanHost);
    setConnectedPlayers([]);
    setHostReady(false);
    setSubScreen('hosting');
  }, [playerName, selectedHostMode, hostPlayerCount, blindPresetIndex, stackPresetIndex]);

  // Auto-start when ready
  useEffect(() => {
    if (hostReady && host) {
      const timer = setTimeout(() => {
        const mode = selectedHostMode;
        const pc = mode === 'headsup' ? 2 : hostPlayerCount;
        const sb = mode === 'tournament' ? getBlindSchedule(hostBlindSpeed)[0]!.small : hostBlindPreset.small;

        const config: GameConfig = {
          mode: 'lan',
          playerCount: pc,
          startingChips: hostChips,
          smallBlind: sb,
          bigBlind: mode === 'tournament' ? undefined : hostBlindPreset.big,
          lanRole: 'host',
          lanPlayerName: playerName,
          lanMode: mode,
        };

        if (mode === 'tournament') {
          config.blindSchedule = getBlindSchedule(hostBlindSpeed);
          config.actionTimerSeconds = 30;
        }

        host.setGameStarted();
        host.sendGameStarted();
        onGameReady(config, 'host', host, undefined, 0);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hostReady, host, selectedHostMode, hostPlayerCount, hostChips, hostBlindPreset, hostBlindSpeed, playerName, onGameReady]);

  // Start discovery listener for lobby
  const startLobby = useCallback(() => {
    const disc = new DiscoveryListener();
    disc.on('change', (games: DiscoveredGame[]) => {
      setDiscoveredGames(games);
    });
    disc.start();
    setListener(disc);
    setSubScreen('lobby');
  }, []);

  // Connect to a discovered game
  const connectToGame = useCallback((game: DiscoveredGame) => {
    const cl = new LANClient();
    setConnectTarget(`${game.hostName}'s game`);
    setSubScreen('connecting');

    cl.on('seat-assigned', (seat: number, gameConfig: any) => {
      setMySeat(seat);
      setSubScreen('waiting');
    });

    cl.on('player-joined', (_seat: number, _name: string, players: { seatIndex: number; name: string }[]) => {
      setWaitingPlayers(players);
    });

    cl.on('game-started', (_players: { seatIndex: number; name: string }[]) => {
      // Stop the discovery listener since we're now in-game
      listenerRef.current?.stop();
      setListener(null);

      const config: GameConfig = {
        mode: 'lan',
        playerCount: game.playerCount,
        startingChips: 0,
        smallBlind: 0,
        lanRole: 'client',
        lanPlayerName: playerName,
        lanMode: game.mode as 'headsup' | 'cash' | 'tournament',
      };

      onGameReady(config, 'client', undefined, cl, cl.getSeatIndex()!);
    });

    cl.on('disconnected', () => {
      setSubScreen('lobby');
      setClient(null);
    });

    cl.on('error', () => {
      setSubScreen('lobby');
      setClient(null);
    });

    cl.connect(game.address, game.port, playerName);
    setClient(cl);
  }, [playerName, onGameReady]);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    switch (subScreen) {
      case 'menu': {
        if (key.upArrow) setMenuIndex(prev => Math.max(0, prev - 1));
        else if (key.downArrow) setMenuIndex(prev => Math.min(1, prev + 1));
        else if (key.return) {
          if (menuIndex === 0) {
            setSubScreen('host-config');
            setHostConfigField(0);
          } else {
            startLobby();
          }
        }
        else if (key.escape) onBack();
        break;
      }

      case 'host-config': {
        if (key.upArrow) setHostConfigField(prev => Math.max(0, prev - 1));
        else if (key.downArrow) setHostConfigField(prev => Math.min(hostMaxField, prev + 1));
        else if (key.leftArrow) {
          if (currentHostField === 'mode') setHostModeIndex(prev => Math.max(0, prev - 1));
          else if (currentHostField === 'playerCount') setHostPlayerCount(prev => prev === 8 ? 6 : 6);
          else if (currentHostField === 'chips') setStackPresetIndex(prev => Math.max(0, prev - 1));
          else if (currentHostField === 'blind') setBlindPresetIndex(prev => Math.max(0, prev - 1));
          else if (currentHostField === 'blindSpeed') setHostBlindSpeed(prev => prev === 'normal' ? 'turbo' : prev === 'deep' ? 'normal' : 'turbo');
          else if (currentHostField === 'buttons') setHostButtonIndex(prev => Math.max(0, prev - 1));
        }
        else if (key.rightArrow) {
          if (currentHostField === 'mode') setHostModeIndex(prev => Math.min(HOST_MODE_OPTIONS.length - 1, prev + 1));
          else if (currentHostField === 'playerCount') setHostPlayerCount(prev => prev === 6 ? 8 : 8);
          else if (currentHostField === 'chips') setStackPresetIndex(prev => Math.min(STACK_PRESETS.length - 1, prev + 1));
          else if (currentHostField === 'blind') setBlindPresetIndex(prev => Math.min(BLIND_PRESETS.length - 1, prev + 1));
          else if (currentHostField === 'blindSpeed') setHostBlindSpeed(prev => prev === 'turbo' ? 'normal' : prev === 'normal' ? 'deep' : 'deep');
          else if (currentHostField === 'buttons') setHostButtonIndex(prev => Math.min(1, prev + 1));
        }
        else if (key.return) {
          if (currentHostField === 'buttons') {
            if (hostButtonIndex === 0) startHosting();
            else setSubScreen('menu');
          } else {
            setHostConfigField(prev => Math.min(hostMaxField, prev + 1));
          }
        }
        else if (key.escape) setSubScreen('menu');
        break;
      }

      case 'hosting': {
        if (key.escape) {
          host?.stop();
          setHost(null);
          setSubScreen('host-config');
        }
        break;
      }

      case 'lobby': {
        if (key.upArrow) setLobbyIndex(prev => Math.max(0, prev - 1));
        else if (key.downArrow) setLobbyIndex(prev => Math.min(Math.max(0, discoveredGames.length - 1), prev + 1));
        else if (key.return) {
          const game = discoveredGames[lobbyIndex];
          if (game) connectToGame(game);
        }
        else if (key.escape) {
          listener?.stop();
          setListener(null);
          setSubScreen('menu');
        }
        break;
      }

      case 'connecting': {
        if (key.escape) {
          client?.disconnect();
          setClient(null);
          setSubScreen('lobby');
        }
        break;
      }

      case 'waiting': {
        if (key.escape) {
          client?.disconnect();
          setClient(null);
          setSubScreen('lobby');
        }
        break;
      }
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text bold color="cyan">Multiplayer (LAN)</Text>
      <Text dimColor>Playing as: {chalk.yellow(playerName)}</Text>
      <Box height={1} />

      {/* Menu: Host / Join */}
      {subScreen === 'menu' && (
        <>
          <Box flexDirection="column" paddingX={2}>
            {['Host Game', 'Join Game'].map((label, i) => (
              <Text key={label}>
                {i === menuIndex ? chalk.green.bold('> ') : '  '}
                {i === menuIndex ? chalk.green.bold(label) : label}
              </Text>
            ))}
          </Box>
          <Box height={1} />
          <Text dimColor>[Up/Down Select]  [Enter Confirm]  [Esc Back]</Text>
        </>
      )}

      {/* Host Config */}
      {subScreen === 'host-config' && (
        <>
          <Text bold>Host Game Settings:</Text>
          <Box height={1} />
          <Box flexDirection="column" paddingX={2}>
            {hostConfigFields.map((field, i) => {
              const isActive = hostConfigField === i;
              const prefix = isActive ? chalk.green.bold('> ') : '  ';
              const hint = isActive ? chalk.dim(' [Left/Right adjust]') : '';

              if (field === 'mode') {
                return (
                  <Text key={field}>
                    {prefix}Game Mode: {chalk.yellow(HOST_MODE_OPTIONS[hostModeIndex]!.label)}{hint}
                  </Text>
                );
              }
              if (field === 'playerCount') {
                return (
                  <Text key={field}>
                    {prefix}Players: {chalk.yellow(`${hostPlayerCount}`)}{hint}
                  </Text>
                );
              }
              if (field === 'chips') {
                return (
                  <Text key={field}>
                    {prefix}Starting Chips: {chalk.yellow(formatChips(hostChips))}{hint}
                  </Text>
                );
              }
              if (field === 'blind') {
                return (
                  <Text key={field}>
                    {prefix}Blinds: {chalk.yellow(`${formatChips(hostBlindPreset.small)}/${formatChips(hostBlindPreset.big)}`)}{hint}
                  </Text>
                );
              }
              if (field === 'blindSpeed') {
                const speedLabel = hostBlindSpeed === 'turbo' ? 'Turbo (3min)' :
                                   hostBlindSpeed === 'normal' ? 'Normal (5min)' : 'Deep (10min)';
                return (
                  <Text key={field}>
                    {prefix}Blind Speed: {chalk.yellow(speedLabel)}{hint}
                  </Text>
                );
              }
              if (field === 'buttons') {
                return (
                  <Box key={field} gap={4} marginTop={1}>
                    <Text
                      bold={isActive && hostButtonIndex === 0}
                      inverse={isActive && hostButtonIndex === 0}
                      color={isActive && hostButtonIndex === 0 ? 'green' : undefined}
                      dimColor={!isActive}
                    >
                      {' Host '}
                    </Text>
                    <Text
                      bold={isActive && hostButtonIndex === 1}
                      inverse={isActive && hostButtonIndex === 1}
                      color={isActive && hostButtonIndex === 1 ? 'red' : undefined}
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

      {/* Hosting - Waiting Room */}
      {subScreen === 'hosting' && (
        <>
          <Text bold color="green">Hosting: {HOST_MODE_OPTIONS[hostModeIndex]!.label}</Text>
          <Text dimColor>Port: {host?.getPort() ?? '...'}</Text>
          <Box height={1} />
          <Box flexDirection="column" paddingX={2}>
            <Text>Seat 0: {chalk.yellow(playerName)} (Host)</Text>
            {connectedPlayers.map(p => (
              <Text key={p.seat}>Seat {p.seat}: {chalk.cyan(p.name)}</Text>
            ))}
          </Box>
          <Box height={1} />
          {hostReady ? (
            <Text bold color="green">All players ready - starting game...</Text>
          ) : (
            <Text dimColor>
              Waiting for players ({connectedPlayers.length + 1}/
              {selectedHostMode === 'headsup' ? 2 : hostPlayerCount})...
            </Text>
          )}
          <Box height={1} />
          <Text dimColor>[Esc Cancel]</Text>
        </>
      )}

      {/* Lobby - Discover Games */}
      {subScreen === 'lobby' && (
        <>
          <Text bold>Available Games:</Text>
          <Box height={1} />
          {discoveredGames.length === 0 ? (
            <Text dimColor>Searching for games on your network...</Text>
          ) : (
            <Box flexDirection="column" paddingX={2}>
              {discoveredGames.map((game, i) => {
                const isSelected = i === lobbyIndex;
                const modeLabel = game.mode === 'headsup' ? 'Heads-Up' :
                                  game.mode === 'cash' ? 'Cash' : 'Tournament';
                return (
                  <Text key={game.hostId}>
                    {isSelected ? chalk.green.bold('> ') : '  '}
                    {isSelected
                      ? chalk.green.bold(`${game.hostName}'s game`)
                      : `${game.hostName}'s game`}
                    {` - ${modeLabel} ${game.playerCount}-handed (${game.connectedCount + 1}/${game.playerCount})`}
                  </Text>
                );
              })}
            </Box>
          )}
          <Box height={1} />
          <Text dimColor>[Up/Down Select]  [Enter Join]  [Esc Back]</Text>
        </>
      )}

      {/* Connecting */}
      {subScreen === 'connecting' && (
        <>
          <Text>Connecting to {connectTarget}...</Text>
          <Box height={1} />
          <Text dimColor>[Esc Cancel]</Text>
        </>
      )}

      {/* Waiting Room (Client) */}
      {subScreen === 'waiting' && (
        <>
          <Text bold color="green">Connected! Seat #{mySeat}</Text>
          <Box height={1} />
          <Box flexDirection="column" paddingX={2}>
            {waitingPlayers.map(p => (
              <Text key={p.seatIndex}>
                Seat {p.seatIndex}: {chalk.cyan(p.name)}
                {p.seatIndex === mySeat ? chalk.yellow(' (You)') : ''}
              </Text>
            ))}
          </Box>
          <Box height={1} />
          <Text dimColor>Waiting for more players...</Text>
          <Box height={1} />
          <Text dimColor>[Esc Leave]</Text>
        </>
      )}
    </Box>
  );
}
