import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pause, Play, RotateCcw, Users, Home, Music, Volume2, VolumeX, Award, ArrowRight, Swords, Flame, Zap, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { ArenaId, CharacterId, DeviceType, GameMode, GameSettings, InfinityAchievementId, OnlineEngineSnapshot, OnlineMatchFormat, OnlinePlayerInput } from '../types/game';
import { CHARACTERS } from '../data/characters';
import { ARENAS } from '../data/arenas';
import { INFINITY_ACHIEVEMENTS } from '../data/achievements';
import { GameEngine } from '../game/gameEngine';
import { renderGameStage } from '../game/stageRenderer';
import { soundManager } from '../audio/soundManager';
import { getPreloadedImage } from '../utils/assetLoader';
import { InfinityRunSummary } from './RoundResultModal';
import { ActiveOnlineMatchContext, WsMatchOverPayload, multiplayerClient } from '../services/multiplayerClient';

interface FightingGameViewProps {
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  mode: GameMode;
  settings: GameSettings;
  deviceType: DeviceType;
  isNetOnline: boolean;
  onlineContext?: ActiveOnlineMatchContext | null;
  onOnlineMatchOver?: (payload: WsMatchOverPayload) => void;
  onMatchOver: (
    winner: 'p1' | 'p2',
    p1Wins: number,
    p2Wins: number,
    infinitySummary?: InfinityRunSummary | null
  ) => void;
  onReturnLobby: () => void;
  onSelectFighters: () => void;
  onToggleSound: () => boolean;
  onToggleMusic: () => boolean;
}

interface OnlineHudAlly {
  name: string;
  characterId: CharacterId;
  health: number;
  maxHealth: number;
  damageGhost: number;
  superMeter: number;
  isDead: boolean;
  reviveProgress: number;
  comboHits: number;
  comboDamage: number;
  comboWindow: number;
  overdrive: boolean;
}

interface OnlineHudEnemy {
  name: string;
  characterId: CharacterId;
  health: number;
  maxHealth: number;
  damageGhost: number;
  isDead: boolean;
}

interface HudSnapshot {
  p1Health: number;
  p1MaxHealth: number;
  p1Ghost: number;
  p1Super: number;
  p1Wins: number;
  p1Combo: number;
  p1ComboDamage: number;
  p1ComboWindow: number;
  p1Action: string;
  p1Overdrive: boolean;
  p2Health: number;
  p2MaxHealth: number;
  p2Ghost: number;
  p2Super: number;
  p2Wins: number;
  p2Combo: number;
  p2ComboDamage: number;
  p2ComboWindow: number;
  p2Action: string;
  p2Overdrive: boolean;
  timer: number;
  roundNumber: number;
  announceText: string;
  matchState: GameEngine['matchState'];
  activeArenaId: ArenaId;
  activeP2Char: CharacterId;
  infinityZone: number;
  infinityDefeated: number;
  infinityRunCoins: number;
  infinityTotalCoins: number;
  infinityZoneCleared: boolean;
  infinityEnemyActive: boolean;
  infinityUnlocked: InfinityAchievementId[];
  onlineMatchFormat: OnlineMatchFormat;
  onlineRoundsToWin: number;
  onlineRoundTimerSec: number;
  onlineP1Coins: number;
  onlineP2Coins: number;
  onlineAllies: OnlineHudAlly[];
  onlineEnemies: OnlineHudEnemy[];
  onlineCanReviveNow: boolean;
  onlineLocalIsDead: boolean;
  onlineNearDeadAlly: boolean;
  onlineInfinityZone: number;
  onlineInfinityDefeated: number;
  onlineInfinityZoneCleared: boolean;
}

