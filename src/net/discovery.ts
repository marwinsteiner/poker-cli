import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import type { GameMode } from '../engine/types.js';
import type { DiscoveredGame, DiscoveryPayload } from './types.js';

const DISCOVERY_PORT = 41234;
const BROADCAST_INTERVAL = 2000;
const STALE_TIMEOUT = 6000;

// ── Host: broadcasts game availability ──────────────────────────────

export class DiscoveryBroadcaster {
  private socket: dgram.Socket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hostId: string;
  private hostName: string;
  private port: number;
  private mode: GameMode;
  private playerCount: number;
  private connectedCount = 0;
  private acceptingPlayers = true;

  constructor(opts: {
    hostName: string;
    port: number;
    mode: GameMode;
    playerCount: number;
  }) {
    this.hostId = crypto.randomUUID();
    this.hostName = opts.hostName;
    this.port = opts.port;
    this.mode = opts.mode;
    this.playerCount = opts.playerCount;
  }

  start(): void {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.bind(() => {
      this.socket!.setBroadcast(true);
      this.broadcast();
      this.timer = setInterval(() => this.broadcast(), BROADCAST_INTERVAL);
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Send GAME_ENDED before closing
    if (this.socket) {
      const payload: DiscoveryPayload = {
        type: 'GAME_ENDED',
        hostName: this.hostName,
        hostId: this.hostId,
        port: this.port,
        mode: this.mode,
        playerCount: this.playerCount,
        connectedCount: this.connectedCount,
        acceptingPlayers: false,
      };
      const buf = Buffer.from(JSON.stringify(payload));
      try {
        this.socket.send(buf, 0, buf.length, DISCOVERY_PORT, '255.255.255.255');
      } catch {}
      this.socket.close();
      this.socket = null;
    }
  }

  updateInfo(connectedCount: number, acceptingPlayers: boolean): void {
    this.connectedCount = connectedCount;
    this.acceptingPlayers = acceptingPlayers;
  }

  getHostId(): string {
    return this.hostId;
  }

  private broadcast(): void {
    if (!this.socket) return;
    const payload: DiscoveryPayload = {
      type: 'GAME_AVAILABLE',
      hostName: this.hostName,
      hostId: this.hostId,
      port: this.port,
      mode: this.mode,
      playerCount: this.playerCount,
      connectedCount: this.connectedCount,
      acceptingPlayers: this.acceptingPlayers,
    };
    const buf = Buffer.from(JSON.stringify(payload));
    try {
      this.socket.send(buf, 0, buf.length, DISCOVERY_PORT, '255.255.255.255');
    } catch {}
  }
}

// ── Client: listens for game broadcasts ─────────────────────────────

export class DiscoveryListener extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private games = new Map<string, DiscoveredGame>();
  private staleTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const payload = JSON.parse(msg.toString()) as DiscoveryPayload;
        if (payload.type === 'GAME_ENDED') {
          if (this.games.has(payload.hostId)) {
            this.games.delete(payload.hostId);
            this.emit('change', this.getGames());
          }
          return;
        }

        if (payload.type === 'GAME_AVAILABLE') {
          const game: DiscoveredGame = {
            hostName: payload.hostName,
            hostId: payload.hostId,
            address: rinfo.address,
            port: payload.port,
            mode: payload.mode,
            playerCount: payload.playerCount,
            connectedCount: payload.connectedCount,
            acceptingPlayers: payload.acceptingPlayers,
            lastSeen: Date.now(),
          };
          this.games.set(payload.hostId, game);
          this.emit('change', this.getGames());
        }
      } catch {}
    });

    this.socket.bind(DISCOVERY_PORT, () => {
      // Enable receiving broadcasts
      this.socket!.setBroadcast(true);
    });

    // Prune stale entries
    this.staleTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, game] of this.games) {
        if (now - game.lastSeen > STALE_TIMEOUT) {
          this.games.delete(id);
          changed = true;
        }
      }
      if (changed) this.emit('change', this.getGames());
    }, STALE_TIMEOUT);
  }

  stop(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.games.clear();
  }

  getGames(): DiscoveredGame[] {
    return Array.from(this.games.values()).filter(g => g.acceptingPlayers);
  }
}
