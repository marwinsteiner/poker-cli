import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import type { GameState, PlayerAction, GameMode } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { filterStateForClient } from './state-filter.js';
import { DiscoveryBroadcaster } from './discovery.js';
import type {
  ClientMessage,
  HostMessage,
  JoinMessage,
} from './types.js';

const DEFAULT_WS_PORT = 41235;

export interface LANHostOptions {
  hostName: string;
  mode: GameMode;
  playerCount: number;
  port?: number;
}

export class LANHost extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private broadcaster: DiscoveryBroadcaster | null = null;
  private clients = new Map<number, WebSocket>();
  private playerNames = new Map<number, string>();
  private nextSeat = 1;
  private port: number;
  private hostName: string;
  private mode: GameMode;
  private playerCount: number;
  private pendingActionResolve: ((action: PlayerAction) => void) | null = null;
  private pendingActionSeat: number | null = null;
  private gameStarted = false;

  constructor(opts: LANHostOptions) {
    super();
    this.hostName = opts.hostName;
    this.mode = opts.mode;
    this.playerCount = opts.playerCount;
    this.port = opts.port ?? DEFAULT_WS_PORT;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.wss.on('error', (err) => {
      this.emit('error', err);
    });

    this.broadcaster = new DiscoveryBroadcaster({
      hostName: this.hostName,
      port: this.port,
      mode: this.mode,
      playerCount: this.playerCount,
    });
    this.broadcaster.start();
    this.updateBroadcaster();
  }

  stop(): void {
    this.broadcaster?.stop();
    this.broadcaster = null;

    for (const ws of this.clients.values()) {
      try { ws.close(); } catch {}
    }
    this.clients.clear();
    this.playerNames.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.pendingActionResolve) {
      this.pendingActionResolve({ type: 'fold' });
      this.pendingActionResolve = null;
      this.pendingActionSeat = null;
    }
  }

  getPort(): number {
    return this.port;
  }

  getConnectedCount(): number {
    return this.clients.size;
  }

  getPlayerNames(): Map<number, string> {
    return new Map(this.playerNames);
  }

  getRemoteSeats(): Set<number> {
    return new Set(this.clients.keys());
  }

  hasOpenSeats(): boolean {
    return this.nextSeat < this.playerCount;
  }

  setGameStarted(): void {
    this.gameStarted = true;
  }

  /**
   * Send filtered state to each connected client.
   */
  sendStateUpdate(state: GameState): void {
    for (const [seatIndex, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        const filtered = filterStateForClient(state, seatIndex);
        this.send(ws, { type: 'STATE_UPDATE', state: filtered });
      }
    }
  }

  /**
   * Request an action from a remote player.
   * Sends YOUR_TURN, waits for PLAYER_ACTION response.
   * Resolves with fold on disconnect.
   */
  requestAction(state: GameState, seatIndex: number): Promise<PlayerAction> {
    return new Promise<PlayerAction>((resolve) => {
      const ws = this.clients.get(seatIndex);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        resolve({ type: 'fold' });
        return;
      }

      this.pendingActionResolve = resolve;
      this.pendingActionSeat = seatIndex;

      const availableActions = getAvailableActions(state);
      this.send(ws, { type: 'YOUR_TURN', availableActions });
    });
  }

  /**
   * Notify all clients the game has started.
   */
  sendGameStarted(): void {
    const players = [
      { seatIndex: 0, name: this.hostName },
      ...Array.from(this.playerNames.entries()).map(([seat, name]) => ({
        seatIndex: seat,
        name,
      })),
    ];
    this.broadcast({ type: 'GAME_STARTED', players });
  }

  /**
   * Notify all clients the game is over.
   */
  sendGameOver(reason: string, finalChips: { seatIndex: number; name: string; chips: number }[]): void {
    this.broadcast({ type: 'GAME_OVER', reason, finalChips });
  }

  /**
   * Reassign a seat from AI to a new remote player mid-game (cash game late join).
   * Returns the seat index assigned, or -1 if no seats available.
   */
  assignToAISeat(ws: WebSocket, playerName: string, aiSeats: number[]): number {
    if (aiSeats.length === 0) return -1;
    const seat = aiSeats[0]!;
    this.clients.set(seat, ws);
    this.playerNames.set(seat, playerName);
    this.updateBroadcaster();
    return seat;
  }

  // ── Private ──────────────────────────────────────────────────────

  private handleConnection(ws: WebSocket): void {
    // Wait for JOIN message
    const onMessage = (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;

        if (msg.type === 'JOIN') {
          ws.removeListener('message', onMessage);
          this.handleJoin(ws, msg);
        }
      } catch {}
    };

    ws.on('message', onMessage);

    ws.on('error', () => {
      ws.removeAllListeners();
    });

    // Timeout if no JOIN received within 5s
    setTimeout(() => {
      if (!this.getSocketSeat(ws)) {
        ws.removeListener('message', onMessage);
        try { ws.close(); } catch {}
      }
    }, 5000);
  }

  private handleJoin(ws: WebSocket, msg: JoinMessage): void {
    // Check if game is accepting players
    if (!this.hasOpenSeats() && !this.gameStarted) {
      try { ws.close(); } catch {}
      return;
    }

    let seatIndex: number;

    if (!this.gameStarted) {
      // Pre-game: assign next sequential seat
      seatIndex = this.nextSeat++;
    } else {
      // Mid-game (cash late join): will be handled via event
      // Emit event and let the host table assign the seat
      this.emit('late-join-request', ws, msg.playerName);
      return;
    }

    this.clients.set(seatIndex, ws);
    this.playerNames.set(seatIndex, msg.playerName);

    // Send seat assignment
    this.send(ws, {
      type: 'SEAT_ASSIGNED',
      seatIndex,
      gameConfig: {
        mode: this.mode,
        playerCount: this.playerCount,
        startingChips: 0, // Will be set properly on game start
        smallBlind: 0,
      },
    });

    // Broadcast to all other clients
    const connectedPlayers = [
      { seatIndex: 0, name: this.hostName },
      ...Array.from(this.playerNames.entries()).map(([seat, name]) => ({
        seatIndex: seat,
        name,
      })),
    ];

    this.broadcastExcept(seatIndex, {
      type: 'PLAYER_JOINED',
      seatIndex,
      playerName: msg.playerName,
      connectedPlayers,
    });

    // Also tell the joiner about all connected players
    this.send(ws, {
      type: 'PLAYER_JOINED',
      seatIndex,
      playerName: msg.playerName,
      connectedPlayers,
    });

    this.setupClientHandlers(ws, seatIndex);
    this.updateBroadcaster();

    this.emit('player-joined', seatIndex, msg.playerName);

    // Check ready condition
    this.checkReady();
  }

  private setupClientHandlers(ws: WebSocket, seatIndex: number): void {
    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;

        if (msg.type === 'PLAYER_ACTION') {
          if (
            this.pendingActionResolve &&
            this.pendingActionSeat === seatIndex
          ) {
            const resolve = this.pendingActionResolve;
            this.pendingActionResolve = null;
            this.pendingActionSeat = null;
            resolve(msg.action);
          }
        } else if (msg.type === 'LEAVE') {
          this.handleDisconnect(seatIndex);
          try { ws.close(); } catch {}
        }
      } catch {}
    });

    ws.on('close', () => {
      this.handleDisconnect(seatIndex);
    });

    ws.on('error', () => {
      this.handleDisconnect(seatIndex);
    });
  }

  private handleDisconnect(seatIndex: number): void {
    if (!this.clients.has(seatIndex)) return;

    this.clients.delete(seatIndex);
    this.playerNames.delete(seatIndex);
    this.updateBroadcaster();

    // If this player had a pending action, resolve with fold
    if (this.pendingActionSeat === seatIndex && this.pendingActionResolve) {
      const resolve = this.pendingActionResolve;
      this.pendingActionResolve = null;
      this.pendingActionSeat = null;
      resolve({ type: 'fold' });
    }

    this.broadcast({ type: 'PLAYER_LEFT', seatIndex });
    this.emit('player-disconnected', seatIndex);
  }

  private checkReady(): void {
    const connected = this.clients.size;
    const needed = this.getNeededPlayers();

    if (connected >= needed) {
      this.emit('ready');
    }
  }

  private getNeededPlayers(): number {
    switch (this.mode) {
      case 'headsup':
        return 1; // 1 client + host
      case 'cash':
        return 1; // Start with at least 1 client, rest are AI
      case 'tournament':
        return this.playerCount - 1; // All seats must be humans
      default:
        return 1;
    }
  }

  private send(ws: WebSocket, msg: HostMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: HostMessage): void {
    for (const ws of this.clients.values()) {
      this.send(ws, msg);
    }
  }

  private broadcastExcept(excludeSeat: number, msg: HostMessage): void {
    for (const [seat, ws] of this.clients) {
      if (seat !== excludeSeat) {
        this.send(ws, msg);
      }
    }
  }

  private updateBroadcaster(): void {
    this.broadcaster?.updateInfo(
      this.clients.size,
      this.hasOpenSeats() || (this.gameStarted && this.mode === 'cash'),
    );
  }

  private getSocketSeat(ws: WebSocket): number | undefined {
    for (const [seat, clientWs] of this.clients) {
      if (clientWs === ws) return seat;
    }
    return undefined;
  }
}