export const FightingGameView: React.FC<FightingGameViewProps> = ({
  p1Char,
  p2Char,
  arenaId,
  mode,
  settings,
  deviceType,
  isNetOnline,
  onlineContext,
  onOnlineMatchOver,
  onMatchOver,
  onReturnLobby,
  onSelectFighters,
  onToggleSound,
  onToggleMusic,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const matchOverReportedRef = useRef(false);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [activeToast, setActiveToast] = useState<InfinityAchievementId | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Online Multiplayer live state refs
  const latestOnlineSnapshotRef = useRef<OnlineEngineSnapshot | null>(null);
  const onlineDtAccRef = useRef(0);
  const onlineHeldKeysRef = useRef<Set<string>>(new Set());
  const onlineTouchDirRef = useRef<-1 | 0 | 1>(0);
  const onlineTouchReviveRef = useRef(false);
  const onlineQueuedRef = useRef<{ power1: boolean; power2: boolean; overdrive: boolean }>({
    power1: false,
    power2: false,
    overdrive: false,
  });
  const [opponentReconnectBanner, setOpponentReconnectBanner] = useState<string | null>(null);
  const isNetOnlineRef = useRef<boolean>(isNetOnline);
  isNetOnlineRef.current = isNetOnline;

  // Bottom-Left Forward / Backward touch state
  const movePadRef = useRef<HTMLDivElement | null>(null);
  const movePointerIdRef = useRef<number | null>(null);
  const [touchMoveDir, setTouchMoveDir] = useState<-1 | 0 | 1>(0);

  // Mobile/Touch Controls are ALWAYS ON permanently (no toggle buttons)
  const lastTouchAtRef = useRef<number>(0);
  const showTouchControls = true;
  const showTouchControlsRef = useRef<boolean>(true);
  showTouchControlsRef.current = true;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [hud, setHud] = useState<HudSnapshot>({
    p1Health: 200,
    p1MaxHealth: 200,
    p1Ghost: 200,
    p1Super: 0,
    p1Wins: 0,
    p1Combo: 0,
    p1ComboDamage: 0,
    p1ComboWindow: 0,
    p1Action: 'idle',
    p1Overdrive: false,
    p2Health: 200,
    p2MaxHealth: 200,
    p2Ghost: 200,
    p2Super: 0,
    p2Wins: 0,
    p2Combo: 0,
    p2ComboDamage: 0,
    p2ComboWindow: 0,
    p2Action: 'idle',
    p2Overdrive: false,
    timer: settings.roundTimerSec,
    roundNumber: 1,
    announceText: mode === 'INFINITY' ? 'ZONE 1' : 'ROUND 1',
    matchState: 'INTRO',
    activeArenaId: arenaId,
    activeP2Char: p2Char,
    infinityZone: 1,
    infinityDefeated: 0,
    infinityRunCoins: 0,
    infinityTotalCoins: 0,
    infinityZoneCleared: false,
    infinityEnemyActive: true,
    infinityUnlocked: [],
    onlineMatchFormat: onlineContext?.room.matchFormat || 'play',
    onlineRoundsToWin: onlineContext?.room.roundsToWin || (onlineContext?.room.matchFormat === 'infinity' ? 3 : settings.roundsToWin),
    onlineRoundTimerSec: onlineContext?.room.roundTimerSec ?? (onlineContext?.room.matchFormat === 'infinity' ? 0 : 99),
    onlineP1Coins: 0,
    onlineP2Coins: 0,
    onlineAllies: [],
    onlineEnemies: [],
    onlineCanReviveNow: false,
    onlineLocalIsDead: false,
    onlineNearDeadAlly: false,
    onlineInfinityZone: 1,
    onlineInfinityDefeated: 0,
    onlineInfinityZoneCleared: false,
  });

  const activeArena = ARENAS[hud.activeArenaId] || ARENAS[arenaId];
  const p1Def = CHARACTERS[p1Char];
  const activeP2Def = CHARACTERS[hud.activeP2Char] || CHARACTERS[p2Char];

  const getArenaImage = useCallback((id: ArenaId): HTMLImageElement | null => {
    const def = ARENAS[id];
    if (!def) return null;
    return getPreloadedImage(def.imageUrl);
  }, []);

  // Preload initial arena image
  useEffect(() => {
    getArenaImage(arenaId);
  }, [arenaId, getArenaImage]);

  // Keep background music silent during active fighting so combat SFX & punches stand out cleanly
  useEffect(() => {
    soundManager.stopBgm();
    return () => {
      soundManager.stopBgm();
    };
  }, []);

  const isOnline = mode === 'ONLINE';
  const localOnlineSide = onlineContext?.localSide || 'p1';
  const p1DisplayLabel =
    isOnline && onlineContext?.room.host.username
      ? `${onlineContext.room.host.username}${localOnlineSide === 'p1' ? ' (YOU)' : ''}`
      : p1Def.name;
  const p2DisplayLabel =
    isOnline && onlineContext?.room.guest?.username
      ? `${onlineContext.room.guest.username}${localOnlineSide === 'p2' ? ' (YOU)' : ''}`
      : `${activeP2Def.name}${mode === 'ARCADE' || mode === 'INFINITY' ? ' (CPU)' : ''}`;

  const flushOnlineInput = useCallback(() => {
    if (mode !== 'ONLINE' || !isNetOnlineRef.current) return;
    const held = onlineHeldKeysRef.current;
    const tDir = onlineTouchDirRef.current;
    const queued = onlineQueuedRef.current;
    const payload: OnlinePlayerInput = {
      left: held.has('a') || held.has('arrowleft') || tDir === -1,
      right: held.has('d') || held.has('arrowright') || tDir === 1,
      up: held.has('w') || held.has(' ') || held.has('space') || held.has('arrowup'),
      down: held.has('s') || held.has('arrowdown'),
      sprint: held.has('shift'),
      block: false,
      revive: held.has('q') || onlineTouchReviveRef.current,
      power1: queued.power1,
      power2: queued.power2,
      overdrive: queued.overdrive,
    };

    queued.power1 = false;
    queued.power2 = false;
    queued.overdrive = false;
    multiplayerClient.sendCombatInput(payload);
  }, [mode]);

  // Immediately clear and neutralize inputs if internet drops during an Online match
  useEffect(() => {
    if (mode !== 'ONLINE' || isNetOnline) return;
    onlineHeldKeysRef.current.clear();
    onlineTouchDirRef.current = 0;
    onlineTouchReviveRef.current = false;
    onlineQueuedRef.current = { power1: false, power2: false, overdrive: false };
    setTouchMoveDir(0);
    multiplayerClient.sendCombatInput({
      left: false,
      right: false,
      up: false,
      down: false,
      sprint: false,
      block: false,
      revive: false,
      power1: false,
      power2: false,
      overdrive: false,
    });
  }, [mode, isNetOnline]);

  // Initialize Game Engine only when matchup, initial arena, or mode changes (never on audio toggle)
  useEffect(() => {
    matchOverReportedRef.current = false;
    latestOnlineSnapshotRef.current = null;
    onlineDtAccRef.current = 0;
    onlineHeldKeysRef.current.clear();
    onlineTouchDirRef.current = 0;
    onlineTouchReviveRef.current = false;
    setOpponentReconnectBanner(null);

    const engine = new GameEngine(p1Char, p2Char, ARENAS[arenaId], settingsRef.current, mode);
    const canvas = canvasRef.current;
    const rect = canvas?.parentElement?.getBoundingClientRect();
    const domW = rect?.width || window.innerWidth;
    const domH = Math.max(1, rect?.height || window.innerHeight);
    const rawAspect = domW / domH;
    const initViewW = rawAspect >= 1 ? Math.max(540, Math.min(1600, Math.round(540 * rawAspect))) : 540;
    const initViewH = rawAspect >= 1 ? 540 : Math.max(540, Math.min(1180, Math.round(540 / Math.max(0.42, rawAspect))));
    engine.viewportW = initViewW;
    engine.viewportH = initViewH;
    engine.viewportAspect = initViewW / initViewH;
    if (mode === 'ONLINE' && onlineContext?.initialSnapshot) {
      engine.applyOnlineSnapshot(onlineContext.initialSnapshot, 0);
    }
    engineRef.current = engine;

    if (mode === 'INFINITY') {
      engine.infinitySegments.forEach(s => getArenaImage(s.arenaId));
    }

    return () => {
      engine.releaseAllKeys();
    };
  }, [p1Char, p2Char, arenaId, mode, onlineContext, getArenaImage]);

  // Subscribe to WebSocket snapshots, reconnect notices, and match completion when mode === 'ONLINE'
  useEffect(() => {
    if (mode !== 'ONLINE') return;

    const unsub = multiplayerClient.subscribe(ev => {
      if (ev.type === 'match_snapshot' && ev.snapshot) {
        latestOnlineSnapshotRef.current = ev.snapshot as OnlineEngineSnapshot;
      } else if (ev.type === 'opponent_reconnecting') {
        const who = String(ev.username || 'Opponent');
        const sec = Number(ev.seconds || 4);
        setOpponentReconnectBanner(`${who} left — awarding win in ${sec}s...`);
      } else if (ev.type === 'opponent_reconnected') {
        setOpponentReconnectBanner(null);
      } else if (ev.type === 'match_over' && !matchOverReportedRef.current) {
        matchOverReportedRef.current = true;
        setOpponentReconnectBanner(null);
        onOnlineMatchOver?.(ev as unknown as WsMatchOverPayload);
      }
    });

    // Periodic lightweight sync so held keys stay fresh cleanly on server
    const holdTicker = window.setInterval(() => {
      const held = onlineHeldKeysRef.current;
      if (held.size > 0 || onlineTouchDirRef.current !== 0 || onlineTouchReviveRef.current) {
        flushOnlineInput();
      }
    }, 66);

    return () => {
      unsub();
      window.clearInterval(holdTicker);
    };
  }, [mode, flushOnlineInput, onOnlineMatchOver]);

  // Keep canvas pixel resolution locked to exact rendered aspect ratio at crisp 540px arcade height
  useEffect(() => {
    const syncCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      const domW = rect?.width || window.innerWidth;
      const domH = Math.max(1, rect?.height || window.innerHeight);
      const rawAspect = domW / domH;
      const viewW = rawAspect >= 1
        ? Math.max(540, Math.min(1600, Math.round(540 * rawAspect)))
        : 540;
      const viewH = rawAspect >= 1
        ? 540
        : Math.max(540, Math.min(1180, Math.round(viewW / Math.max(0.42, rawAspect))));
      if (canvas.width !== viewW || canvas.height !== viewH) {
        canvas.width = viewW;
        canvas.height = viewH;
      }
      if (engineRef.current) {
        engineRef.current.viewportW = viewW;
        engineRef.current.viewportH = viewH;
        engineRef.current.viewportAspect = viewW / viewH;
      }
    };
    syncCanvasSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncCanvasSize) : null;
    if (ro && canvasRef.current?.parentElement) {
      ro.observe(canvasRef.current.parentElement);
    }
    window.addEventListener('resize', syncCanvasSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, []);

  // Keep engine settings synced if muted toggled
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.settings = settings;
    }
  }, [settings]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      if (next && engineRef.current) {
        engineRef.current.releaseAllKeys();
      }
      return next;
    });
    soundManager.playUiSelect();
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (isPausedRef.current || !isNetOnlineRef.current) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      if (mode === 'ONLINE') {
        if (!isNetOnlineRef.current) return;
        const lower = e.key === ' ' ? ' ' : e.key.toLowerCase();
        const wasHeld = onlineHeldKeysRef.current.has(lower);
        onlineHeldKeysRef.current.add(lower);
        if (!wasHeld) {
          if (lower === 'j') onlineQueuedRef.current.power1 = true;
          if (lower === 'k') onlineQueuedRef.current.power2 = true;
          if (lower === 'e') onlineQueuedRef.current.overdrive = true;
        }
        flushOnlineInput();
        return;
      }

      engineRef.current?.handleKeyDown(e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (mode === 'ONLINE') {
        const lower = e.key === ' ' ? ' ' : e.key.toLowerCase();
        onlineHeldKeysRef.current.delete(lower);
        flushOnlineInput();
        return;
      }
      engineRef.current?.handleKeyUp(e.key);
    };

    const onBlur = () => {
      if (mode === 'ONLINE') {
        onlineHeldKeysRef.current.clear();
        onlineTouchDirRef.current = 0;
        onlineTouchReviveRef.current = false;
        flushOnlineInput();
      } else {
        engineRef.current?.releaseAllKeys();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [togglePause, mode, localOnlineSide, flushOnlineInput]);

  // Main 60 FPS Simulation + Render Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let hudTick = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        if (engine.mode === 'ONLINE') {
          if (isNetOnlineRef.current) {
            onlineDtAccRef.current += dt;
            if (latestOnlineSnapshotRef.current) {
              const snap = latestOnlineSnapshotRef.current;
              latestOnlineSnapshotRef.current = null;
              const elapsed = Math.min(0.1, Math.max(dt, onlineDtAccRef.current));
              onlineDtAccRef.current = 0;
              engine.applyOnlineSnapshot(snap, elapsed);
            } else {
              for (const f of [engine.p1, engine.p2, ...engine.onlineAllies, ...engine.onlineEnemies]) {
                if ((f.comboTimer ?? 0) > 0) {
                  f.comboTimer = Math.max(0, (f.comboTimer ?? 0) - dt);
                  if (f.comboTimer <= 0) {
                    f.comboHits = 0;
                    f.comboDamage = 0;
                  }
                }
              }
            }
          }
        } else if (!isPausedRef.current && isNetOnlineRef.current) {
          engine.update(dt, now);

          if (engine.mode === 'INFINITY') {
            engine.infinitySegments.forEach(seg => getArenaImage(seg.arenaId));
          }

          if (engine.infinityPendingToasts.length > 0) {
            const nextToast = engine.infinityPendingToasts.shift()!;
            setActiveToast(nextToast);
            if (toastTimerRef.current !== null) {
              window.clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = window.setTimeout(() => {
              setActiveToast(null);
            }, 3400);
          }

          if (engine.matchState === 'MATCH_OVER' && !matchOverReportedRef.current && engine.matchWinnerId) {
            matchOverReportedRef.current = true;
            const summary: InfinityRunSummary | null =
              engine.mode === 'INFINITY'
                ? {
                    zoneReached: engine.infinityZoneIndex + 1,
                    defeatedCount: engine.infinityDefeatedCount,
                    runCoins: engine.infinityRunCoins,
                    runXP: engine.infinityRunXP,
                    totalCoins: engine.infinityTotalCoins,
                    unlockedAchievements: Array.from(engine.infinityAchievementsUnlocked),
                  }
                : null;
            onMatchOver(engine.matchWinnerId, engine.p1.wins, engine.p2.wins, summary);
          }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGameStage(ctx, canvas.width, canvas.height, engine, now, {
            showTouchControls: showTouchControlsRef.current,
            getArenaImage,
          });
        }

        // Sync React HUD at ~30 Hz for smooth bars without unnecessary overhead
        hudTick += dt;
        if (hudTick >= 0.03) {
          hudTick = 0;
          const localIdx = localOnlineSide === 'p2' ? 1 : 0;
          const localAlly = engine.onlineAllies[localIdx];
          const nearDeadAlly = Boolean(
            engine.mode === 'ONLINE' &&
              engine.onlineMatchFormat === 'infinity' &&
              localAlly &&
              !localAlly.isDead &&
              engine.onlineAllies.some(a => a.isDead && Math.abs(a.x - localAlly.x) <= 110)
          );
          setHud({
            p1Health: engine.p1.health,
            p1MaxHealth: engine.p1.maxHealth,
            p1Ghost: engine.p1.damageGhost,
            p1Super: engine.p1.superMeter,
            p1Wins: engine.p1.wins,
            p1Combo: engine.p1.comboHits,
            p1ComboDamage: engine.p1.comboDamage,
            p1ComboWindow: Math.max(0, Math.min(1, (engine.p1.comboTimer ?? 0) / GameEngine.COMBO_WINDOW_SEC)),
            p1Action: engine.p1.action,
            p1Overdrive: engine.p1.overdriveArmed,
            p2Health: engine.p2.health,
            p2MaxHealth: engine.p2.maxHealth,
            p2Ghost: engine.p2.damageGhost,
            p2Super: engine.p2.superMeter,
            p2Wins: engine.p2.wins,
            p2Combo: engine.p2.comboHits,
            p2ComboDamage: engine.p2.comboDamage,
            p2ComboWindow: Math.max(0, Math.min(1, (engine.p2.comboTimer ?? 0) / GameEngine.COMBO_WINDOW_SEC)),
            p2Action: engine.p2.action,
            p2Overdrive: engine.p2.overdriveArmed,
            timer: engine.roundTimeRemaining,
            roundNumber: engine.roundNumber,
            announceText: engine.roundAnnounceText,
            matchState: engine.matchState,
            activeArenaId: engine.arena.id,
            activeP2Char: engine.p2.characterId,
            infinityZone: engine.infinityZoneIndex + 1,
            infinityDefeated: engine.infinityDefeatedCount,
            infinityRunCoins: engine.infinityRunCoins,
            infinityTotalCoins: engine.infinityTotalCoins,
            infinityZoneCleared: engine.infinityZoneCleared,
            infinityEnemyActive: engine.infinityEnemyActive,
            infinityUnlocked: Array.from(engine.infinityAchievementsUnlocked),
            onlineMatchFormat: engine.onlineMatchFormat,
            onlineRoundsToWin: engine.onlineRoundsToWin,
            onlineRoundTimerSec: engine.onlineRoundTimerSec,
            onlineP1Coins: engine.onlineP1ZoneCoins,
            onlineP2Coins: engine.onlineP2ZoneCoins,
            onlineAllies: engine.onlineAllies.map(a => ({
              name: a.name,
              characterId: a.characterId,
              health: a.health,
              maxHealth: a.maxHealth,
              damageGhost: a.damageGhost,
              superMeter: a.superMeter,
              isDead: Boolean(a.isDead),
              reviveProgress: a.reviveProgress ?? 0,
              comboHits: a.comboHits,
              comboDamage: a.comboDamage,
              comboWindow: Math.max(0, Math.min(1, (a.comboTimer ?? 0) / GameEngine.COMBO_WINDOW_SEC)),
              overdrive: a.overdriveArmed,
            })),
            onlineEnemies: engine.onlineEnemies.map(e => ({
              name: e.name,
              characterId: e.characterId,
              health: e.health,
              maxHealth: e.maxHealth,
              damageGhost: e.damageGhost,
              isDead: Boolean(e.isDead),
            })),
            onlineCanReviveNow: engine.onlineCanReviveNow,
            onlineLocalIsDead: Boolean(
              engine.mode === 'ONLINE' &&
                engine.onlineMatchFormat === 'infinity' &&
                localAlly &&
                (localAlly.isDead || localAlly.health <= 0)
            ),
            onlineNearDeadAlly: nearDeadAlly,
            onlineInfinityZone: engine.onlineInfinityZone,
            onlineInfinityDefeated: engine.onlineInfinityDefeated,
            onlineInfinityZoneCleared: engine.onlineInfinityZoneCleared,
          });
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [getArenaImage, localOnlineSide, onMatchOver]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaused) return;
    if (mode === 'ONLINE' && !isNetOnlineRef.current) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button') || targetEl.closest('[data-touch-hud]')) return;
    if (Date.now() - lastTouchAtRef.current < 700) return;

    if (mode === 'ONLINE') {
      if (e.button === 0) {
        onlineQueuedRef.current.power1 = true;
        flushOnlineInput();
      } else if (e.button === 2) {
        e.preventDefault();
        onlineQueuedRef.current.power2 = true;
        flushOnlineInput();
      }
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

    if (e.button === 0) {
      engine.handleMouseDown(0);
    } else if (e.button === 2) {
      e.preventDefault();
      engine.handleMouseDown(2);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'ONLINE') return;
    if (Date.now() - lastTouchAtRef.current < 700) return;
    engineRef.current?.handleMouseUp(e.button);
  };

  const handleRematch = () => {
    if (mode === 'ONLINE') return;
    setIsPaused(false);
    isPausedRef.current = false;
    matchOverReportedRef.current = false;
    const engine = new GameEngine(p1Char, p2Char, ARENAS[arenaId], settingsRef.current, mode);
    const canvas = canvasRef.current;
    if (canvas && canvas.height > 0) {
      engine.viewportW = canvas.width;
      engine.viewportH = canvas.height;
      engine.viewportAspect = canvas.width / canvas.height;
    } else {
      engine.viewportW = 960;
      engine.viewportH = 540;
      engine.viewportAspect = window.innerWidth / Math.max(1, window.innerHeight);
    }
    engineRef.current = engine;
    soundManager.playUiSelect();
  };

  const setVirtualKey = (key: string, pressed: boolean) => {
    if (isPausedRef.current) return;
    if (mode === 'ONLINE') {
      if (!isNetOnlineRef.current) return;
      const lower = key === ' ' ? ' ' : key.toLowerCase();
      if (pressed) {
        onlineHeldKeysRef.current.add(lower);
      } else {
        onlineHeldKeysRef.current.delete(lower);
      }
      flushOnlineInput();
      return;
    }
    if (!engineRef.current) return;
    if (pressed) {
      engineRef.current.handleKeyDown(key);
    } else {
      engineRef.current.handleKeyUp(key);
    }
  };

  const applyTouchMoveDir = (dir: -1 | 0 | 1) => {
    setTouchMoveDir(dir);
    if (mode === 'ONLINE') {
      if (!isNetOnlineRef.current) return;
      onlineTouchDirRef.current = dir;
      flushOnlineInput();
      return;
    }
    engineRef.current?.setTouchJoystick(dir, false, false);
  };

  const updateMoveDirFromPointer = (clientX: number) => {
    const pad = movePadRef.current;
    if (!pad || isPausedRef.current) return;
    if (mode === 'ONLINE' && !isNetOnlineRef.current) return;
    const rect = pad.getBoundingClientRect();
    const midX = rect.left + rect.width * 0.5;
    applyTouchMoveDir(clientX < midX ? -1 : 1);
  };

  const resetTouchMove = () => {
    movePointerIdRef.current = null;
    applyTouchMoveDir(0);
  };

  const toastDef = activeToast ? INFINITY_ACHIEVEMENTS.find(a => a.id === activeToast) : null;
  const isSfxMuted = settings.soundMuted;
  const isMusicMuted = settings.musicMuted;
  const localSuper = isOnline && localOnlineSide === 'p2' ? hud.p2Super : hud.p1Super;
  const localOverdrive = isOnline && localOnlineSide === 'p2' ? hud.p2Overdrive : hud.p1Overdrive;
  const chargePct = Math.max(0, Math.min(100, Math.floor(localSuper)));
  const chargeCircumference = 2 * Math.PI * 22;
  const chargeDashOffset = chargeCircumference * (1 - chargePct / 100);

  return (
    <div
      data-device={deviceType}
      onTouchStartCapture={() => {
        lastTouchAtRef.current = Date.now();
      }}
      onPointerDownCapture={e => {
        if (e.pointerType === 'touch') lastTouchAtRef.current = Date.now();
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={e => e.preventDefault()}
      className="relative w-full h-[100dvh] overflow-hidden bg-slate-950 select-none flex items-center justify-center"
    >
      {/* Full-Viewport Crisp Pixel Stage Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-full block pixelated"
      />

      {/* TOP ARCADE HUD */}
      <header className="absolute top-0 left-0 right-0 z-20 px-2 sm:px-8 pt-2 sm:pt-4 pointer-events-none">
        {isOnline && hud.onlineMatchFormat === 'infinity' && hud.onlineAllies.length > 0 ? (
          <div className="max-w-6xl mx-auto grid grid-cols-[1fr_auto_1fr] items-start gap-1.5 sm:gap-4">
            {/* ALLIES TEAM HUD (1P Solo or 2P Co-op) */}
            <div className="min-w-0 space-y-1.5">
              {hud.onlineAllies.map((ally, idx) => {
                const charDef = CHARACTERS[ally.characterId] || p1Def;
                const hpPct = Math.max(0, Math.min(100, (ally.health / Math.max(1, ally.maxHealth)) * 100));
                const ghostPct = Math.max(0, Math.min(100, (ally.damageGhost / Math.max(1, ally.maxHealth)) * 100));
                const isYou = (localOnlineSide === 'p1' && idx === 0) || (localOnlineSide === 'p2' && idx === 1);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <img
                        src={charDef.portraitUrl}
                        alt={charDef.name}
                        referrerPolicy="no-referrer"
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded border-2 object-contain pixelated bg-slate-900 shrink-0 ${
                          ally.isDead ? 'border-rose-500 grayscale opacity-60' : 'border-amber-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-pixel text-[9px] sm:text-[11px] text-yellow-300 arcade-text-shadow truncate">
                            {ally.name}{isYou ? ' (YOU)' : ''}
                          </span>
                          <span
                            className={`font-pixel text-[9px] tabular-nums ${
                              ally.isDead ? 'text-rose-400 font-bold' : 'text-slate-200'
                            }`}
                          >
                            {ally.isDead ? 'DEAD' : Math.ceil(ally.health)}
                          </span>
                        </div>
                        <div className="relative h-3.5 bg-slate-950/90 border-2 border-amber-400 rounded-xs overflow-hidden">
                          <div
                            className="absolute top-0 right-0 bottom-0 bg-white/80 transition-all duration-75"
                            style={{ width: `${ghostPct}%` }}
                          />
                          <div
                            className={`absolute top-0 right-0 bottom-0 transition-all duration-75 ${
                              hpPct > 30 ? 'bg-gradient-to-l from-amber-400 to-yellow-300' : 'bg-red-500 animate-pulse'
                            }`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-950 border border-cyan-500/50 rounded-xs overflow-hidden">
                            <div
                              className="h-full bg-sky-400 transition-all duration-75"
                              style={{ width: `${ally.overdrive ? 100 : Math.min(100, ally.superMeter)}%` }}
                            />
                          </div>
                          <span className="font-pixel text-[7px] text-cyan-300 tabular-nums">
                            {ally.overdrive ? '70 DMG!' : `${Math.floor(ally.superMeter)}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                    {ally.comboHits >= 2 && ally.comboWindow > 0 && (
                      <div className="inline-block px-2.5 py-1 rounded bg-slate-950/90 border border-amber-400">
                        <span className="font-pixel text-sm text-yellow-300 mr-1.5">{ally.comboHits}</span>
                        <span className="font-pixel text-[9px] text-amber-200">COMBO +{ally.comboDamage} DMG</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CENTER ZONE & COINS */}
            <div className="flex flex-col items-center justify-center pt-0.5 shrink-0 min-w-[54px] sm:min-w-[84px]">
              <span className="font-pixel text-[8px] sm:text-[9px] text-amber-300 tracking-wider whitespace-nowrap">
                ZONE {hud.onlineInfinityZone}
              </span>
              <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 mt-0.5 rounded bg-slate-950/90 border-2 border-amber-500/80 font-pixel text-sm sm:text-xl text-white tabular-nums shadow-lg">
                ∞
              </div>
              <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded bg-black/95 border border-white flex items-center gap-1 shadow">
                <span className="inline-flex items-center justify-center w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-black border border-white font-mono text-[7px] sm:text-[8px] font-black text-white leading-none">
                  V
                </span>
                <span className="font-pixel text-[8px] sm:text-[9px] text-white tabular-nums">
                  +{localOnlineSide === 'p2' ? hud.onlineP2Coins : hud.onlineP1Coins}
                </span>
              </div>
              <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded bg-slate-950/80 border border-amber-500/40 font-pixel text-[6px] sm:text-[7px] text-amber-200 max-w-[74px] sm:max-w-none truncate">
                {activeArena.name}
              </div>
            </div>

            {/* ENEMIES TEAM HUD */}
            <div className="min-w-0 space-y-1.5">
              {hud.onlineEnemies.map((enemy, idx) => {
                const charDef = CHARACTERS[enemy.characterId] || activeP2Def;
                const hpPct = Math.max(0, Math.min(100, (enemy.health / Math.max(1, enemy.maxHealth)) * 100));
                const ghostPct = Math.max(0, Math.min(100, (enemy.damageGhost / Math.max(1, enemy.maxHealth)) * 100));
                return (
                  <div key={idx} className="flex items-center gap-2 flex-row-reverse">
                    <img
                      src={charDef.portraitUrl}
                      alt={charDef.name}
                      referrerPolicy="no-referrer"
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded border-2 object-contain pixelated bg-slate-900 shrink-0 ${
                        enemy.isDead ? 'border-slate-600 grayscale opacity-50' : 'border-red-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-row-reverse mb-0.5">
                        <span className="font-pixel text-[9px] sm:text-[11px] text-red-300 arcade-text-shadow truncate">
                          {charDef.name} (CPU)
                        </span>
                        <span className="font-pixel text-[9px] text-slate-300 tabular-nums">
                          {enemy.isDead ? 'KO' : Math.ceil(enemy.health)}
                        </span>
                      </div>
                      <div className="relative h-3.5 bg-slate-950/90 border-2 border-red-500 rounded-xs overflow-hidden">
                        <div
                          className="absolute top-0 left-0 bottom-0 bg-white/80 transition-all duration-75"
                          style={{ width: `${ghostPct}%` }}
                        />
                        <div
                          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-75"
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-[1fr_auto_1fr] items-start gap-1.5 sm:gap-4">
          {/* PLAYER 1 HUD */}
          <div className="min-w-0 flex flex-col gap-1 sm:gap-1.5">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <img
                src={p1Def.portraitUrl}
                alt={p1Def.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 sm:w-14 sm:h-14 rounded border-2 border-amber-400 object-contain pixelated bg-slate-900 shadow-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-pixel text-[11px] sm:text-xs text-yellow-300 arcade-text-shadow truncate">
                    {p1DisplayLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-pixel text-slate-300 tabular-nums">
                      {Math.ceil(hud.p1Health)}
                    </span>
                    {mode === 'INFINITY' ? (
                      <span className="font-pixel text-[9px] text-amber-300 tabular-nums">
                        KO {hud.infinityDefeated}
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        {Array.from({ length: isOnline ? hud.onlineRoundsToWin : settings.roundsToWin }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`w-2.5 h-2.5 rounded-full border border-yellow-300 ${
                              idx < hud.p1Wins ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-slate-900/80'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Health Bar with White Damage Ghost */}
                <div className="relative h-4 sm:h-5 bg-slate-950/90 border-2 border-amber-400 rounded-xs overflow-hidden shadow-inner">
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-white/80 transition-all duration-75"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.p1Ghost / Math.max(1, hud.p1MaxHealth)) * 100))}%` }}
                  />
                  <div
                    className={`absolute top-0 right-0 bottom-0 transition-all duration-75 ${
                      (hud.p1Health / Math.max(1, hud.p1MaxHealth)) * 100 > 30 ? 'bg-gradient-to-l from-amber-400 to-yellow-300' : 'bg-red-500 animate-pulse'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, (hud.p1Health / Math.max(1, hud.p1MaxHealth)) * 100))}%` }}
                  />
                </div>

                {/* Super / 70-DMG Overdrive Meter */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-950 border border-cyan-500/60 rounded-xs overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hud.p1Overdrive
                          ? 'bg-gradient-to-r from-amber-300 via-yellow-200 to-white animate-pulse'
                          : hud.p1Super >= 100
                            ? 'bg-gradient-to-r from-cyan-300 via-white to-sky-400 animate-pulse'
                            : 'bg-sky-500'
                      }`}
                      style={{ width: `${hud.p1Overdrive ? 100 : Math.min(100, hud.p1Super)}%` }}
                    />
                  </div>
                  <span
                    className={`font-pixel text-[8px] tabular-nums whitespace-nowrap ${
                      hud.p1Overdrive
                        ? 'text-yellow-300 animate-pulse'
                        : hud.p1Super >= 100
                          ? 'text-cyan-200'
                          : 'text-cyan-300'
                    }`}
                  >
                    {hud.p1Overdrive ? '⚡ 70 DMG READY!' : hud.p1Super >= 100 ? 'MAX READY!' : `${Math.floor(hud.p1Super)}%`}
                  </span>
                </div>
              </div>
            </div>

            {hud.p1Combo >= 2 && hud.p1ComboWindow > 0 && (
              <div
                key={`p1-combo-${hud.p1Combo}`}
                className="self-start mt-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border-2 border-amber-400 shadow-[0_0_20px_rgba(250,204,21,0.4)] backdrop-blur-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-pixel text-xl sm:text-2xl text-yellow-300 arcade-gold-shadow leading-none tabular-nums">
                    {hud.p1Combo}
                  </span>
                  <div className="flex flex-col leading-none">
                    <span className="font-pixel text-[10px] sm:text-xs text-amber-200 tracking-wider">
                      COMBO
                    </span>
                    <span className="font-pixel text-[8px] text-cyan-300 mt-0.5 tabular-nums">
                      +{hud.p1ComboDamage} DMG
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-28 sm:w-32 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-white transition-[width] duration-75"
                    style={{ width: `${Math.round(hud.p1ComboWindow * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* CENTER TIMER / ZONE & V-COIN COUNTER */}
          <div className="flex flex-col items-center justify-center pt-0.5 shrink-0 min-w-[54px] sm:min-w-[84px]">
            {mode === 'INFINITY' ? (
              <>
                <span className="font-pixel text-[7px] sm:text-[9px] text-amber-300 tracking-wider whitespace-nowrap">
                  ZONE {hud.infinityZone}
                </span>
                <div className="mt-0.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-black/95 border-2 border-white flex items-center gap-1 sm:gap-1.5 shadow-lg">
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-black border border-white font-mono text-[8px] sm:text-[10px] font-black text-white leading-none">
                    V
                  </span>
                  <span className="font-pixel text-[10px] sm:text-sm text-white tabular-nums">
                    {hud.infinityRunCoins}
                  </span>
                </div>
                <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded bg-slate-950/80 border border-amber-500/40 font-pixel text-[6px] sm:text-[8px] text-amber-200 tracking-wide max-w-[74px] sm:max-w-none truncate shadow">
                  {activeArena.name}
                </div>
              </>
            ) : (
              <>
                <span className="font-pixel text-[7px] sm:text-[9px] text-amber-300 tracking-wider whitespace-nowrap">
                  {isOnline && hud.onlineMatchFormat === 'infinity' ? `ZONE ${hud.roundNumber}` : `R${hud.roundNumber}`}
                </span>
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 mt-0.5 rounded bg-slate-950/90 border-2 border-amber-500/80 font-pixel text-sm sm:text-xl text-white tabular-nums shadow-lg">
                  {mode === 'TRAINING' ||
                  (!isOnline && settings.roundTimerSec === 0) ||
                  (isOnline && (hud.onlineMatchFormat === 'infinity' || hud.onlineRoundTimerSec === 0))
                    ? '∞'
                    : String(hud.timer).padStart(2, '0')}
                </div>
                <div className="mt-1 px-1.5 sm:px-2 py-0.5 rounded bg-slate-950/80 border border-amber-500/40 font-pixel text-[6px] sm:text-[8px] text-amber-200 tracking-wide max-w-[74px] sm:max-w-none truncate shadow">
                  {activeArena.name}
                </div>
              </>
            )}
          </div>

          {/* PLAYER 2 / CPU / CHALLENGER HUD */}
          <div className="min-w-0 flex flex-col gap-1 sm:gap-1.5">
            {mode === 'INFINITY' && !hud.infinityEnemyActive ? (
              <div className="flex items-center justify-end gap-2 pt-2">
                <div className="px-3 py-1.5 rounded-lg bg-slate-950/85 border border-amber-400/70 font-pixel text-[9px] text-amber-200 flex items-center gap-1.5 animate-pulse">
                  <span>ADVANCE TO NEXT ZONE</span>
                  <ArrowRight className="w-3.5 h-3.5 text-yellow-300" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2.5 flex-row-reverse">
                  <img
                    src={activeP2Def.portraitUrl}
                    alt={activeP2Def.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 sm:w-14 sm:h-14 rounded border-2 border-red-500 object-contain pixelated bg-slate-900 shadow-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-row-reverse mb-1">
                      <span className="font-pixel text-[11px] sm:text-xs text-red-300 arcade-text-shadow truncate">
                        {p2DisplayLabel}
                      </span>
                      <div className="flex items-center gap-1.5 flex-row-reverse">
                        <span className="text-[10px] font-pixel text-slate-300 tabular-nums">
                          {Math.ceil(hud.p2Health)}
                        </span>
                        {mode === 'INFINITY' ? (
                          <span className="font-pixel text-[9px] text-red-300 tabular-nums">
                            #{hud.infinityDefeated + 1}
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            {Array.from({ length: isOnline ? hud.onlineRoundsToWin : settings.roundsToWin }).map((_, idx) => (
                              <span
                                key={idx}
                                className={`w-2.5 h-2.5 rounded-full border border-red-400 ${
                                  idx < hud.p2Wins ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-slate-900/80'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Health Bar */}
                    <div className="relative h-4 sm:h-5 bg-slate-950/90 border-2 border-red-500 rounded-xs overflow-hidden shadow-inner">
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-white/80 transition-all duration-75"
                        style={{ width: `${Math.max(0, Math.min(100, (hud.p2Ghost / Math.max(1, hud.p2MaxHealth)) * 100))}%` }}
                      />
                      <div
                        className={`absolute top-0 left-0 bottom-0 transition-all duration-75 ${
                          (hud.p2Health / Math.max(1, hud.p2MaxHealth)) * 100 > 30 ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-red-600 animate-pulse'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (hud.p2Health / Math.max(1, hud.p2MaxHealth)) * 100))}%` }}
                      />
                    </div>

                    {/* Super / 70-DMG Overdrive Meter */}
                    <div className="mt-1 flex items-center gap-2 flex-row-reverse">
                      <div className="flex-1 h-2 bg-slate-950 border border-orange-500/60 rounded-xs overflow-hidden">
                        <div
                          className={`h-full transition-all duration-75 ml-auto ${
                            hud.p2Overdrive
                              ? 'bg-gradient-to-l from-amber-300 via-yellow-200 to-white animate-pulse'
                              : hud.p2Super >= 100
                                ? 'bg-gradient-to-l from-orange-400 via-yellow-300 to-red-500 animate-pulse'
                                : 'bg-orange-500'
                          }`}
                          style={{ width: `${hud.p2Overdrive ? 100 : Math.min(100, hud.p2Super)}%` }}
                        />
                      </div>
                      <span
                        className={`font-pixel text-[8px] tabular-nums whitespace-nowrap ${
                          hud.p2Overdrive ? 'text-yellow-300 animate-pulse' : 'text-orange-300'
                        }`}
                      >
                        {hud.p2Overdrive ? '⚡ 70 DMG READY!' : hud.p2Super >= 100 ? 'MAX' : `${Math.floor(hud.p2Super)}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {hud.p2Combo >= 2 && hud.p2ComboWindow > 0 && (
                  <div
                    key={`p2-combo-${hud.p2Combo}`}
                    className="self-end mt-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-xs"
                  >
                    <div className="flex items-baseline justify-end gap-2">
                      <div className="flex flex-col items-end leading-none">
                        <span className="font-pixel text-[10px] sm:text-xs text-red-200 tracking-wider">
                          COMBO
                        </span>
                        <span className="font-pixel text-[8px] text-orange-300 mt-0.5 tabular-nums">
                          +{hud.p2ComboDamage} DMG
                        </span>
                      </div>
                      <span className="font-pixel text-xl sm:text-2xl text-red-400 arcade-red-shadow leading-none tabular-nums">
                        {hud.p2Combo}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-28 sm:w-32 rounded-full bg-slate-800 overflow-hidden ml-auto">
                      <div
                        className="h-full bg-gradient-to-l from-red-500 via-orange-400 to-yellow-300 ml-auto transition-[width] duration-75"
                        style={{ width: `${Math.round(hud.p2ComboWindow * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )}

        {/* Top Corner Quick Actions (Docked safely directly beneath top HUD bars) */}
        <div className="max-w-6xl mx-auto mt-1.5 flex items-center justify-end gap-1.5 sm:gap-2 pointer-events-auto">
          {mode === 'INFINITY' && (
            <button
              onClick={togglePause}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded bg-slate-950/80 hover:bg-slate-800 border border-emerald-500/40 text-[9px] sm:text-[10px] font-pixel text-emerald-300 transition-colors cursor-pointer"
              title="View Infinity Achievements"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{hud.infinityUnlocked.length}/8</span>
            </button>
          )}
          <button
            onClick={() => {
              const muted = onToggleSound();
              if (!muted) {
                soundManager.playUiSelect();
              }
            }}
            className={`p-1.5 sm:p-2 rounded border transition-colors cursor-pointer ${
              isSfxMuted
                ? 'bg-red-950/85 hover:bg-red-900 border-red-500/80 text-red-300'
                : 'bg-slate-950/75 hover:bg-slate-800 border-slate-700 text-amber-300'
            }`}
            title={isSfxMuted ? 'Sound Effects Muted (Tap to Unmute)' : 'Sound Effects On (Tap to Mute)'}
          >
            {isSfxMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            onClick={togglePause}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded bg-slate-950/80 hover:bg-slate-800 border border-amber-500/50 text-[10px] sm:text-xs font-pixel text-amber-200 transition-colors cursor-pointer"
            title="Pause Match"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PAUSE</span>
          </button>
        </div>
      </header>

      {/* Achievement Unlock Notification Toast (Infinity Mode) */}
      {toastDef && (
        <div className="absolute top-24 left-4 z-30 px-4 py-2.5 rounded-lg bg-slate-950/95 border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.4)] flex items-center gap-3 pointer-events-none">
          <Award className="w-5 h-5 text-yellow-300 shrink-0" />
          <div>
            <div className="font-pixel text-[9px] text-amber-300">ACHIEVEMENT UNLOCKED</div>
            <div className="font-pixel text-[11px] text-white mt-0.5">{toastDef.title}</div>
          </div>
          <div className="ml-2 px-2 py-0.5 rounded bg-black border border-white font-pixel text-[9px] text-white">
            +{toastDef.rewardCoins} V
          </div>
        </div>
      )}

      {/* Directional Horizon Prompt when Zone is Cleared in Infinity Mode */}
      {mode === 'INFINITY' && hud.infinityZoneCleared && !hud.announceText && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center gap-2 px-4 py-2 rounded-lg bg-black/75 border-2 border-amber-400 text-amber-200 font-pixel text-xs shadow-xl animate-bounce">
          <span>NEXT ZONE</span>
          <ArrowRight className="w-4 h-4 text-yellow-300" />
        </div>
      )}

      {/* OPPONENT DISCONNECT / RECONNECT BANNER */}
      {isOnline && opponentReconnectBanner && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-amber-950/90 border-2 border-amber-400 text-amber-100 font-pixel text-[10px] shadow-xl animate-pulse whitespace-nowrap">
          {opponentReconnectBanner}
        </div>
      )}

      {/* DEAD OVERLAY FOR FALLEN CO-OP PLAYER (Arena stays visible behind it!) */}
      {isOnline && hud.onlineMatchFormat === 'infinity' && hud.onlineLocalIsDead && hud.matchState !== 'MATCH_OVER' && (
        <div className="absolute inset-x-0 top-1/3 z-25 flex flex-col items-center justify-center pointer-events-none px-4">
          <div className="px-8 py-5 rounded-2xl bg-red-950/85 border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.6)] text-center space-y-2 backdrop-blur-xs">
            <div className="font-pixel text-3xl sm:text-5xl text-red-400 tracking-widest arcade-red-shadow">
              DEAD
            </div>
            <div className="text-xs sm:text-sm text-red-100 font-semibold">
              {hud.onlineCanReviveNow
                ? 'Zone clear! Your teammate can stand near your body and hold the REVIVE button (or [Q]) for 5s.'
                : 'Your teammate must defeat all remaining enemies before reviving you.'}
            </div>
          </div>
        </div>
      )}

      {/* CENTER ROUND / ZONE ANNOUNCEMENT */}
      {hud.announceText && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="px-8 py-4 rounded-xl bg-black/60 border-2 border-yellow-400/80 shadow-[0_0_40px_rgba(250,204,21,0.45)] backdrop-blur-[2px] text-center space-y-1.5">
            {hud.matchState === 'INTRO' && (
              <div className="font-pixel text-[9px] sm:text-[11px] text-amber-200 tracking-widest">
                {p1DisplayLabel} VS {p2DisplayLabel} · {activeArena.name}
              </div>
            )}
            <div className="font-pixel text-2xl sm:text-5xl text-yellow-300 arcade-gold-shadow tracking-wider">
              {hud.announceText}
            </div>
          </div>
        </div>
      )}

      {/* AAA MOBILE COMBAT HUD CONTROLS: Auto Mobile/Tablet + Runtime Touch + Manual Toggle */}
      {showTouchControls && !isPaused && !hud.onlineLocalIsDead && (!isOnline || isNetOnline) && (
        <div
          data-touch-hud="true"
          className="absolute inset-x-2.5 sm:inset-x-7 bottom-3 sm:bottom-6 z-30 flex items-end justify-between pointer-events-none select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Bottom-Left: Pro Mobile Virtual Horizontal Rocker / Sliding Puck */}
          <div
            ref={movePadRef}
            data-touch-hud="true"
            onPointerDown={e => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              movePointerIdRef.current = e.pointerId;
              updateMoveDirFromPointer(e.clientX);
            }}
            onPointerMove={e => {
              if (movePointerIdRef.current === e.pointerId) {
                e.preventDefault();
                updateMoveDirFromPointer(e.clientX);
              }
            }}
            onPointerUp={e => {
              if (movePointerIdRef.current === e.pointerId) {
                resetTouchMove();
              }
            }}
            onPointerCancel={resetTouchMove}
            className="pointer-events-auto relative w-34 sm:w-42 h-14 sm:h-16 rounded-full bg-slate-950/25 border border-white/25 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_6px_24px_rgba(0,0,0,0.35)] flex items-center justify-between px-2.5 sm:px-3 cursor-pointer"
            style={{ touchAction: 'none' }}
          >
            {/* Subtle center axis hairline */}
            <div className="absolute left-1/2 top-3 bottom-3 w-px bg-white/10 -translate-x-1/2 pointer-events-none" />

            {/* Left Chevron Guide */}
            <ChevronLeft
              className={`w-5 h-5 transition-all pointer-events-none ${
                touchMoveDir === -1 ? 'text-amber-300 scale-110' : 'text-white/55'
              }`}
              strokeWidth={2.5}
            />

            {/* Floating Translucent Thumb Puck (Glides smoothly under thumb) */}
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border backdrop-blur-md flex items-center justify-center transition-all duration-100 pointer-events-none ${
                touchMoveDir !== 0
                  ? 'bg-amber-400/45 border-yellow-200/90 shadow-[0_0_18px_rgba(251,191,36,0.5)]'
                  : 'bg-white/15 border-white/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.35)]'
              }`}
              style={{
                transform: `translateX(${touchMoveDir * 36}px)`,
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white/80 shadow-sm" />
            </div>

            {/* Right Chevron Guide */}
            <ChevronRight
              className={`w-5 h-5 transition-all pointer-events-none ${
                touchMoveDir === 1 ? 'text-amber-300 scale-110' : 'text-white/55'
              }`}
              strokeWidth={2.5}
            />
          </div>

          {/* Bottom-Right: AAA Ergonomic Corner Action Cluster (JUMP Anchor + ATK 1/2 + Overdrive) */}
          <div data-touch-hud="true" className="pointer-events-auto relative w-48 h-42 sm:w-56 sm:h-48">
            {/* Inner Arc Left (ATK 1) */}
            <button
              type="button"
              aria-label="Move 1"
              onPointerDown={e => {
                e.preventDefault();
                if (mode === 'ONLINE') {
                  onlineQueuedRef.current.power1 = true;
                  flushOnlineInput();
                } else {
                  engineRef.current?.handleMouseDown(0);
                }
              }}
              onPointerUp={() => {
                if (mode !== 'ONLINE') engineRef.current?.handleMouseUp(0);
              }}
              onPointerCancel={() => {
                if (mode !== 'ONLINE') engineRef.current?.handleMouseUp(0);
              }}
              className="absolute left-5 bottom-8 w-14 h-14 sm:left-6 sm:bottom-9 sm:w-15 sm:h-15 rounded-full bg-slate-950/25 active:bg-amber-400/50 border-2 border-amber-300/60 ring-1 ring-inset ring-white/15 backdrop-blur-md text-amber-100 active:text-white flex flex-col items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform active:scale-90 cursor-pointer"
              style={{ touchAction: 'none' }}
            >
              <Swords className="w-4 h-4 drop-shadow" />
              <span className="font-pixel text-[6px] mt-0.5 text-white/90">ATK 1</span>
            </button>

            {/* Upper Arc Top-Right (ATK 2) */}
            <button
              type="button"
              aria-label="Move 2"
              onPointerDown={e => {
                e.preventDefault();
                if (mode === 'ONLINE') {
                  onlineQueuedRef.current.power2 = true;
                  flushOnlineInput();
                } else {
                  engineRef.current?.handleMouseDown(2);
                }
              }}
              onPointerUp={() => {
                if (mode !== 'ONLINE') engineRef.current?.handleMouseUp(2);
              }}
              onPointerCancel={() => {
                if (mode !== 'ONLINE') engineRef.current?.handleMouseUp(2);
              }}
              className="absolute right-2 top-1 w-14 h-14 sm:right-3 sm:top-2 sm:w-15 sm:h-15 rounded-full bg-slate-950/25 active:bg-rose-500/55 border-2 border-rose-400/60 ring-1 ring-inset ring-white/15 backdrop-blur-md text-rose-100 active:text-white flex flex-col items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform active:scale-90 cursor-pointer"
              style={{ touchAction: 'none' }}
            >
              <Flame className="w-4 h-4 drop-shadow" />
              <span className="font-pixel text-[6px] mt-0.5 text-white/90">ATK 2</span>
            </button>

            {/* Primary Corner Thumb Anchor — Large Double-Bezel Frosted JUMP Button */}
            <button
              type="button"
              aria-label="Jump"
              onPointerDown={e => {
                e.preventDefault();
                setVirtualKey(' ', true);
              }}
              onPointerUp={() => setVirtualKey(' ', false)}
              onPointerLeave={() => setVirtualKey(' ', false)}
              onPointerCancel={() => setVirtualKey(' ', false)}
              className="absolute right-0 bottom-0 w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-slate-950/25 active:bg-emerald-400/50 border-2 border-white/45 ring-2 ring-inset ring-emerald-300/30 backdrop-blur-md text-white flex flex-col items-center justify-center shadow-[0_6px_24px_rgba(0,0,0,0.4)] transition-transform active:scale-90 cursor-pointer"
              style={{ touchAction: 'none' }}
            >
              <ChevronUp className="w-7 h-7 -mb-0.5 drop-shadow" strokeWidth={2.75} />
              <span className="font-pixel text-[7px] tracking-wider text-emerald-200">JUMP</span>
            </button>

            {/* Outer Upper-Left Ultimate Arc — Circular 100% Power Overdrive Medallion */}
            <button
              type="button"
              aria-label="100% Power Ability"
              disabled={localSuper < 100 && !localOverdrive}
              onPointerDown={e => {
                e.preventDefault();
                if (localSuper >= 100 && !localOverdrive) {
                  if (mode === 'ONLINE') {
                    onlineQueuedRef.current.overdrive = true;
                    flushOnlineInput();
                  } else {
                    engineRef.current?.activateOverdrive('p1');
                  }
                }
              }}
              className={`absolute left-11 top-0 w-12 h-12 sm:left-13 sm:top-1 sm:w-14 sm:h-14 rounded-full backdrop-blur-md flex flex-col items-center justify-center transition-all ${
                localOverdrive
                  ? 'bg-amber-400/55 border-2 border-yellow-200 text-slate-950 shadow-[0_0_22px_rgba(250,204,21,0.75)] animate-pulse'
                  : localSuper >= 100
                  ? 'bg-yellow-400/40 border-2 border-yellow-200 text-white shadow-[0_0_20px_rgba(251,191,36,0.65)] animate-pulse active:scale-90 cursor-pointer'
                  : 'bg-slate-950/25 border border-white/20 text-white/60 cursor-not-allowed'
              }`}
              style={{ touchAction: 'none' }}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 52 52">
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke={localOverdrive || localSuper >= 100 ? '#fde047' : '#38bdf8'}
                  strokeWidth="2.5"
                  strokeDasharray={chargeCircumference}
                  strokeDashoffset={localOverdrive ? 0 : chargeDashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <Zap className="w-3.5 h-3.5 relative z-10 drop-shadow" />
              <span className="font-pixel text-[6px] relative z-10 mt-0.5 tabular-nums">
                {localOverdrive ? '70!' : localSuper >= 100 ? 'MAX' : `${chargePct}%`}
              </span>
            </button>

            {/* Conditional Co-op Revive Hold Button when standing over dead ally in cleared zone */}
            {isOnline && hud.onlineMatchFormat === 'infinity' && hud.onlineCanReviveNow && hud.onlineNearDeadAlly && (
              <button
                type="button"
                aria-label="Hold to Revive Teammate"
                onPointerDown={e => {
                  e.preventDefault();
                  onlineTouchReviveRef.current = true;
                  flushOnlineInput();
                }}
                onPointerUp={() => {
                  onlineTouchReviveRef.current = false;
                  flushOnlineInput();
                }}
                onPointerLeave={() => {
                  onlineTouchReviveRef.current = false;
                  flushOnlineInput();
                }}
                onPointerCancel={() => {
                  onlineTouchReviveRef.current = false;
                  flushOnlineInput();
                }}
                className="absolute right-0 -top-11 px-3 py-2 rounded-xl bg-emerald-500/90 active:bg-emerald-400 border-2 border-emerald-200 text-slate-950 font-pixel text-[8px] font-black shadow-[0_0_24px_rgba(52,211,153,0.75)] animate-pulse cursor-pointer whitespace-nowrap"
                style={{ touchAction: 'none' }}
              >
                HOLD REVIVE (5s)
              </button>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar bg-slate-900 border-2 border-amber-500 rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="font-pixel text-xl text-yellow-300 arcade-gold-shadow">PAUSED</div>
              <div className="text-xs text-slate-400 mt-1">{activeArena.name}</div>
            </div>

            {mode === 'INFINITY' && (
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-pixel text-amber-300">
                  <span>ACHIEVEMENTS ({hud.infinityUnlocked.length}/{INFINITY_ACHIEVEMENTS.length})</span>
                  <span className="text-white">TOTAL V: {hud.infinityTotalCoins}</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {INFINITY_ACHIEVEMENTS.map(ach => {
                    const unlocked = hud.infinityUnlocked.includes(ach.id);
                    return (
                      <div
                        key={ach.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-[10px] ${
                          unlocked
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                            : 'bg-slate-900/70 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="font-pixel truncate mr-2">{ach.title}</span>
                        <span className="font-pixel text-[9px] shrink-0">
                          {unlocked ? '✓' : `+${ach.rewardCoins}V`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                onClick={togglePause}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-pixel text-xs font-bold flex items-center justify-center gap-2 border border-yellow-200"
              >
                <Play className="w-4 h-4" />
                <span>{isOnline ? 'BACK TO MATCH' : 'RESUME'}</span>
              </button>

              {!isOnline && (
                <>
                  <button
                    onClick={handleRematch}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-xs flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>{mode === 'INFINITY' ? 'RESTART INFINITY' : 'RESTART ROUND'}</span>
                  </button>

                  <button
                    onClick={() => {
                      soundManager.playUiSelect();
                      onSelectFighters();
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-xs flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Users className="w-4 h-4 text-sky-400" />
                    <span>CHANGE FIGHTER</span>
                  </button>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const muted = onToggleSound();
                    if (!muted) {
                      soundManager.playUiSelect();
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-[10px] flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  {isSfxMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  <span>SFX: {isSfxMuted ? 'OFF' : 'ON'}</span>
                </button>

                <button
                  onClick={() => {
                    onToggleMusic();
                    if (!isSfxMuted) {
                      soundManager.playUiSelect();
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-[10px] flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <Music className={`w-3.5 h-3.5 shrink-0 ${isMusicMuted ? 'text-red-400' : 'text-sky-400'}`} />
                  <span>SONG: {isMusicMuted ? 'OFF' : 'ON'}</span>
                </button>
              </div>

              <button
                onClick={() => {
                  soundManager.playUiSelect();
                  if (isOnline) {
                    multiplayerClient.leaveRoom();
                  }
                  onReturnLobby();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-200 font-pixel text-xs flex items-center justify-center gap-2 border border-red-800"
              >
                <Home className="w-4 h-4" />
                <span>{isOnline ? 'LEAVE ONLINE MATCH' : 'RETURN TO LOBBY'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
