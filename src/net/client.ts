import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { PlayerAction } from '../engine/types.js';
import type { HostMessage, ClientMessage } from './types.js';

export class LANClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private seatIndex: number | null = null;
  private connected = false;

  connect(address: string, port: number, playerName: string): void {
    const url = `ws://${address}:${port}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.send({ type: 'JOIN', playerName });
    });

    this.ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as HostMessage;
        this.handleMessage(msg);
      } catch {}
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  disconnect(): void {
    if (this.ws) {
      if (this.connected) {
        this.send({ type: 'LEAVE' });
      }
      try { this.ws.close(); } catch {}
      this.ws = null;
      this.connected = false;
    }
  }

  sendAction(action: PlayerAction): void {
    this.send({ type: 'PLAYER_ACTION', action });
  }

  getSeatIndex(): number | null {
    return this.seatIndex;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(msg: HostMessage): void {
    switch (msg.type) {
      case 'SEAT_ASSIGNED':
        this.seatIndex = msg.seatIndex;
        this.emit('seat-assigned', msg.seatIndex, msg.gameConfig);
        break;

      case 'PLAYER_JOINED':
        this.emit('player-joined', msg.seatIndex, msg.playerName, msg.connectedPlayers);
        break;

      case 'PLAYER_LEFT':
        this.emit('player-left', msg.seatIndex);
        break;

      case 'GAME_STARTED':
        this.emit('game-started', msg.players);
        break;

      case 'STATE_UPDATE':
        this.emit('state-update', msg.state);
        break;

      case 'YOUR_TURN':
        this.emit('your-turn', msg.availableActions);
        break;

      case 'GAME_OVER':
        this.emit('game-over', msg.reason, msg.finalChips);
        break;
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
