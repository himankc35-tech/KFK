import React, { useState, useCallback, useEffect } from 'react';
import { ArenaId, CharacterId, GameMode, GameSettings, GameState, UserAccountProfile } from './types/game';
import { soundManager } from './audio/soundManager';
import { ARENA_LIST } from './data/arenas';
import { CHARACTERS, STARTER_CHARACTER_IDS, applyCharacterCoinBonus, getCharacterUnlockCost } from './data/characters';
import {
  addTotalVCoins,
  addTotalXP,
  loadTotalVCoins,
  loadTotalXP,
  loadUnlockedCharacters,
  saveTotalVCoins,
  saveTotalXP,
  saveUnlockedCharacters,
} from './data/achievements';
import { preloadAllGameAssets } from './utils/assetLoader';
import { useDeviceProfile } from './utils/deviceDetector';
import {
  awardMatchRewards,
  fetchCurrentUser,
  getCachedUser,
  logoutAccount,
  syncWalletToAccount,
  unlockCharacterAccount,
} from './services/authClient';
import { supabase } from './lib/supabase';
import {
  fetchCurrentSupabaseUser,
  recordOnlineMatchToSupabase,
  setSupabaseWalletAfterPurchase,
  syncSupabaseWallet,
  updateOnlinePresenceStatus,
} from './services/supabaseService';
import { ActiveOnlineMatchContext, WsMatchOverPayload, multiplayerClient } from './services/multiplayerClient';
import { MainLobby } from './components/MainLobby';
import { CharacterSelect } from './components/CharacterSelect';
import { ArenaSelect } from './components/ArenaSelect';
import { FightingGameView } from './components/FightingGameView';
import { SettingsModal } from './components/SettingsModal';
import { InfinityRunSummary, RoundResultModal } from './components/RoundResultModal';
import { VisualReferenceModal } from './components/VisualReferenceModal';
import { ProfileModal } from './components/ProfileModal';
import { OnlineMultiplayerHub } from './components/OnlineMultiplayerHub';
import { OwnerPanelView } from './components/OwnerPanelView';
import { BannedAccountModal } from './components/BannedAccountModal';
import { NetworkRequiredModal, useOnlineConnectivity } from './components/NetworkRequiredModal';
import { RewardedBonusModal } from './components/AdOverlayModal';
import { RewardedAdBonusType, admobService } from './services/admobService';

const DEFEAT_MEME_STORAGE_KEY = 'fatal_clash_defeat_meme_idx';
const SETTINGS_STORAGE_KEY = 'fighter_xp_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  soundVolume: 1.0,
  musicVolume: 0.5,
  soundMuted: false,
  musicMuted: false,
  roundsToWin: 2,
  roundTimerSec: 99,
  difficulty: 'NORMAL',
  touchControls: 'on',
  audioDefaultsV2Applied: true,
};

function loadStoredSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const applyV2Defaults = !parsed.audioDefaultsV2Applied;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      soundVolume: applyV2Defaults ? 1.0 : (typeof parsed.soundVolume === 'number' ? parsed.soundVolume : 1.0),
      musicVolume: applyV2Defaults ? 0.5 : (typeof parsed.musicVolume === 'number' ? parsed.musicVolume : 0.5),
      soundMuted: Boolean(parsed.soundMuted),
      musicMuted: Boolean(parsed.musicMuted),
      touchControls: 'on',
      audioDefaultsV2Applied: true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readStoredMemeIdx(): number {
  try {
    const raw = window.localStorage.getItem(DEFEAT_MEME_STORAGE_KEY);
    const parsed = raw !== null ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed % 3 : 0;
  } catch {
    return 0;
  }
}

