import {
  ArenaId,
  CharacterId,
  OnlineEngineSnapshot,
  OnlineMatchFormat,
  OnlinePlayerInput,
  OnlineRoomInfo,
  UserAccountProfile,
} from '../types/game';

export interface WsRoomInviteAlert {
  roomCode: string;
  roomName: string;
  matchFormat?: OnlineMatchFormat;
  visibility?: 'public' | 'private';
  fromUsername: string;
  fromPlayerCode: string;
}

export interface WsMatchOverPayload {
  roomCode: string;
  matchFormat?: OnlineMatchFormat;
  winnerSide: 'p1' | 'p2';
  winnerPlayerId: string;
  p1Id: string;
  p2Id: string;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  p1Wins: number;
  p2Wins: number;
  infinityZone?: number;
  infinityDefeated?: number;
  p1ZoneCoins?: number;
  p2ZoneCoins?: number;
  reason?: string;
}

export type WsEventListener = (event: Record<string, unknown>) => void;

class MultiplayerSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsEventListener>();
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;
  private currentUser: UserAccountProfile | null = null;
  private currentChar: CharacterId = 'oggy';

  public connected = false;
  public onlineCount = 0;
  public queueCount = 0;

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private unloadBound = false;

  private ensureUnloadCleanup(): void {
    if (this.unloadBound || typeof window === 'undefined') return;
    this.unloadBound = true;
    window.addEventListener('beforeunload', () => {
      this.manuallyClosed = true;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'leave_room' }));
        } catch {
          // ignore
        }
      }
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        try {
          this.ws.close(1000, 'page_unload');
        } catch {
          // ignore
        }
      }
    });
  }

  public connect(user: UserAccountProfile, defaultChar: CharacterId = 'oggy'): void {
    this.ensureUnloadCleanup();
    const prevUserId = this.currentUser?.id;
    this.currentUser = user;
    this.currentChar = defaultChar;
    this.manuallyClosed = false;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (prevUserId !== user.id) {
        this.sendHello();
      }
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const sock = new WebSocket(this.getWsUrl());
      this.ws = sock;

      sock.onopen = () => {
        if (this.ws !== sock) return;
        this.connected = true;
        this.sendHello();
        this.emit({ type: 'ws_connection', connected: true });
      };

      sock.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as Record<string, unknown>;
          if (typeof data.onlineCount === 'number') this.onlineCount = data.onlineCount;
          if (typeof data.queueCount === 'number') this.queueCount = data.queueCount;
          if (data.type === 'duplicate_online_session' || data.type === 'account_banned') {
            this.manuallyClosed = true;
            this.connected = false;
            if (this.reconnectTimer !== null) {
              window.clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }
          }
          this.emit(data);
        } catch {
          // ignore malformed messages
        }
      };

      sock.onclose = () => {
        if (this.ws === sock) {
          this.ws = null;
        }
        this.connected = false;
        this.emit({ type: 'ws_connection', connected: false });
        if (!this.manuallyClosed && this.currentUser) {
          if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = window.setTimeout(() => {
            if (this.currentUser && !this.manuallyClosed) {
              this.connect(this.currentUser, this.currentChar);
            }
          }, 1800);
        }
      };

      sock.onerror = () => {
        // handled via onclose
      };
    } catch {
      this.connected = false;
    }
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    this.currentUser = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'client_disconnect');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
  }

  private sendHello(): void {
    if (!this.currentUser) return;
    this.send({
      type: 'hello',
      playerId: this.currentUser.id,
      playerCode: this.currentUser.playerId || `FXP-${this.currentUser.id.slice(0, 6).toUpperCase()}`,
      username: this.currentUser.username,
      avatarUrl: this.currentUser.avatarUrl,
      characterId: this.currentChar,
    });
  }

  public send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  public listRooms(): void {
    this.send({ type: 'list_rooms' });
  }

  public joinQuickMatch(characterId: CharacterId, arenaId: ArenaId, matchFormat: OnlineMatchFormat = 'play'): void {
    this.currentChar = characterId;
    this.send({ type: 'quick_match_join', characterId, arenaId, matchFormat });
  }

  public cancelQuickMatch(): void {
    this.send({ type: 'quick_match_cancel' });
  }

  public createRoom(params: {
    name: string;
    visibility: 'public' | 'private';
    arenaId: ArenaId;
    characterId: CharacterId;
    matchFormat?: OnlineMatchFormat;
    roundsToWin?: number;
    roundTimerSec?: number;
    invitePlayerId?: string;
  }): void {
    this.currentChar = params.characterId;
    this.send({ type: 'create_room', matchFormat: params.matchFormat || 'play', ...params });
  }

  public joinRoom(code: string, characterId: CharacterId): void {
    this.currentChar = characterId;
    this.send({ type: 'join_room', code: code.trim().toUpperCase(), characterId });
  }

  public leaveRoom(): void {
    this.send({ type: 'leave_room' });
  }

  public updateRoom(patch: {
    characterId?: CharacterId;
    arenaId?: ArenaId;
    matchFormat?: OnlineMatchFormat;
    roundsToWin?: number;
    roundTimerSec?: number;
    ready?: boolean;
  }): void {
    if (patch.characterId) this.currentChar = patch.characterId;
    this.send({ type: 'room_update', ...patch });
  }

  public startMatch(): void {
    this.send({ type: 'start_match' });
  }

  public sendInvite(targetPlayerId: string, roomCode: string): void {
    this.send({ type: 'send_invite', targetPlayerId, roomCode });
  }

  public sendCombatInput(input: OnlinePlayerInput): void {
    this.send({ type: 'player_input', input });
  }

  public ownerListWorlds(): void {
    this.send({ type: 'owner_list_worlds' });
  }

  public ownerSpectateWorld(roomCode: string): void {
    this.send({ type: 'owner_spectate_world', roomCode: roomCode.trim().toUpperCase() });
  }

  public ownerLeaveSpectate(): void {
    this.send({ type: 'owner_leave_spectate' });
  }

  public ownerKillFighter(
    roomCode: string,
    targetType: 'p1' | 'p2' | 'ally' | 'enemy',
    targetIndex = 0
  ): void {
    this.send({
      type: 'owner_kill_fighter',
      roomCode: roomCode.trim().toUpperCase(),
      targetType,
      targetIndex,
    });
  }

  public ownerHealAll(roomCode: string): void {
    this.send({ type: 'owner_heal_all', roomCode: roomCode.trim().toUpperCase() });
  }

  public ownerCloseWorld(roomCode: string): void {
    this.send({ type: 'owner_close_world', roomCode: roomCode.trim().toUpperCase() });
  }

  public subscribe(listener: WsEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: Record<string, unknown>): void {
    for (const fn of this.listeners) {
      fn(event);
    }
  }
}

export const multiplayerClient = new MultiplayerSocketClient();

export interface ActiveOnlineMatchContext {
  room: OnlineRoomInfo;
  localSide: 'p1' | 'p2';
  initialSnapshot: OnlineEngineSnapshot;
}
