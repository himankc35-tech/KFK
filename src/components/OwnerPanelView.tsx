import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Eye,
  HeartPulse,
  RefreshCw,
  Search,
  ShieldAlert,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import {
  ArenaId,
  FighterState,
  GameSettings,
  OnlineEngineSnapshot,
  OnlineRoomInfo,
  OwnerPlayerRecord,
  OwnerWorldSummary,
  UserAccountProfile,
} from '../types/game';
import { ARENAS } from '../data/arenas';
import { CHARACTERS, CHARACTER_LIST } from '../data/characters';
import { soundManager } from '../audio/soundManager';
import { GameEngine } from '../game/gameEngine';
import { getStageArenaImage, renderGameStage } from '../game/stageRenderer';
import { multiplayerClient } from '../services/multiplayerClient';
import {
  closeOwnerWorld,
  fetchOwnerOverview,
  setOwnerPlayerBan,
  setOwnerPlayerWallet,
  unlockAllOwnerPlayerCharacters,
} from '../services/ownerClient';

interface OwnerPanelViewProps {
  user: UserAccountProfile;
  onUserUpdated: (updated: UserAccountProfile) => void;
  onBackLobby: () => void;
}

interface TargetableUnit {
  key: string;
  label: string;
  team: 'ally' | 'enemy';
  targetType: 'p1' | 'p2' | 'ally' | 'enemy';
  targetIndex: number;
  fighter: FighterState;
}

const SPECTATE_DEFAULT_SETTINGS: GameSettings = {
  soundVolume: 0,
  musicVolume: 0,
  soundMuted: true,
  musicMuted: true,
  roundsToWin: 2,
  roundTimerSec: 99,
  difficulty: 'NORMAL',
};

function getTargetableUnits(engine: GameEngine): TargetableUnit[] {
  const isCoop =
    engine.onlineMatchFormat === 'infinity' &&
    (engine.onlineAllies.length > 0 || engine.onlineEnemies.length > 0);
  const list: TargetableUnit[] = [];

  if (isCoop) {
    engine.onlineAllies.forEach((ally, idx) => {
      if (!ally.isDead && ally.health > 0) {
        list.push({
          key: `ally-${idx}`,
          label: ally.name || `ALLY ${idx + 1}`,
          team: 'ally',
          targetType: 'ally',
          targetIndex: idx,
          fighter: ally,
        });
      }
    });
    engine.onlineEnemies.forEach((enemy, idx) => {
      if (!enemy.isDead && enemy.health > 0) {
        list.push({
          key: `enemy-${idx}`,
          label: `${enemy.name || 'NPC'} #${idx + 1}`,
          team: 'enemy',
          targetType: 'enemy',
          targetIndex: idx,
          fighter: enemy,
        });
      }
    });
  } else {
    if (!engine.p1.isDead && engine.p1.health > 0) {
      list.push({
        key: 'p1',
        label: engine.p1.name || 'P1',
        team: 'ally',
        targetType: 'p1',
        targetIndex: 0,
        fighter: engine.p1,
      });
    }
    if (!engine.p2.isDead && engine.p2.health > 0) {
      list.push({
        key: 'p2',
        label: engine.p2.name || 'P2',
        team: 'enemy',
        targetType: 'p2',
        targetIndex: 0,
        fighter: engine.p2,
      });
    }
  }
  return list;
}