export function App() {
  const deviceProfile = useDeviceProfile();

  const [user, setUser] = useState<UserAccountProfile | null>(() => getCachedUser());
  const userRef = React.useRef(user);
  userRef.current = user;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'login' | 'signup'>('signup');

  const [totalCoins, setTotalCoins] = useState<number>(() => loadTotalVCoins());
  const [totalXP, setTotalXP] = useState<number>(() => loadTotalXP());
  const [unlockedCharacters, setUnlockedCharacters] = useState<CharacterId[]>(() => {
    const cached = getCachedUser();
    const cachedIsOwner = Boolean(cached && (cached.isOwner || cached.username.trim().toLowerCase() === 'himank'));
    return loadUnlockedCharacters(cachedIsOwner);
  });

  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [selectForInfinity, setSelectForInfinity] = useState(false);
  const [p1Char, setP1Char] = useState<CharacterId>('oggy');
  const [p2Char, setP2Char] = useState<CharacterId>('buster');
  const [mode, setMode] = useState<GameMode>('ARCADE');
  const [arenaId, setArenaId] = useState<ArenaId>('jungle_temple');
  const defeatMemeIdxRef = React.useRef<number>(readStoredMemeIdx());

  const [onlineMatchCtx, setOnlineMatchCtx] = useState<ActiveOnlineMatchContext | null>(null);

  const [matchResult, setMatchResult] = useState<{
    winner: 'p1' | 'p2';
    p1Wins: number;
    p2Wins: number;
    defeatMemeIndex: number | null;
    infinitySummary?: InfinityRunSummary | null;
    matchCoinsEarned?: number;
    matchXpEarned?: number;
    winReason?: string;
  } | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => loadStoredSettings());
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const gameStateRef = React.useRef(gameState);
  gameStateRef.current = gameState;

  const [rewardAdFocus, setRewardAdFocus] = useState<RewardedAdBonusType | null>(null);
  const [adPlaying, setAdPlaying] = useState(false);
  const postMatchAdPendingRef = React.useRef(false);

  const {
    isOnline: isNetOnline,
    checking: checkingNet,
    lastCheckFailed: netCheckFailed,
    recheck: recheckNet,
  } = useOnlineConnectivity();
  const isNetOnlineRef = React.useRef(isNetOnline);
  isNetOnlineRef.current = isNetOnline;

  const isOwner = Boolean(
    user && (user.isOwner || user.username.trim().toLowerCase() === 'himank')
  );

  const handleAuthChange = useCallback((nextUser: UserAccountProfile | null) => {
    setUser(nextUser);
    if (nextUser) {
      const nextIsOwner = Boolean(
        nextUser.isOwner || nextUser.username.trim().toLowerCase() === 'himank'
      );
      const isLocal = nextUser.authProvider !== 'supabase';
      const nextCoins = isLocal ? nextUser.vCoins : Math.max(loadTotalVCoins(), nextUser.vCoins);
      const nextXP = isLocal ? nextUser.xp : Math.max(loadTotalXP(), nextUser.xp);
      saveTotalVCoins(nextCoins);
      saveTotalXP(nextXP);
      setTotalCoins(nextCoins);
      setTotalXP(nextXP);
      const nextUnlocked =
        isLocal && Array.isArray(nextUser.unlockedCharacters)
          ? saveUnlockedCharacters(nextUser.unlockedCharacters, nextIsOwner)
          : saveUnlockedCharacters(
              [
                ...loadUnlockedCharacters(nextIsOwner),
                ...(nextUser.unlockedCharacters || []),
              ],
              nextIsOwner
            );
      setUnlockedCharacters(nextUnlocked);
      if (nextUser.authProvider === 'supabase') {
        void updateOnlinePresenceStatus(nextUser.id, true);
      }
    } else {
      multiplayerClient.disconnect();
      saveTotalVCoins(0);
      saveTotalXP(0);
      setTotalCoins(0);
      setTotalXP(0);
      const starters = saveUnlockedCharacters(STARTER_CHARACTER_IDS, false);
      setUnlockedCharacters(starters);
      setP1Char('oggy');
      setGameState(prev => (prev === 'OWNER_PANEL' ? 'LOBBY' : prev));
    }
  }, []);

  const syncWallet = useCallback(() => {
    const latestCoins = loadTotalVCoins();
    const latestXP = loadTotalXP();
    setTotalCoins(latestCoins);
    setTotalXP(latestXP);
    const activeUser = userRef.current;
    if (activeUser?.authProvider === 'supabase') {
      void syncSupabaseWallet(activeUser.id, latestCoins, latestXP);
    } else if (activeUser) {
      void fetchCurrentUser().then(fresh => {
        const cur = userRef.current;
        if (!fresh || !cur || cur.id !== fresh.id) return;
        const changed =
          fresh.vCoins !== cur.vCoins ||
          fresh.xp !== cur.xp ||
          (fresh.walletRevision ?? 0) !== (cur.walletRevision ?? 0) ||
          Boolean(fresh.banned) !== Boolean(cur.banned) ||
          Boolean(fresh.isOwner) !== Boolean(cur.isOwner) ||
          (fresh.unlockedCharacters || []).join(',') !== (cur.unlockedCharacters || []).join(',');
        if (changed) {
          handleAuthChange(fresh);
        }
      });
    }
  }, [handleAuthChange]);

  const handleUnlockCharacter = useCallback(
    async (charId: CharacterId): Promise<{ ok: boolean; error?: string }> => {
      const charDef = CHARACTERS[charId];
      if (charDef?.ownerOnly) {
        if (!isOwner) {
          return {
            ok: false,
            error: `${charDef.name} is Owner-Exclusive and locked for all other players.`,
          };
        }
        const merged = saveUnlockedCharacters([...loadUnlockedCharacters(true), charId], true);
        setUnlockedCharacters(merged);
        return { ok: true };
      }

      const cost = getCharacterUnlockCost(charId);
      const currentUnlocked = loadUnlockedCharacters(isOwner);
      if (currentUnlocked.includes(charId) || cost <= 0) {
        const merged = saveUnlockedCharacters([...currentUnlocked, charId], isOwner);
        setUnlockedCharacters(merged);
        return { ok: true };
      }

      const currentCoins = user && user.authProvider !== 'supabase'
        ? user.vCoins
        : Math.max(totalCoins, loadTotalVCoins());
      if (currentCoins < cost) {
        return {
          ok: false,
          error: `Need ${cost} V-Coins (${cost - currentCoins} more required).`,
        };
      }

      if (user && user.authProvider !== 'supabase') {
        try {
          if (currentCoins > user.vCoins) {
            await syncWalletToAccount(currentCoins, Math.max(totalXP, loadTotalXP()), user.walletRevision);
          }
          const updatedUser = await unlockCharacterAccount(charId);
          saveTotalVCoins(updatedUser.vCoins);
          const nextUnlocked = saveUnlockedCharacters(updatedUser.unlockedCharacters, isOwner);
          setTotalCoins(updatedUser.vCoins);
          setUnlockedCharacters(nextUnlocked);
          setUser(updatedUser);
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'Unable to unlock fighter right now.',
          };
        }
      }

      const nextCoins = Math.max(0, currentCoins - cost);
      saveTotalVCoins(nextCoins);
      const nextUnlocked = saveUnlockedCharacters([...currentUnlocked, charId], isOwner);
      setTotalCoins(nextCoins);
      setUnlockedCharacters(nextUnlocked);
      if (user?.authProvider === 'supabase') {
        void setSupabaseWalletAfterPurchase(user.id, nextCoins);
      }
      return { ok: true };
    },
    [isOwner, totalCoins, totalXP, user]
  );

  // Restore signed-in Supabase / local account session (never blocks offline play)
  useEffect(() => {
    let active = true;
    void fetchCurrentSupabaseUser().then(async supaRes => {
      if (!active) return;
      if (supaRes.user) {
        handleAuthChange(supaRes.user);
        return;
      }
      const existingLocal = await fetchCurrentUser();
      if (active && existingLocal) {
        handleAuthChange(existingLocal);
      }
    });

    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) {
        setUser(prev => (prev?.authProvider === 'supabase' ? null : prev));
      }
    });

    return () => {
      active = false;
      sub?.data.subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  // Real-time WebSocket listeners for Owner wallet edits & ban enforcement
  useEffect(() => {
    const unsub = multiplayerClient.subscribe(ev => {
      if (ev.type === 'account_updated' && ev.user) {
        const nextProfile = ev.user as UserAccountProfile;
        handleAuthChange(nextProfile);
      } else if (ev.type === 'account_banned') {
        const reason = typeof ev.reason === 'string' ? ev.reason : 'Suspended by Owner';
        setUser(prev => (prev ? { ...prev, banned: true, bannedReason: reason } : prev));
        setOnlineMatchCtx(null);
        setGameState(prev => (prev === 'ONLINE_HUB' || prev === 'OWNER_PANEL' ? 'LOBBY' : prev));
      }
    });
    return unsub;
  }, [handleAuthChange]);

  // Light periodic + window-focus refresh for signed-in local accounts so Owner edits & bans apply immediately even outside Online Arena
  useEffect(() => {
    const activeUserId = user?.id;
    const provider = user?.authProvider;
    if (!activeUserId || provider === 'supabase' || !isNetOnline) return;
    let active = true;

    const refreshAccount = async () => {
      const fresh = await fetchCurrentUser();
      const cur = userRef.current;
      if (!active || !fresh || !cur || cur.id !== fresh.id) return;
      const changed =
        fresh.vCoins !== cur.vCoins ||
        fresh.xp !== cur.xp ||
        (fresh.walletRevision ?? 0) !== (cur.walletRevision ?? 0) ||
        Boolean(fresh.banned) !== Boolean(cur.banned) ||
        Boolean(fresh.isOwner) !== Boolean(cur.isOwner) ||
        (fresh.unlockedCharacters || []).join(',') !== (cur.unlockedCharacters || []).join(',');
      if (changed) {
        handleAuthChange(fresh);
        if (fresh.banned) {
          multiplayerClient.disconnect();
          setOnlineMatchCtx(null);
          setGameState('LOBBY');
        }
      }
    };

    const onFocus = () => {
      void refreshAccount();
    };
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshAccount();
      }
    }, 5000);

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [user?.id, user?.authProvider, isNetOnline, handleAuthChange]);

  // Guard OWNER_PANEL access strictly to verified Owner account
  useEffect(() => {
    if (gameState === 'OWNER_PANEL' && (!isOwner || user?.banned)) {
      setGameState('LOBBY');
    }
  }, [gameState, isOwner, user?.banned]);

  // Background asset warm-up (non-blocking so Lobby opens instantly)
  useEffect(() => {
    void preloadAllGameAssets();
  }, []);

  useEffect(() => {
    soundManager.setSfxVolume(settings.soundVolume);
    soundManager.setBgmVolume(settings.musicVolume);
    soundManager.setSfxMuted(settings.soundMuted);
    soundManager.setBgmMuted(settings.musicMuted);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    if (gameState === 'LOBBY') {
      syncWallet();
    }
  }, [gameState, syncWallet]);

  // Initialize AdMob SDK / H5 Games Ad Placement once
  useEffect(() => {
    void admobService.initialize();
  }, []);

  const shouldPlayMenuBgm =
    isNetOnline &&
    !settings.musicMuted &&
    !adPlaying &&
    gameState !== 'FIGHTING' &&
    gameState !== 'ROUND_RESULT';

  // Rich menu song: plays in Lobby / Select / Online / Settings when Song is ON, silent during fights & ads
  useEffect(() => {
    if (!shouldPlayMenuBgm) {
      soundManager.stopBgm();
      return;
    }

    const startMenuBgm = () => {
      if (shouldPlayMenuBgm && !soundManager.isBgmPlaying()) {
        soundManager.playBgm('lobby');
      }
    };

    startMenuBgm();
    window.addEventListener('pointerdown', startMenuBgm, { once: true });
    window.addEventListener('keydown', startMenuBgm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startMenuBgm);
      window.removeEventListener('keydown', startMenuBgm);
    };
  }, [shouldPlayMenuBgm]);

  // Independent SFX Sound toggle (never alters Song/BGM mute state)
  const handleToggleSound = useCallback((): boolean => {
    const nextMuted = !settingsRef.current.soundMuted;
    soundManager.setSfxMuted(nextMuted);
    setSettings(prev => ({
      ...prev,
      soundMuted: nextMuted,
    }));
    return nextMuted;
  }, []);

  // Independent Song/BGM toggle (never alters SFX Sound mute state)
  const handleToggleMusic = useCallback((): boolean => {
    const nextMuted = !settingsRef.current.musicMuted;
    soundManager.setBgmMuted(nextMuted);
    if (!nextMuted && isNetOnlineRef.current && gameStateRef.current !== 'FIGHTING' && gameStateRef.current !== 'ROUND_RESULT') {
      soundManager.playBgm('lobby');
    }
    setSettings(prev => ({
      ...prev,
      musicMuted: nextMuted,
    }));
    return nextMuted;
  }, []);

  // Rewarded Interstitial: +100 V-Coins or +100 XP from Lobby '+' icons
  const handleWatchRewardedAd = useCallback(
    async (bonusType: RewardedAdBonusType): Promise<{ granted: boolean; message: string }> => {
      const res = await admobService.showRewardedInterstitial(bonusType, 100, {
        onBeforeAd: () => {
          setAdPlaying(true);
          soundManager.stopBgm();
        },
        onAfterAd: () => {
          setAdPlaying(false);
          if (!settingsRef.current.musicMuted && isNetOnlineRef.current && gameStateRef.current === 'LOBBY') {
            soundManager.playBgm('lobby');
          }
        },
      });

      if (!res.rewardGranted) {
        return {
          granted: false,
          message:
            res.error ||
            'Ad complete nahi hua ya abhi real ad fill available nahi hai.',
        };
      }

      const coinsDelta = bonusType === 'coins' ? 100 : 0;
      const xpDelta = bonusType === 'xp' ? 100 : 0;

      const updatedCoins = coinsDelta > 0 ? addTotalVCoins(coinsDelta) : loadTotalVCoins();
      const updatedXP = xpDelta > 0 ? addTotalXP(xpDelta) : loadTotalXP();
      setTotalCoins(updatedCoins);
      setTotalXP(updatedXP);

      const activeUser = userRef.current;
      if (activeUser && activeUser.authProvider !== 'supabase') {
        const updatedUser = await awardMatchRewards(coinsDelta, xpDelta);
        if (updatedUser) {
          handleAuthChange(updatedUser);
        }
      } else if (activeUser?.authProvider === 'supabase') {
        void syncSupabaseWallet(activeUser.id, updatedCoins, updatedXP);
      }

      return {
        granted: true,
        message:
          bonusType === 'coins'
            ? '+100 V-Coins आपके बैलेंस में जुड़ गए!'
            : '+100 XP आपके खाते में जुड़ गई!',
      };
    },
    [handleAuthChange]
  );

  // Interstitial Ad strictly ONLY when returning to Lobby after fighting (win/loss/pause-to-lobby)
  const handleReturnToLobbyAfterFight = useCallback(async () => {
    if (postMatchAdPendingRef.current) return;
    postMatchAdPendingRef.current = true;
    try {
      await admobService.showPostMatchInterstitial({
        onBeforeAd: () => {
          setAdPlaying(true);
          soundManager.stopBgm();
        },
        onAfterAd: () => {
          setAdPlaying(false);
        },
      });
    } finally {
      setAdPlaying(false);
      postMatchAdPendingRef.current = false;
      setMatchResult(null);
      syncWallet();
      setGameState('LOBBY');
    }
  }, [syncWallet]);

  const handleConfirmFighters = useCallback(
    (p1: CharacterId, p2: CharacterId, selectedMode: GameMode) => {
      if (!unlockedCharacters.includes(p1)) {
        return;
      }
      setP1Char(p1);
      setP2Char(p2);
      setMode(selectedMode);
      if (selectedMode === 'INFINITY') {
        const randomStartArena = ARENA_LIST[Math.floor(Math.random() * ARENA_LIST.length)].id;
        setArenaId(randomStartArena);
        setMatchResult(null);
        setGameState('FIGHTING');
      } else {
        setGameState('ARENA_SELECT');
      }
    },
    [unlockedCharacters]
  );

  const handleSelectArena = useCallback((selectedArena: ArenaId) => {
    setArenaId(selectedArena);
    setMatchResult(null);
    setGameState('FIGHTING');
  }, []);

  const handleMatchOver = useCallback(
    (
      winner: 'p1' | 'p2',
      p1Wins: number,
      p2Wins: number,
      infinitySummary?: InfinityRunSummary | null
    ) => {
      const isCpuMatch = mode !== 'VERSUS';
      const isPlayerDefeated = !isCpuMatch || winner === 'p2';
      let defeatMemeIndex: number | null = null;
      if (isPlayerDefeated) {
        defeatMemeIndex = defeatMemeIdxRef.current % 3;
        const nextIdx = (defeatMemeIndex + 1) % 3;
        defeatMemeIdxRef.current = nextIdx;
        try {
          window.localStorage.setItem(DEFEAT_MEME_STORAGE_KEY, String(nextIdx));
        } catch {
          // ignore storage errors
        }
      }

      let matchCoinsEarned = 0;
      let matchXpEarned = 0;
      if (!infinitySummary) {
        const baseMatchCoins = winner === 'p1' ? 20 : 8;
        matchCoinsEarned = applyCharacterCoinBonus(baseMatchCoins, p1Char);
        matchXpEarned = winner === 'p1' ? 100 : 25;
        addTotalVCoins(matchCoinsEarned);
        addTotalXP(matchXpEarned);
      }

      const deltaCoins = infinitySummary ? (infinitySummary.runCoins ?? 0) : matchCoinsEarned;
      const deltaXp = infinitySummary ? (infinitySummary.runXP ?? 0) : matchXpEarned;

      if (user && user.authProvider !== 'supabase') {
        void awardMatchRewards(deltaCoins, deltaXp).then(updated => {
          if (updated) {
            handleAuthChange(updated);
          }
        });
      } else {
        syncWallet();
      }

      setMatchResult({
        winner,
        p1Wins,
        p2Wins,
        defeatMemeIndex,
        infinitySummary,
        matchCoinsEarned,
        matchXpEarned,
      });
      setGameState('ROUND_RESULT');
    },
    [mode, p1Char, user, handleAuthChange, syncWallet]
  );

  const handleOnlineMatchStart = useCallback((ctx: ActiveOnlineMatchContext) => {
    setOnlineMatchCtx(ctx);
    const enemyChar = ctx.initialSnapshot.onlineEnemies?.[0]?.characterId;
    setP1Char(ctx.room.host.characterId);
    setP2Char(
      ctx.room.matchFormat === 'infinity'
        ? (enemyChar || 'buster')
        : (ctx.room.guest?.characterId || enemyChar || 'buster')
    );
    setArenaId(ctx.initialSnapshot.arenaId || ctx.room.arenaId);
    setMode('ONLINE');
    setMatchResult(null);
    setGameState('FIGHTING');
  }, []);

  const handleOnlineMatchOver = useCallback(
    (payload: WsMatchOverPayload) => {
      const localSide = onlineMatchCtx?.localSide || 'p1';
      const isInfinityOnline = payload.matchFormat === 'infinity';
      const isForfeitWin =
        (payload.reason === 'opponent_left' || payload.reason === 'opponent_disconnected') &&
        (payload.winnerPlayerId === user?.id || payload.winnerSide === localSide);
      const didLocalWin = isForfeitWin
        ? true
        : isInfinityOnline
        ? payload.winnerSide === 'p1'
        : payload.winnerSide === localSide;

      let defeatMemeIndex: number | null = null;
      if (!didLocalWin) {
        defeatMemeIndex = defeatMemeIdxRef.current % 3;
        const nextIdx = (defeatMemeIndex + 1) % 3;
        defeatMemeIdxRef.current = nextIdx;
        try {
          window.localStorage.setItem(DEFEAT_MEME_STORAGE_KEY, String(nextIdx));
        } catch {
          // ignore
        }
      }

      const localCharId = localSide === 'p2' ? payload.p2Char : payload.p1Char;
      const localZoneCoins = localSide === 'p2' ? (payload.p2ZoneCoins || 0) : (payload.p1ZoneCoins || 0);
      const baseOnlineCoins = (isInfinityOnline ? (didLocalWin ? 40 : 15) : (didLocalWin ? 25 : 10)) + localZoneCoins;
      const matchCoinsEarned = applyCharacterCoinBonus(baseOnlineCoins, localCharId || p1Char);
      const matchXpEarned = isInfinityOnline ? (didLocalWin ? 150 : 50) : (didLocalWin ? 100 : 35);
      addTotalVCoins(matchCoinsEarned);
      addTotalXP(matchXpEarned);

      if (user && user.authProvider !== 'supabase') {
        void awardMatchRewards(matchCoinsEarned, matchXpEarned).then(updated => {
          if (updated) {
            handleAuthChange(updated);
          }
        });
      } else {
        syncWallet();
      }

      void fetchCurrentUser().then(res => {
        if (res && res.authProvider !== 'supabase') {
          setUser(prev =>
            prev
              ? {
                  ...prev,
                  wins: res.wins,
                  losses: res.losses,
                  xp: res.xp,
                  vCoins: res.vCoins,
                  walletRevision: res.walletRevision,
                }
              : res
          );
        }
      });

      if (user?.authProvider === 'supabase' && !isInfinityOnline && (localSide === 'p1' || payload.winnerPlayerId === user.id)) {
        void recordOnlineMatchToSupabase({
          roomCode: payload.roomCode,
          p1Id: payload.p1Id,
          p2Id: payload.p2Id,
          p1Char: payload.p1Char,
          p2Char: payload.p2Char,
          arenaId: payload.arenaId,
          winnerId: payload.winnerPlayerId,
          p1Wins: payload.p1Wins,
          p2Wins: payload.p2Wins,
        }).then(() => {
          void fetchCurrentSupabaseUser().then(res => {
            if (res.user) handleAuthChange(res.user);
          });
        });
      }

      const onlineInfSummary: InfinityRunSummary | null = isInfinityOnline
        ? {
            zoneReached: payload.infinityZone || Math.max(1, payload.p1Wins + 1),
            defeatedCount: payload.infinityDefeated || payload.p1Wins || 0,
            runCoins: matchCoinsEarned,
            runXP: matchXpEarned,
            totalCoins: loadTotalVCoins(),
            unlockedAchievements: [],
          }
        : null;

      setMatchResult({
        winner: payload.winnerSide,
        p1Wins: payload.p1Wins,
        p2Wins: payload.p2Wins,
        defeatMemeIndex,
        infinitySummary: onlineInfSummary,
        matchCoinsEarned,
        matchXpEarned,
        winReason: payload.reason,
      });
      setGameState('ROUND_RESULT');
    },
    [onlineMatchCtx, p1Char, syncWallet, user, handleAuthChange]
  );

  const renderScreen = () => {
    if (gameState === 'OWNER_PANEL' && isOwner && user && !user.banned) {
      return (
        <OwnerPanelView
          user={user}
          onUserUpdated={handleAuthChange}
          onBackLobby={() => setGameState('LOBBY')}
        />
      );
    }

    if (gameState === 'LOBBY') {
      return (
        <>
          <MainLobby
            totalCoins={totalCoins}
            totalXP={totalXP}
            soundMuted={settings.soundMuted}
            musicMuted={settings.musicMuted}
            user={user}
            onOpenProfile={() => {
              setProfileInitialTab('signup');
              setIsProfileOpen(true);
            }}
            onToggleSound={handleToggleSound}
            onToggleMusic={handleToggleMusic}
            onOpenRewardedAd={(type) => setRewardAdFocus(type)}
            onOwnerPanel={isOwner ? () => setGameState('OWNER_PANEL') : undefined}
            onPlay={() => {
              setSelectForInfinity(false);
              setGameState('CHARACTER_SELECT');
            }}
            onOnline={() => {
              setGameState('ONLINE_HUB');
            }}
            onInfinity={() => {
              setSelectForInfinity(true);
              setGameState('CHARACTER_SELECT');
            }}
            onSettings={() => setGameState('SETTINGS')}
          />
          {isProfileOpen && (
            <ProfileModal
              user={user}
              localCoins={totalCoins}
              localXP={totalXP}
              initialTab={profileInitialTab}
              onAuthChange={handleAuthChange}
              onClose={() => setIsProfileOpen(false)}
            />
          )}
        </>
      );
    }

    if (gameState === 'ONLINE_HUB') {
      return (
        <>
          <OnlineMultiplayerHub
            user={user}
            totalCoins={totalCoins}
            unlockedCharacters={unlockedCharacters}
            isNetOnline={isNetOnline}
            soundMuted={settings.soundMuted}
            musicMuted={settings.musicMuted}
            onToggleSound={handleToggleSound}
            onToggleMusic={handleToggleMusic}
            onUnlockCharacter={handleUnlockCharacter}
            onOpenAuth={() => {
              setProfileInitialTab('signup');
              setIsProfileOpen(true);
            }}
            onBackLobby={() => {
              multiplayerClient.disconnect();
              syncWallet();
              setGameState('LOBBY');
            }}
            onMatchStart={handleOnlineMatchStart}
          />
          {isProfileOpen && (
            <ProfileModal
              user={user}
              localCoins={totalCoins}
              localXP={totalXP}
              initialTab={profileInitialTab}
              onAuthChange={handleAuthChange}
              onClose={() => setIsProfileOpen(false)}
            />
          )}
        </>
      );
    }

    if (gameState === 'SETTINGS') {
      return (
        <SettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setGameState('LOBBY')}
        />
      );
    }

    if (gameState === 'VISUAL_REFERENCES') {
      return <VisualReferenceModal onClose={() => setGameState('LOBBY')} />;
    }

    if (gameState === 'CHARACTER_SELECT') {
      return (
        <CharacterSelect
          isInfinityMode={selectForInfinity}
          totalCoins={totalCoins}
          unlockedCharacters={unlockedCharacters}
          soundMuted={settings.soundMuted}
          musicMuted={settings.musicMuted}
          onToggleSound={handleToggleSound}
          onToggleMusic={handleToggleMusic}
          onUnlockCharacter={handleUnlockCharacter}
          onConfirmSelection={handleConfirmFighters}
          onBack={() => setGameState('LOBBY')}
        />
      );
    }

    if (gameState === 'ARENA_SELECT') {
      return (
        <ArenaSelect
          soundMuted={settings.soundMuted}
          musicMuted={settings.musicMuted}
          onToggleSound={handleToggleSound}
          onToggleMusic={handleToggleMusic}
          onSelectArena={handleSelectArena}
          onBack={() => setGameState('CHARACTER_SELECT')}
        />
      );
    }

    if (gameState === 'ROUND_RESULT' && matchResult) {
      const isOnlineMatch = mode === 'ONLINE';
      const winnerCharId = matchResult.winner === 'p1' ? p1Char : p2Char;
      const loserCharId = matchResult.winner === 'p1' ? p2Char : p1Char;
      return (
        <RoundResultModal
          winnerSide={matchResult.winner}
          winnerCharId={winnerCharId}
          loserCharId={loserCharId}
          localCharId={
            isOnlineMatch
              ? onlineMatchCtx?.localSide === 'p2'
                ? onlineMatchCtx?.room.guest?.characterId
                : onlineMatchCtx?.room.host.characterId
              : p1Char
          }
          winReason={matchResult.winReason}
          p1Wins={matchResult.p1Wins}
          p2Wins={matchResult.p2Wins}
          isCpuMatch={mode !== 'VERSUS' && !isOnlineMatch}
          isOnlineMatch={isOnlineMatch}
          p1Name={
            isOnlineMatch && onlineMatchCtx?.room.matchFormat === 'infinity'
              ? (onlineMatchCtx.room.guest ? 'CO-OP SQUAD' : onlineMatchCtx.room.host.username)
              : onlineMatchCtx?.room.host.username
          }
          p2Name={
            isOnlineMatch && onlineMatchCtx?.room.matchFormat === 'infinity'
              ? 'INFINITY ENEMIES'
              : onlineMatchCtx?.room.guest?.username
          }
          defeatMemeIndex={matchResult.defeatMemeIndex}
          infinitySummary={matchResult.infinitySummary}
          matchCoinsEarned={matchResult.matchCoinsEarned}
          matchXpEarned={matchResult.matchXpEarned}
          soundMuted={settings.soundMuted}
          soundVolume={settings.soundVolume}
          onRematch={() => {
            setMatchResult(null);
            if (isOnlineMatch) {
              multiplayerClient.leaveRoom();
              setOnlineMatchCtx(null);
              setGameState('ONLINE_HUB');
            } else {
              setGameState('FIGHTING');
            }
          }}
          onSelectFighters={() => {
            setMatchResult(null);
            if (isOnlineMatch) {
              multiplayerClient.leaveRoom();
              setOnlineMatchCtx(null);
              setGameState('ONLINE_HUB');
            } else {
              setGameState('CHARACTER_SELECT');
            }
          }}
          onReturnLobby={() => {
            if (isOnlineMatch) {
              multiplayerClient.leaveRoom();
              multiplayerClient.disconnect();
              setOnlineMatchCtx(null);
            }
            void handleReturnToLobbyAfterFight();
          }}
        />
      );
    }

    return (
      <FightingGameView
        p1Char={p1Char}
        p2Char={p2Char}
        arenaId={arenaId}
        mode={mode}
        settings={settings}
        deviceType={deviceProfile.deviceType}
        isNetOnline={isNetOnline}
        onlineContext={onlineMatchCtx}
        onOnlineMatchOver={handleOnlineMatchOver}
        onMatchOver={handleMatchOver}
        onReturnLobby={() => {
          syncWallet();
          if (mode === 'ONLINE') {
            multiplayerClient.leaveRoom();
            setOnlineMatchCtx(null);
            setGameState('ONLINE_HUB');
          } else {
            void handleReturnToLobbyAfterFight();
          }
        }}
        onSelectFighters={() => {
          syncWallet();
          if (mode === 'ONLINE') {
            setGameState('ONLINE_HUB');
          } else {
            setGameState('CHARACTER_SELECT');
          }
        }}
        onToggleSound={handleToggleSound}
        onToggleMusic={handleToggleMusic}
      />
    );
  };

  return (
    <>
      {renderScreen()}
      {user?.banned && isNetOnline && (
        <BannedAccountModal
          user={user}
          onRecheckStatus={async () => {
            const fresh = await fetchCurrentUser();
            if (fresh) {
              handleAuthChange(fresh);
            }
          }}
          onLogoutAndSwitch={() => {
            logoutAccount();
            handleAuthChange(null);
            setGameState('LOBBY');
            setProfileInitialTab('signup');
            setIsProfileOpen(true);
          }}
        />
      )}
      {!isNetOnline && (
        <NetworkRequiredModal
          checking={checkingNet}
          lastCheckFailed={netCheckFailed}
          onRetry={recheckNet}
        />
      )}
      {rewardAdFocus && gameState === 'LOBBY' && (
        <RewardedBonusModal
          initialFocus={rewardAdFocus}
          totalCoins={totalCoins}
          totalXP={totalXP}
          soundMuted={settings.soundMuted}
          onWatchRewardedAd={handleWatchRewardedAd}
          onClose={() => setRewardAdFocus(null)}
        />
      )}
    </>
  );
}

export default App;