export const OwnerPanelView: React.FC<OwnerPanelViewProps> = ({
  user,
  onUserUpdated,
  onBackLobby,
}) => {
  const [activeTab, setActiveTab] = useState<'players' | 'worlds'>('players');
  const [players, setPlayers] = useState<OwnerPlayerRecord[]>([]);
  const [worlds, setWorlds] = useState<OwnerWorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'online' | 'banned'>('all');

  // Per-player inline custom inputs for coins & XP
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [xpInputs, setXpInputs] = useState<Record<string, string>>({});

  // Live Spectate state
  const [spectatingRoom, setSpectatingRoom] = useState<OnlineRoomInfo | null>(null);
  const [spectateSnapshot, setSpectateSnapshot] = useState<OnlineEngineSnapshot | null>(null);
  const [spectateOverReason, setSpectateOverReason] = useState<string | null>(null);
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null);
  const [spectateHudUnits, setSpectateHudUnits] = useState<TargetableUnit[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const latestSnapshotRef = useRef<OnlineEngineSnapshot | null>(null);
  const dtAccRef = useRef(0);
  const hoverKeyRef = useRef<string | null>(null);
  hoverKeyRef.current = hoverTargetKey;

  const showToast = useCallback((msg: string) => {
    setErrorMsg(null);
    setStatusMsg(msg);
    window.setTimeout(() => {
      setStatusMsg(prev => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchOwnerOverview();
      setPlayers(data.players);
      setWorlds(data.worlds);
      const selfPlayer = data.players.find(p => p.id === user.id);
      if (selfPlayer) {
        onUserUpdated({
          ...user,
          vCoins: selfPlayer.vCoins,
          xp: selfPlayer.xp,
          wins: selfPlayer.wins,
          losses: selfPlayer.losses,
          unlockedCharacters: selfPlayer.unlockedCharacters,
          walletRevision: selfPlayer.walletRevision,
          isOwner: selfPlayer.isOwner,
        });
      }
    } catch (err) {
      if (!silent) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load Owner Panel data.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onUserUpdated, user]);

  useEffect(() => {
    void loadOverview(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect Owner WebSocket for real-time worlds list + Spectate God-Mode
  useEffect(() => {
    multiplayerClient.connect(user, 'oggy');
    if (multiplayerClient.connected) {
      multiplayerClient.ownerListWorlds();
    }

    const unsub = multiplayerClient.subscribe(ev => {
      const type = String(ev.type || '');
      if (type === 'ws_connection' && ev.connected === true) {
        multiplayerClient.ownerListWorlds();
      } else if (type === 'owner_worlds' && Array.isArray(ev.worlds)) {
        setWorlds(ev.worlds as OwnerWorldSummary[]);
      } else if (type === 'owner_spectate_joined') {
        const room = ev.room as OnlineRoomInfo | undefined;
        const snap = (ev.snapshot as OnlineEngineSnapshot | null) || null;
        if (room) {
          setSpectatingRoom(room);
          setSpectateOverReason(null);
          latestSnapshotRef.current = snap;
          setSpectateSnapshot(snap);
          engineRef.current = null;
          setActiveTab('worlds');
        }
      } else if (type === 'owner_spectate_snapshot') {
        const room = ev.room as OnlineRoomInfo | undefined;
        const snap = (ev.snapshot as OnlineEngineSnapshot | null) || null;
        if (room) setSpectatingRoom(room);
        if (snap) {
          latestSnapshotRef.current = snap;
          setSpectateSnapshot(snap);
        }
      } else if (type === 'owner_spectate_match_over') {
        const winnerSide = String(ev.winnerSide || 'p1').toUpperCase();
        const reason = typeof ev.reason === 'string' && ev.reason ? ev.reason : 'Match Finished';
        setSpectateOverReason(`${winnerSide} WON (${reason})`);
      } else if (type === 'owner_spectate_closed') {
        setSpectatingRoom(null);
        setSpectateSnapshot(null);
        latestSnapshotRef.current = null;
        engineRef.current = null;
        setSpectateHudUnits([]);
        setSpectateOverReason(null);
        showToast(typeof ev.reason === 'string' ? ev.reason : 'World closed.');
        void loadOverview(true);
      } else if (type === 'social_updated') {
        void loadOverview(true);
      } else if (type === 'ws_error' && typeof ev.error === 'string') {
        setErrorMsg(ev.error);
      }
    });

    return () => {
      unsub();
      multiplayerClient.ownerLeaveSpectate();
      multiplayerClient.disconnect();
    };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 60fps Live Spectate Canvas Rendering Loop
  useEffect(() => {
    if (!spectatingRoom || !spectateSnapshot) return;

    const p1Char = spectatingRoom.host.characterId || 'oggy';
    const p2Char = spectatingRoom.guest?.characterId || 'buster';
    const startArena = ARENAS[spectateSnapshot.arenaId || spectatingRoom.arenaId] || ARENAS.jungle_temple;

    if (!engineRef.current) {
      const eng = new GameEngine(p1Char, p2Char, startArena, SPECTATE_DEFAULT_SETTINGS, 'ONLINE');
      eng.onlineMatchFormat = spectateSnapshot.matchFormat || spectatingRoom.matchFormat || 'play';
      eng.applyOnlineSnapshot(spectateSnapshot, 0);
      engineRef.current = eng;
    }

    let animId = 0;
    let lastTime = performance.now();
    let hudSyncAcc = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (engine && canvas) {
        dtAccRef.current += dt;
        if (latestSnapshotRef.current) {
          const snap = latestSnapshotRef.current;
          latestSnapshotRef.current = null;
          const elapsed = Math.min(0.1, Math.max(dt, dtAccRef.current));
          dtAccRef.current = 0;
          engine.applyOnlineSnapshot(snap, elapsed);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGameStage(ctx, canvas.width, canvas.height, engine, now, {
            getArenaImage: getStageArenaImage,
          });

          // Draw God-Mode Target Reticles & Click-to-Kill Labels in World Space
          const zoom = engine.cameraZoom || 1;
          const camX = engine.cameraX;
          const camY = engine.cameraY;
          const focusRatioY = canvas.height > canvas.width ? 0.48 : 0.59;
          const units = getTargetableUnits(engine);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height * focusRatioY);
          ctx.scale(zoom, zoom);
          ctx.translate(-camX, -camY);

          for (const unit of units) {
            const f = unit.fighter;
            const hovered = hoverKeyRef.current === unit.key;
            const boxW = 96;
            const boxH = 152;
            const bx = f.x - boxW / 2;
            const by = f.y - boxH + 10;

            ctx.strokeStyle = hovered
              ? '#ef4444'
              : unit.team === 'ally'
              ? 'rgba(34, 211, 238, 0.72)'
              : 'rgba(251, 146, 60, 0.72)';
            ctx.lineWidth = hovered ? 3 : 1.6;
            ctx.setLineDash(hovered ? [] : [5, 4]);
            ctx.strokeRect(bx, by, boxW, boxH);
            ctx.setLineDash([]);

            const label = hovered ? `CLICK TO KILL: ${unit.label}` : `${unit.label} (${Math.ceil(f.health)})`;
            ctx.font = 'bold 10px monospace';
            const textW = Math.max(66, ctx.measureText(label).width + 12);
            ctx.fillStyle = hovered ? 'rgba(185, 28, 28, 0.94)' : 'rgba(2, 6, 23, 0.86)';
            ctx.fillRect(f.x - textW / 2, by - 22, textW, 18);
            ctx.strokeStyle = hovered ? '#fecaca' : 'rgba(148, 163, 184, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(f.x - textW / 2, by - 22, textW, 18);

            ctx.fillStyle = hovered ? '#ffffff' : unit.team === 'ally' ? '#67e8f9' : '#fdba74';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, f.x, by - 13);
          }

          ctx.restore();

          hudSyncAcc += dt;
          if (hudSyncAcc >= 0.08) {
            hudSyncAcc = 0;
            setSpectateHudUnits(units);
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [spectatingRoom?.code, Boolean(spectateSnapshot)]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientPointToWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const cx = ((clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((clientY - rect.top) / rect.height) * canvas.height;
    const zoom = engine.cameraZoom || 1;
    const focusRatioY = canvas.height > canvas.width ? 0.48 : 0.59;
    return {
      x: (cx - canvas.width / 2) / zoom + engine.cameraX,
      y: (cy - canvas.height * focusRatioY) / zoom + engine.cameraY,
    };
  };

  const findUnitAtWorldPoint = (worldX: number, worldY: number): TargetableUnit | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const units = getTargetableUnits(engine);
    let best: TargetableUnit | null = null;
    let bestDist = Infinity;
    for (const u of units) {
      const f = u.fighter;
      if (worldX >= f.x - 68 && worldX <= f.x + 68 && worldY >= f.y - 185 && worldY <= f.y + 24) {
        const dist = Math.hypot(worldX - f.x, worldY - (f.y - 75));
        if (dist < bestDist) {
          bestDist = dist;
          best = u;
        }
      }
    }
    return best;
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = clientPointToWorld(e.clientX, e.clientY);
    if (!pt) {
      if (hoverTargetKey !== null) setHoverTargetKey(null);
      return;
    }
    const unit = findUnitAtWorldPoint(pt.x, pt.y);
    const nextKey = unit ? unit.key : null;
    if (nextKey !== hoverTargetKey) {
      setHoverTargetKey(nextKey);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!spectatingRoom) return;
    const pt = clientPointToWorld(e.clientX, e.clientY);
    if (!pt) return;
    const unit = findUnitAtWorldPoint(pt.x, pt.y);
    if (!unit) return;
    soundManager.playUiSelect();
    multiplayerClient.ownerKillFighter(spectatingRoom.code, unit.targetType, unit.targetIndex);
    showToast(`Eliminated ${unit.label}`);
  };

  const applyPlayerPatch = (updated: OwnerPlayerRecord) => {
    setPlayers(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    if (updated.id === user.id) {
      onUserUpdated({
        ...user,
        vCoins: updated.vCoins,
        xp: updated.xp,
        unlockedCharacters: updated.unlockedCharacters,
        walletRevision: updated.walletRevision,
      });
    }
  };

  const handleWalletDelta = async (player: OwnerPlayerRecord, coinsDelta: number, xpDelta: number) => {
    if (busyPlayerId) return;
    setBusyPlayerId(player.id);
    try {
      const updated = await setOwnerPlayerWallet(player.id, {
        ...(coinsDelta !== 0 ? { vCoinsDelta: coinsDelta } : {}),
        ...(xpDelta !== 0 ? { xpDelta } : {}),
      });
      soundManager.playUiSelect();
      applyPlayerPatch(updated);
      showToast(`Updated ${updated.username}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update wallet.');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleWalletCustom = async (
    player: OwnerPlayerRecord,
    field: 'coins' | 'xp',
    mode: 'set' | 'add' | 'sub'
  ) => {
    const raw = (field === 'coins' ? coinInputs[player.id] : xpInputs[player.id]) || '';
    const parsed = parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setErrorMsg('Enter a valid whole number (0 or higher).');
      return;
    }
    if (busyPlayerId) return;
    setBusyPlayerId(player.id);
    try {
      const payload =
        field === 'coins'
          ? mode === 'set'
            ? { vCoins: parsed }
            : { vCoinsDelta: mode === 'add' ? parsed : -parsed }
          : mode === 'set'
          ? { xp: parsed }
          : { xpDelta: mode === 'add' ? parsed : -parsed };
      const updated = await setOwnerPlayerWallet(player.id, payload);
      soundManager.playUiSelect();
      applyPlayerPatch(updated);
      if (field === 'coins') {
        setCoinInputs(prev => ({ ...prev, [player.id]: '' }));
      } else {
        setXpInputs(prev => ({ ...prev, [player.id]: '' }));
      }
      showToast(`Updated ${updated.username}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update wallet.');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleToggleBan = async (player: OwnerPlayerRecord) => {
    if (player.isOwner || busyPlayerId) return;
    setBusyPlayerId(player.id);
    try {
      const updated = await setOwnerPlayerBan(
        player.id,
        !player.banned,
        !player.banned ? 'Suspended by Owner' : ''
      );
      soundManager.playUiSelect();
      applyPlayerPatch(updated);
      showToast(updated.banned ? `Banned ${updated.username}` : `Unbanned ${updated.username}`);
      void loadOverview(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update ban status.');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleUnlockAll = async (player: OwnerPlayerRecord) => {
    if (busyPlayerId) return;
    setBusyPlayerId(player.id);
    try {
      const updated = await unlockAllOwnerPlayerCharacters(player.id);
      soundManager.playUiSelect();
      applyPlayerPatch(updated);
      showToast(`All fighters unlocked for ${updated.username}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to unlock characters.');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return players.filter(p => {
      if (playerFilter === 'online' && !p.isOnline) return false;
      if (playerFilter === 'banned' && !p.banned) return false;
      if (!q) return true;
      return (
        p.username.toLowerCase().includes(q) ||
        p.playerId.toLowerCase().includes(q)
      );
    });
  }, [players, searchQuery, playerFilter]);

  const activeArenaDef =
    ARENAS[(spectateSnapshot?.arenaId || spectatingRoom?.arenaId || 'jungle_temple') as ArenaId];

  return (
    <div className="w-full h-[100dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 text-white flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              multiplayerClient.ownerLeaveSpectate();
              onBackLobby();
            }}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-pixel text-[9px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>LOBBY</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-pixel text-[8px] font-black">
                OWNER
              </span>
              <h1 className="font-pixel text-xs sm:text-sm text-amber-300 tracking-wide">
                CONTROL PANEL
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Signed in as <span className="text-white font-semibold">{user.username}</span>
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              soundManager.playUiMove();
              setActiveTab('players');
            }}
            className={`px-3.5 py-2 rounded-lg font-pixel text-[9px] flex items-center gap-1.5 border whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'players'
                ? 'bg-amber-500 text-slate-950 border-yellow-200 font-black'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="tabular-nums">PLAYERS ({players.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playUiMove();
              setActiveTab('worlds');
              multiplayerClient.ownerListWorlds();
            }}
            className={`px-3.5 py-2 rounded-lg font-pixel text-[9px] flex items-center gap-1.5 border whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'worlds'
                ? 'bg-cyan-500 text-slate-950 border-cyan-200 font-black'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span className="tabular-nums">LIVE WORLDS ({worlds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              void loadOverview(false);
              multiplayerClient.ownerListWorlds();
            }}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-pixel text-[9px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        </div>
      </header>

      {/* Alerts Strip */}
      {(errorMsg || statusMsg) && (
        <div className="px-3 sm:px-6 pt-3 max-w-6xl w-full mx-auto">
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-950/90 border border-red-500 text-xs text-red-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-300 hover:text-white font-pixel text-[9px] cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          )}
          {statusMsg && !errorMsg && (
            <div className="px-3.5 py-2 rounded-lg bg-emerald-950/90 border border-emerald-500 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-3 pb-8 sm:py-4 sm:pb-10 space-y-4">
        {activeTab === 'players' && (
          <section className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search fighter name or ID (FXP-...)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                {(['all', 'online', 'banned'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      soundManager.playUiMove();
                      setPlayerFilter(f);
                    }}
                    className={`px-3 py-2 rounded-lg font-pixel text-[8px] uppercase border whitespace-nowrap cursor-pointer ${
                      playerFilter === f
                        ? 'bg-amber-500 text-slate-950 border-yellow-200 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Players Grid */}
            {filteredPlayers.length === 0 ? (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center text-slate-400 text-sm">
                {loading ? 'Loading players...' : 'No matching players found.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {filteredPlayers.map(p => {
                  const isBusy = busyPlayerId === p.id;
                  const unlockedCount = p.unlockedCharacters.length;
                  const maxUnlockable = p.isOwner
                    ? CHARACTER_LIST.length
                    : CHARACTER_LIST.filter(c => !c.ownerOnly).length;
                  const allUnlocked = unlockedCount >= maxUnlockable;
                  return (
                    <article
                      key={p.id}
                      className={`rounded-xl bg-slate-900 border p-4 space-y-3 ${
                        p.banned
                          ? 'border-red-500/70'
                          : p.isOwner
                          ? 'border-amber-400/80'
                          : 'border-slate-800'
                      }`}
                    >
                      {/* Top Player Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={p.avatarUrl}
                            alt={p.username}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-full border border-slate-600 object-cover pixelated shrink-0 bg-slate-950"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-pixel text-xs text-white truncate max-w-[160px]">
                                {p.username}
                              </span>
                              {p.isOwner && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-pixel text-[7px] font-black">
                                  OWNER
                                </span>
                              )}
                              {p.banned && (
                                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-pixel text-[7px]">
                                  BANNED
                                </span>
                              )}
                              {p.isOnline && !p.banned && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-pixel text-[7px]">
                                  ONLINE
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                              {p.playerId} · {p.wins}W / {p.losses}L · {unlockedCount}/{maxUnlockable} Fighters
                            </div>
                          </div>
                        </div>

                        {p.activeRoomCode && (
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playUiSelect();
                              multiplayerClient.ownerSpectateWorld(p.activeRoomCode!);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-pixel text-[8px] font-black flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
                          >
                            <Eye className="w-3 h-3" />
                            <span>SPECTATE</span>
                          </button>
                        )}
                      </div>

                      {/* V-Coins Economy Control */}
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white font-mono text-[10px] font-black text-white">
                              V
                            </span>
                            <span className="font-pixel text-xs text-white tabular-nums">
                              {p.vCoins.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[-100, -10, 10, 100].map(delta => (
                              <button
                                key={delta}
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleWalletDelta(p, delta, 0)}
                                className={`px-2 py-1 rounded font-mono text-[11px] font-bold border cursor-pointer tabular-nums disabled:opacity-50 ${
                                  delta < 0
                                    ? 'bg-rose-950/70 hover:bg-rose-900 border-rose-700/70 text-rose-200'
                                    : 'bg-emerald-950/70 hover:bg-emerald-900 border-emerald-700/70 text-emerald-200'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={coinInputs[p.id] ?? ''}
                            onChange={e => setCoinInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Custom V-Coins..."
                            className="flex-1 min-w-[96px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none text-xs text-white tabular-nums"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'coins', 'set')}
                            className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-pixel text-[8px] font-black whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            SET
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'coins', 'add')}
                            className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-[8px] whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            + ADD
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'coins', 'sub')}
                            className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-pixel text-[8px] whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            - SUB
                          </button>
                        </div>
                      </div>

                      {/* XP Economy Control */}
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-[9px] text-cyan-300">XP</span>
                            <span className="font-pixel text-xs text-white tabular-nums">
                              {p.xp.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[-100, -25, 25, 100].map(delta => (
                              <button
                                key={delta}
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleWalletDelta(p, 0, delta)}
                                className={`px-2 py-1 rounded font-mono text-[11px] font-bold border cursor-pointer tabular-nums disabled:opacity-50 ${
                                  delta < 0
                                    ? 'bg-rose-950/70 hover:bg-rose-900 border-rose-700/70 text-rose-200'
                                    : 'bg-cyan-950/70 hover:bg-cyan-900 border-cyan-700/70 text-cyan-200'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={xpInputs[p.id] ?? ''}
                            onChange={e => setXpInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Custom XP..."
                            className="flex-1 min-w-[96px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:outline-none text-xs text-white tabular-nums"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'xp', 'set')}
                            className="px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-pixel text-[8px] font-black whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            SET
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'xp', 'add')}
                            className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-[8px] whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            + ADD
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleWalletCustom(p, 'xp', 'sub')}
                            className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-pixel text-[8px] whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            - SUB
                          </button>
                        </div>
                      </div>

                      {/* Account Actions */}
                      <div className="flex items-center justify-end gap-2 pt-0.5 flex-wrap">
                        {!allUnlocked && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUnlockAll(p)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/70 text-amber-200 font-pixel text-[8px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>UNLOCK ALL FIGHTERS</span>
                          </button>
                        )}

                        {!p.isOwner && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleBan(p)}
                            className={`px-3 py-1.5 rounded-lg font-pixel text-[8px] flex items-center gap-1.5 border whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                              p.banned
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white'
                                : 'bg-red-700 hover:bg-red-600 border-red-400 text-white'
                            }`}
                          >
                            {p.banned ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                            <span>{p.banned ? 'UNBAN ID' : 'BAN ID'}</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'worlds' && (
          <section className="space-y-4">
            {spectatingRoom ? (
              <div className="space-y-3">
                {/* Spectate God-Mode Header */}
                <div className="rounded-xl bg-slate-900 border border-cyan-500/70 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-pixel text-[8px] font-black">
                        SPECTATING
                      </span>
                      <span className="font-pixel text-xs text-white">{spectatingRoom.name}</span>
                      <span className="font-mono text-xs text-amber-300">#{spectatingRoom.code}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {activeArenaDef?.name || spectatingRoom.arenaId} ·{' '}
                      {spectatingRoom.matchFormat === 'infinity' ? 'INFINITY CO-OP' : '1v1 VERSUS'} ·{' '}
                      {spectatingRoom.host.username}
                      {spectatingRoom.guest ? ` vs ${spectatingRoom.guest.username}` : ' (Waiting Guest)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {spectateSnapshot && (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiSelect();
                          multiplayerClient.ownerHealAll(spectatingRoom.code);
                          showToast('All fighters healed to 100%');
                        }}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-pixel text-[8px] border border-emerald-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <HeartPulse className="w-3.5 h-3.5" />
                        <span>HEAL ALL</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playUiSelect();
                        multiplayerClient.ownerCloseWorld(spectatingRoom.code);
                      }}
                      className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-pixel text-[8px] border border-red-400 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>CLOSE WORLD</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playUiSelect();
                        multiplayerClient.ownerLeaveSpectate();
                        setSpectatingRoom(null);
                        setSpectateSnapshot(null);
                        latestSnapshotRef.current = null;
                        engineRef.current = null;
                        setSpectateHudUnits([]);
                        setSpectateOverReason(null);
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-[8px] border border-slate-600 whitespace-nowrap cursor-pointer"
                    >
                      EXIT SPECTATE
                    </button>
                  </div>
                </div>

                {/* Live Interactive Canvas OR Lobby Waiting View */}
                {spectateSnapshot ? (
                  <>
                    <div className="relative w-full aspect-video max-h-[65vh] bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                      <canvas
                        ref={canvasRef}
                        width={960}
                        height={540}
                        onMouseMove={handleCanvasMove}
                        onMouseLeave={() => setHoverTargetKey(null)}
                        onClick={handleCanvasClick}
                        className={`w-full h-full block ${hoverTargetKey ? 'cursor-crosshair' : 'cursor-default'}`}
                      />

                      {/* Live Top HUD Overlay */}
                      <div className="pointer-events-none absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2">
                        <div className="px-2.5 py-1 rounded bg-slate-950/85 border border-slate-700 font-pixel text-[9px] text-amber-300 tabular-nums">
                          {spectateSnapshot.matchFormat === 'infinity'
                            ? `ZONE ${spectateSnapshot.infinityZone || 1} · KO ${spectateSnapshot.infinityDefeated || 0}`
                            : `ROUND ${spectateSnapshot.roundNumber} · ${spectateSnapshot.p1.wins}-${spectateSnapshot.p2.wins}`}
                        </div>

                        <div className="px-2.5 py-1 rounded bg-red-950/85 border border-red-500/70 font-pixel text-[8px] text-red-200">
                          CLICK ANY FIGHTER ON SCREEN TO INSTANT KILL
                        </div>
                      </div>

                      {spectateOverReason && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                          <div className="px-4 py-2 rounded-lg bg-slate-950/95 border border-amber-400 font-pixel text-[10px] text-amber-300">
                            {spectateOverReason}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Explicit Per-Fighter God-Mode Kill Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {spectateHudUnits.map(unit => {
                        const charDef = CHARACTERS[unit.fighter.characterId];
                        const hpPct = Math.max(
                          0,
                          Math.min(100, (unit.fighter.health / Math.max(1, unit.fighter.maxHealth)) * 100)
                        );
                        return (
                          <div
                            key={unit.key}
                            className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-pixel text-[9px] truncate ${
                                    unit.team === 'ally' ? 'text-cyan-300' : 'text-amber-300'
                                  }`}
                                >
                                  {unit.label}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  ({charDef?.name || unit.fighter.characterId})
                                </span>
                              </div>
                              <div className="mt-1.5 h-2 rounded bg-slate-950 overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full transition-all ${
                                    unit.team === 'ally' ? 'bg-cyan-400' : 'bg-orange-400'
                                  }`}
                                  style={{ width: `${hpPct}%` }}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-slate-300 mt-1 tabular-nums">
                                {Math.ceil(unit.fighter.health)} / {unit.fighter.maxHealth} HP
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                soundManager.playUiSelect();
                                multiplayerClient.ownerKillFighter(
                                  spectatingRoom.code,
                                  unit.targetType,
                                  unit.targetIndex
                                );
                                showToast(`Eliminated ${unit.label}`);
                              }}
                              className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-pixel text-[8px] border border-red-300 flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
                            >
                              <Skull className="w-3 h-3" />
                              <span>KILL</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center space-y-2">
                    <div className="font-pixel text-xs text-amber-300">
                      WORLD IN ROOM SETUP ({spectatingRoom.status.toUpperCase()})
                    </div>
                    <p className="text-xs text-slate-400">
                      Live combat view will appear automatically the moment players launch the fight.
                    </p>
                  </div>
                )}
              </div>
            ) : worlds.length === 0 ? (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center space-y-2">
                <div className="font-pixel text-xs text-slate-300">NO ACTIVE WORLDS</div>
                <p className="text-xs text-slate-400">
                  When players create public or private rooms or start Quick Match, every live world will show up here for Spectating.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {worlds.map(w => (
                  <article
                    key={w.code}
                    className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-pixel text-xs text-white">{w.name}</span>
                          <span className="font-mono text-xs text-amber-300">#{w.code}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-pixel text-[7px] ${
                              w.status === 'playing'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {w.status.toUpperCase()}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-pixel text-[7px]">
                            {w.visibility.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {ARENAS[w.arenaId]?.name || w.arenaId} ·{' '}
                          {w.matchFormat === 'infinity' ? 'INFINITY CO-OP' : '1v1 VERSUS'} ·{' '}
                          <span className="tabular-nums">{w.spectatorCount} watching</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                        <div className="text-[10px] text-cyan-300 font-semibold">HOST</div>
                        <div className="font-pixel text-[10px] text-white truncate mt-0.5">
                          {w.host.username}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {CHARACTERS[w.host.characterId]?.name || w.host.characterId}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                        <div className="text-[10px] text-amber-300 font-semibold">GUEST</div>
                        {w.guest ? (
                          <>
                            <div className="font-pixel text-[10px] text-white truncate mt-0.5">
                              {w.guest.username}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {CHARACTERS[w.guest.characterId]?.name || w.guest.characterId}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-slate-500 mt-1">Open slot</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          soundManager.playUiSelect();
                          try {
                            await closeOwnerWorld(w.code);
                            showToast(`Closed world ${w.code}`);
                            void loadOverview(true);
                          } catch (err) {
                            setErrorMsg(err instanceof Error ? err.message : 'Unable to close world.');
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white font-pixel text-[8px] border border-red-500 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>CLOSE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiSelect();
                          multiplayerClient.ownerSpectateWorld(w.code);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-pixel text-[8px] font-black border border-cyan-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>SPECTATE WORLD</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
