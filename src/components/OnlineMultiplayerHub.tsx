import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Crown,
  Globe,
  Infinity as InfinityIcon,
  Lock,
  MapPin,
  Medal,
  Music,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  ArenaId,
  CharacterId,
  FriendRelation,
  LeaderboardEntry,
  OnlineMatchFormat,
  OnlinePlayerSummary,
  OnlineRoomInfo,
  RoomInviteInfo,
  UserAccountProfile,
} from '../types/game';
import { CHARACTERS, CHARACTER_LIST, getCharacterCoinBonusAmount, getCharacterUnlockCost } from '../data/characters';
import { ARENAS, ARENA_LIST } from '../data/arenas';
import { soundManager } from '../audio/soundManager';
import {
  fetchOnlinePlayers,
  fetchOnlineSocial,
  removeFriend,
  respondFriendRequest,
  respondRoomInvite,
  sendFriendRequest,
} from '../services/onlineSocialClient';
import {
  ActiveOnlineMatchContext,
  WsRoomInviteAlert,
  multiplayerClient,
} from '../services/multiplayerClient';

interface OnlineMultiplayerHubProps {
  user: UserAccountProfile | null;
  totalCoins: number;
  unlockedCharacters: CharacterId[];
  isNetOnline: boolean;
  soundMuted: boolean;
  musicMuted: boolean;
  onToggleSound: () => boolean;
  onToggleMusic: () => boolean;
  onUnlockCharacter: (charId: CharacterId) => Promise<{ ok: boolean; error?: string }>;
  onOpenAuth: () => void;
  onBackLobby: () => void;
  onMatchStart: (ctx: ActiveOnlineMatchContext) => void;
}

type HubTab = 'worlds' | 'players' | 'ranks';

export const OnlineMultiplayerHub: React.FC<OnlineMultiplayerHubProps> = ({
  user,
  totalCoins,
  unlockedCharacters,
  isNetOnline,
  soundMuted,
  musicMuted,
  onToggleSound,
  onToggleMusic,
  onUnlockCharacter,
  onOpenAuth,
  onBackLobby,
  onMatchStart,
}) => {
  const [tab, setTab] = useState<HubTab>('worlds');
  const [selectedChar, setSelectedChar] = useState<CharacterId>('oggy');
  const [unlockInspectChar, setUnlockInspectChar] = useState<CharacterId | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [selectedArena, setSelectedArena] = useState<ArenaId>('jungle_temple');
  const [selectedMatchFormat, setSelectedMatchFormat] = useState<OnlineMatchFormat>('play');
  const [selectedRoundsToWin, setSelectedRoundsToWin] = useState<number>(2);
  const [selectedRoundTimerSec, setSelectedRoundTimerSec] = useState<number>(99);

  // WebSocket Realtime state
  const [wsConnected, setWsConnected] = useState(multiplayerClient.connected);
  const [onlineCount, setOnlineCount] = useState(multiplayerClient.onlineCount);
  const [publicRooms, setPublicRooms] = useState<OnlineRoomInfo[]>([]);
  const [activeRoom, setActiveRoom] = useState<OnlineRoomInfo | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueSeconds, setQueueSeconds] = useState(0);

  // World Create & Join Inputs
  const [newRoomName, setNewRoomName] = useState('');
  const [worldNameError, setWorldNameError] = useState<string | null>(null);
  const [newRoomVisibility, setNewRoomVisibility] = useState<'public' | 'private'>('public');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

  // Custom In-Game Arena Picker Modal (replaces native OS select dropdown)
  const [isArenaPickerOpen, setIsArenaPickerOpen] = useState(false);
  const [arenaPickerTarget, setArenaPickerTarget] = useState<'create' | 'room'>('create');

  // Social / Players / Leaderboard
  const [allPlayers, setAllPlayers] = useState<OnlinePlayerSummary[]>([]);
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendCodeBusy, setFriendCodeBusy] = useState(false);
  const [copiedOwnId, setCopiedOwnId] = useState(false);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<OnlinePlayerSummary | null>(null);

  const [dbInvites, setDbInvites] = useState<RoomInviteInfo[]>([]);
  const [wsInvites, setWsInvites] = useState<WsRoomInviteAlert[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [duplicateSessionError, setDuplicateSessionError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const initialCharRef = useRef<CharacterId>(selectedChar);
  initialCharRef.current = selectedChar;

  const notifyError = useCallback((msg: string) => {
    setBannerSuccess(null);
    setBannerError(msg);
  }, []);

  const notifySuccess = useCallback((msg: string) => {
    setBannerError(null);
    setBannerSuccess(msg);
  }, []);

  useEffect(() => {
    if (!unlockedCharacters.includes(selectedChar)) {
      setSelectedChar('oggy');
    }
  }, [unlockedCharacters, selectedChar]);

  const playableChar: CharacterId = unlockedCharacters.includes(selectedChar) ? selectedChar : 'oggy';

  const handleFighterTileClick = useCallback(
    (charId: CharacterId, inRoom: boolean) => {
      if (!unlockedCharacters.includes(charId)) {
        soundManager.playUiMove();
        setUnlockInspectChar(charId);
        return;
      }
      soundManager.playUiMove();
      setUnlockInspectChar(null);
      setSelectedChar(charId);
      if (inRoom) {
        multiplayerClient.updateRoom({ characterId: charId });
      }
    },
    [unlockedCharacters]
  );

  const handleConfirmOnlineUnlock = useCallback(
    async (charId: CharacterId, inRoom: boolean) => {
      if (CHARACTERS[charId]?.ownerOnly && !unlockedCharacters.includes(charId)) {
        soundManager.playUiMove();
        notifyError(`${CHARACTERS[charId].name} is Owner-Exclusive (himank only).`);
        return;
      }
      if (unlockBusy) return;
      setUnlockBusy(true);
      try {
        const res = await onUnlockCharacter(charId);
        if (res.ok) {
          soundManager.playUiSelect();
          setUnlockInspectChar(null);
          setSelectedChar(charId);
          if (inRoom) {
            multiplayerClient.updateRoom({ characterId: charId });
          }
          notifySuccess(`${CHARACTERS[charId].name} bought & selected!`);
        } else {
          notifyError(res.error || 'Not enough V-Coins.');
        }
      } finally {
        setUnlockBusy(false);
      }
    },
    [notifyError, notifySuccess, onUnlockCharacter, unlockBusy, unlockedCharacters]
  );

  const handleTileBuyClick = useCallback(
    (charId: CharacterId, inRoom: boolean) => {
      if (unlockedCharacters.includes(charId)) return;
      setUnlockInspectChar(charId);
      if (CHARACTERS[charId]?.ownerOnly) {
        soundManager.playUiMove();
        notifyError(`${CHARACTERS[charId].name} is Owner-Exclusive (himank only).`);
        return;
      }
      const cost = getCharacterUnlockCost(charId);
      if (totalCoins < cost) {
        soundManager.playUiMove();
        notifyError(`Need ${cost - totalCoins} more V-Coins to buy ${CHARACTERS[charId].name}.`);
        return;
      }
      void handleConfirmOnlineUnlock(charId, inRoom);
    },
    [unlockedCharacters, totalCoins, notifyError, handleConfirmOnlineUnlock]
  );

  const refreshSocialAndPlayers = useCallback(async (queryOverride?: string) => {
    if (!user || !isNetOnline) return;
    setLoadingSocial(true);
    try {
      const q = queryOverride !== undefined ? queryOverride : searchQuery;
      const [socialRes, playersRes] = await Promise.allSettled([
        fetchOnlineSocial(),
        fetchOnlinePlayers(q),
      ]);
      if (socialRes.status === 'fulfilled' && socialRes.value) {
        setFriends(socialRes.value.friends);
        setDbInvites(socialRes.value.invites);
        setLeaderboard(socialRes.value.leaderboard);
      }
      if (playersRes.status === 'fulfilled' && Array.isArray(playersRes.value)) {
        setAllPlayers(playersRes.value);
      }
    } finally {
      setLoadingSocial(false);
    }
  }, [user, isNetOnline, searchQuery]);

  useEffect(() => {
    if (user && isNetOnline) {
      void refreshSocialAndPlayers('');
    }
  }, [user, isNetOnline, refreshSocialAndPlayers]);

  // Connect WebSocket when user is present & online (decoupled from character clicks for instant picking)
  useEffect(() => {
    if (!user || !isNetOnline) return;
    setDuplicateSessionError(null);
    multiplayerClient.connect(user, initialCharRef.current);
    multiplayerClient.listRooms();

    const unsubscribe = multiplayerClient.subscribe((ev) => {
      const type = String(ev.type || '');
      if (type === 'ws_connection') {
        setWsConnected(Boolean(ev.connected));
      } else if (type === 'hello_ack') {
        setDuplicateSessionError(null);
        setWsConnected(true);
        if (typeof ev.onlineCount === 'number') setOnlineCount(ev.onlineCount);
        multiplayerClient.listRooms();
      } else if (type === 'duplicate_online_session') {
        const msg = String(
          ev.error ||
            'This account is already playing Online Arena on another device. Leave Online Arena there first to connect here.'
        );
        setWsConnected(false);
        setDuplicateSessionError(msg);
        notifyError(msg);
      } else if (type === 'room_list') {
        if (Array.isArray(ev.rooms)) setPublicRooms(ev.rooms as OnlineRoomInfo[]);
        if (typeof ev.onlineCount === 'number') setOnlineCount(ev.onlineCount);
      } else if (type === 'social_updated') {
        if (typeof ev.onlineCount === 'number') setOnlineCount(ev.onlineCount);
        void refreshSocialAndPlayers();
      } else if (type === 'queue_status') {
        setInQueue(Boolean(ev.queued));
        if (!ev.queued) setQueueSeconds(0);
      } else if (type === 'quick_match_found') {
        setInQueue(false);
        setQueueSeconds(0);
        if (ev.room) setActiveRoom(ev.room as OnlineRoomInfo);
        soundManager.playUiSelect();
        notifySuccess('Match found! Confirm your fighter and click READY.');
      } else if (type === 'room_state') {
        if (ev.room) setActiveRoom(ev.room as OnlineRoomInfo);
      } else if (type === 'room_left' || type === 'room_closed') {
        setActiveRoom(null);
        if (type === 'room_closed' && typeof ev.reason === 'string') {
          notifyError(ev.reason);
        }
      } else if (type === 'room_invite') {
        const alert: WsRoomInviteAlert = {
          roomCode: String(ev.roomCode || ''),
          roomName: String(ev.roomName || 'Battle World'),
          matchFormat: ev.matchFormat === 'infinity' ? 'infinity' : 'play',
          visibility: ev.visibility === 'private' ? 'private' : 'public',
          fromUsername: String(ev.fromUsername || 'Player'),
          fromPlayerCode: String(ev.fromPlayerCode || ''),
        };
        if (alert.roomCode) {
          setWsInvites(prev => [alert, ...prev.filter(i => i.roomCode !== alert.roomCode)].slice(0, 5));
          soundManager.playUiSelect();
        }
      } else if (type === 'ws_error') {
        if (typeof ev.error === 'string') notifyError(ev.error);
      } else if (type === 'match_started') {
        const room = ev.room as OnlineRoomInfo;
        const side = (ev.side === 'p2' ? 'p2' : 'p1') as 'p1' | 'p2';
        const snap = ev.snapshot as ActiveOnlineMatchContext['initialSnapshot'];
        soundManager.playUiSelect();
        onMatchStart({ room, localSide: side, initialSnapshot: snap });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, isNetOnline, notifyError, notifySuccess, onMatchStart, refreshSocialAndPlayers]);

  // Queue timer
  useEffect(() => {
    if (!inQueue) return;
    const id = window.setInterval(() => setQueueSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [inQueue]);

  const handleSendFriendRequest = async (target: OnlinePlayerSummary) => {
    if (!user) return;
    try {
      await sendFriendRequest(target.id);
      soundManager.playUiSelect();
      notifySuccess(`Friend request sent to ${target.username}!`);
      await refreshSocialAndPlayers();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not send friend request.');
    }
  };

  const handleAddFriendByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || friendCodeBusy) return;
    const rawCode = friendCodeInput.trim();
    if (rawCode.length < 3) {
      notifyError('Enter a valid Player ID (e.g. FXP-A1B2C3).');
      return;
    }
    setFriendCodeBusy(true);
    try {
      await sendFriendRequest(rawCode);
      setFriendCodeInput('');
      soundManager.playUiSelect();
      notifySuccess(`Friend request sent to ${rawCode.toUpperCase()}!`);
      await refreshSocialAndPlayers();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Player ID not found or request failed.');
    } finally {
      setFriendCodeBusy(false);
    }
  };

  const handleRespondFriend = async (friendshipId: string, decision: 'accepted' | 'rejected') => {
    try {
      await respondFriendRequest(friendshipId, decision);
      soundManager.playUiSelect();
      notifySuccess(decision === 'accepted' ? 'Friend added!' : 'Request dismissed.');
      await refreshSocialAndPlayers();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleRemoveFriend = async (friendshipId: string, name: string) => {
    try {
      await removeFriend(friendshipId);
      soundManager.playUiSelect();
      notifySuccess(`${name} removed from friends.`);
      await refreshSocialAndPlayers();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Remove failed.');
    }
  };

  const handleDirectChallenge = (target: OnlinePlayerSummary, format: OnlineMatchFormat) => {
    if (!user || !wsConnected) {
      notifyError('Connecting to online server... please wait.');
      return;
    }
    if (activeRoom && activeRoom.host.playerId === user.id) {
      multiplayerClient.sendInvite(target.id, activeRoom.code);
      soundManager.playUiSelect();
      notifySuccess(`Invite sent to ${target.username} for World ${activeRoom.code}!`);
      return;
    }
    multiplayerClient.createRoom({
      name: format === 'infinity' ? `${user.username} & ${target.username} Co-op` : `${user.username} vs ${target.username}`,
      visibility: 'private',
      arenaId: selectedArena,
      characterId: playableChar,
      matchFormat: format,
      roundsToWin: selectedRoundsToWin,
      roundTimerSec: selectedRoundTimerSec,
      invitePlayerId: target.id,
    });
    soundManager.playUiSelect();
    notifySuccess(
      `Private ${format === 'infinity' ? 'Infinity Co-op' : 'Play Battle'} World created & request sent to ${target.username}!`
    );
  };

  const handleCreateWorld = () => {
    if (!user) return;
    const trimmedName = newRoomName.trim();
    if (trimmedName.length < 2) {
      const errMsg = 'Please enter a World Name (at least 2 characters) before creating a World.';
      setWorldNameError(errMsg);
      notifyError(errMsg);
      return;
    }
    setWorldNameError(null);
    soundManager.playUiSelect();
    multiplayerClient.createRoom({
      name: trimmedName,
      visibility: newRoomVisibility,
      arenaId: selectedArena,
      characterId: playableChar,
      matchFormat: selectedMatchFormat,
      roundsToWin: selectedMatchFormat === 'infinity' ? 3 : selectedRoundsToWin,
      roundTimerSec: selectedMatchFormat === 'infinity' ? 0 : selectedRoundTimerSec,
    });
    setNewRoomName('');
  };

  const otherPlayers = useMemo(() => {
    const friendPriority = (status: OnlinePlayerSummary['friendStatus']) =>
      status === 'friend' ? 0 : status === 'incoming' ? 1 : status === 'outgoing' ? 2 : 3;
    return allPlayers
      .filter(
        p => p.id !== user?.id && (!user?.playerId || p.playerId !== user.playerId)
      )
      .sort((a, b) => {
        if (Boolean(a.isOnline) !== Boolean(b.isOnline)) return a.isOnline ? -1 : 1;
        const fDiff = friendPriority(a.friendStatus) - friendPriority(b.friendStatus);
        if (fDiff !== 0) return fDiff;
        const lastSeenDiff = Number(b.lastSeen ?? 0) - Number(a.lastSeen ?? 0);
        if (lastSeenDiff !== 0) return lastSeenDiff;
        return String(a.username).localeCompare(String(b.username));
      });
  }, [allPlayers, user?.id, user?.playerId]);

  const acceptedFriends = useMemo(
    () =>
      friends.filter(
        f =>
          f.direction === 'friend' &&
          f.profile.id !== user?.id &&
          (!user?.playerId || f.profile.playerId !== user.playerId)
      ),
    [friends, user?.id, user?.playerId]
  );
  const incomingRequests = useMemo(
    () =>
      friends.filter(
        f =>
          f.direction === 'incoming' &&
          f.profile.id !== user?.id &&
          (!user?.playerId || f.profile.playerId !== user.playerId)
      ),
    [friends, user?.id, user?.playerId]
  );
  const outgoingRequests = useMemo(
    () =>
      friends.filter(
        f =>
          f.direction === 'outgoing' &&
          f.profile.id !== user?.id &&
          (!user?.playerId || f.profile.playerId !== user.playerId)
      ),
    [friends, user?.id, user?.playerId]
  );

  const rankedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      const aOwner = Boolean(a.isOwner) || String(a.username).trim().toLowerCase() === 'himank';
      const bOwner = Boolean(b.isOwner) || String(b.username).trim().toLowerCase() === 'himank';
      if (aOwner !== bOwner) return aOwner ? 1 : -1;
      const scoreA = Number(a.vCoins ?? 0) + Number(a.xp ?? 0);
      const scoreB = Number(b.vCoins ?? 0) + Number(b.xp ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const coinDiff = Number(b.vCoins ?? 0) - Number(a.vCoins ?? 0);
      if (coinDiff !== 0) return coinDiff;
      const xpDiff = Number(b.xp ?? 0) - Number(a.xp ?? 0);
      if (xpDiff !== 0) return xpDiff;
      return String(a.username).localeCompare(String(b.username));
    });
  }, [leaderboard]);

  const mySide: 'p1' | 'p2' | null = activeRoom
    ? activeRoom.host.playerId === user?.id
      ? 'p1'
      : activeRoom.guest?.playerId === user?.id
      ? 'p2'
      : null
    : null;
  const mySlot = mySide === 'p1' ? activeRoom?.host : mySide === 'p2' ? activeRoom?.guest : null;
  const isHost = mySide === 'p1';
  const canHostStart = Boolean(
    activeRoom &&
      activeRoom.guest &&
      activeRoom.host.ready &&
      activeRoom.guest.ready
  );

  const onlineInvitablePlayers = useMemo(() => {
    if (!activeRoom) return [];
    return otherPlayers.filter(
      p => p.isOnline && p.id !== activeRoom.host.playerId && p.id !== activeRoom.guest?.playerId
    );
  }, [otherPlayers, activeRoom]);

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 text-slate-100 select-none flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,#1e1b4b_0%,#020617_68%)] pointer-events-none" />

      {/* Top Navigation Header */}
      <header className="relative z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              if (inQueue) multiplayerClient.cancelQuickMatch();
              if (activeRoom) multiplayerClient.leaveRoom();
              onBackLobby();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-pixel text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>LOBBY</span>
          </button>

          <div>
            <h1 className="font-pixel text-xs sm:text-base text-yellow-300 arcade-gold-shadow whitespace-nowrap">
              ONLINE ARENA
            </h1>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1">
                {wsConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{wsConnected ? `Live · ${onlineCount} Online` : 'Connecting...'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Wallet, Sound & Account Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/90 border border-white/80 shadow"
            title="Your V-Coin Balance"
          >
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white font-mono text-[10px] font-black text-white leading-none shrink-0"
              aria-label="V-Coins"
            >
              V
            </span>
            <span className="font-mono text-xs font-black text-white tabular-nums">
              {totalCoins.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onToggleMusic();
              if (!soundMuted) soundManager.playUiSelect();
            }}
            title={musicMuted ? 'Song Off (Tap to Play Song)' : 'Song On (Tap to Mute Song)'}
            aria-label={musicMuted ? 'Unmute Song' : 'Mute Song'}
            className={`relative p-2 rounded-xl border shadow transition-colors cursor-pointer ${
              musicMuted
                ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                : 'bg-slate-900 border-sky-400/70 text-sky-300 hover:bg-slate-800'
            }`}
          >
            <Music className="w-4 h-4" />
            {musicMuted && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="w-5 h-0.5 bg-red-400 rotate-45 rounded-full" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const muted = onToggleSound();
              if (!muted) soundManager.playUiSelect();
            }}
            title={soundMuted ? 'Sound Effects Muted (Tap to Unmute)' : 'Sound Effects On (Tap to Mute)'}
            aria-label={soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            className={`p-2 rounded-xl border shadow transition-colors cursor-pointer ${
              soundMuted
                ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                : 'bg-slate-900 border-amber-400/70 text-amber-300 hover:bg-slate-800'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              onOpenAuth();
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/70 shrink-0 cursor-pointer"
          >
            {user ? (
              <>
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-amber-300 pixelated"
                />
                <div className="text-left leading-tight">
                  <div className="font-pixel text-[10px] text-white max-w-[120px] truncate">{user.username}</div>
                  <div className="font-mono text-[10px] text-amber-300">{user.playerId || 'PLAYER'}</div>
                </div>
              </>
            ) : (
              <span className="font-pixel text-[10px] text-amber-300 px-2 py-1">SIGN UP / LOG IN</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-8 sm:py-4 sm:pb-10 space-y-4">
        {/* Incoming Match Invites Toast Bar */}
        {(wsInvites.length > 0 || dbInvites.length > 0) && !activeRoom && (
          <div className="space-y-2">
            {wsInvites.map(inv => (
              <div
                key={`ws_${inv.roomCode}`}
                className="p-3 rounded-xl bg-emerald-950/85 border border-emerald-400/80 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="text-xs flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-emerald-300">{inv.fromUsername}</span>
                  <span>invited you to</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-emerald-400/50 font-pixel text-[8px] text-yellow-300">
                    {inv.matchFormat === 'infinity' ? 'INFINITY CO-OP' : 'PLAY BATTLE'}
                  </span>
                  <span>World</span>
                  <span className="font-mono font-bold text-yellow-300">{inv.roomCode}</span>
                  <span className="text-slate-300">({inv.roomName})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWsInvites(prev => prev.filter(i => i.roomCode !== inv.roomCode));
                      multiplayerClient.joinRoom(inv.roomCode, playableChar);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-pixel text-[9px] font-bold cursor-pointer"
                  >
                    ACCEPT &amp; JOIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setWsInvites(prev => prev.filter(i => i.roomCode !== inv.roomCode))}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-300 text-xs cursor-pointer"
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            ))}
            {dbInvites.map(inv => (
              <div
                key={inv.id}
                className="p-3 rounded-xl bg-cyan-950/85 border border-cyan-400/80 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="text-xs">
                  <span className="font-bold text-cyan-300">{inv.sender.username}</span> invited you to World{' '}
                  <span className="font-mono font-bold text-yellow-300">{inv.roomCode}</span> ({inv.roomName})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await respondRoomInvite(inv.id, 'accepted');
                      multiplayerClient.joinRoom(inv.roomCode, playableChar);
                      void refreshSocialAndPlayers();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-pixel text-[9px] font-bold cursor-pointer"
                  >
                    ACCEPT &amp; JOIN
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await respondRoomInvite(inv.id, 'declined');
                      void refreshSocialAndPlayers();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-300 text-xs cursor-pointer"
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Duplicate Simultaneous Online Session Alert */}
        {duplicateSessionError && (
          <div className="p-4 rounded-xl bg-amber-950/85 border-2 border-amber-400 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
              <span>{duplicateSessionError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!user) return;
                setDuplicateSessionError(null);
                setBannerError(null);
                multiplayerClient.connect(user, selectedChar);
              }}
              className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[9px] font-bold cursor-pointer shrink-0"
            >
              RETRY ONLINE
            </button>
          </div>
        )}

        {/* Global Status Banners */}
        {bannerError && !duplicateSessionError && (
          <div className="p-3 rounded-xl bg-red-950/85 border border-red-500/80 text-xs text-red-100 flex items-center justify-between gap-2">
            <span>{bannerError}</span>
            <button type="button" onClick={() => setBannerError(null)} className="text-red-300 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {bannerSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/85 border border-emerald-500/80 text-xs text-emerald-100 flex items-center justify-between gap-2">
            <span>{bannerSuccess}</span>
            <button type="button" onClick={() => setBannerSuccess(null)} className="text-emerald-300 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Require Account Sign In Gate */}
        {!user ? (
          <div className="max-w-lg mx-auto my-8 p-6 rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 text-center space-y-4 shadow-2xl">
            <Swords className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="font-pixel text-sm sm:text-base text-yellow-300">SIGN IN TO ENTER ONLINE ARENA</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sign in or create a quick Name + Password Fighter Account to see who is Online, add Friends, join Public Worlds, or battle friends in Private Worlds.
            </p>
            <button
              type="button"
              onClick={() => {
                soundManager.playUiSelect();
                onOpenAuth();
              }}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-pixel text-xs font-black border-2 border-yellow-200 cursor-pointer"
            >
              SIGN UP / LOG IN ▶
            </button>
          </div>
        ) : activeRoom ? (
          /* ================================================================
             ACTIVE WORLD STAGING SCREEN
             ================================================================ */
          <section className="rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 p-4 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-pixel text-[8px] font-bold border ${
                      activeRoom.matchFormat === 'infinity'
                        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/70'
                        : 'bg-amber-950/70 text-amber-300 border-amber-500/70'
                    }`}
                  >
                    {activeRoom.matchFormat === 'infinity'
                      ? 'INFINITY CO-OP · 2P TEAM'
                      : `PLAY · ${activeRoom.roundsToWin || 2}R · ${
                          (activeRoom.roundTimerSec ?? 99) === 0 ? '∞ TIME' : `${activeRoom.roundTimerSec ?? 99}s`
                        }`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {activeRoom.visibility === 'private' ? (
                      <Lock className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{activeRoom.visibility === 'private' ? 'Private (Invite Only)' : 'Public World'}</span>
                  </span>
                  {activeRoom.matchFormat !== 'infinity' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ARENAS[activeRoom.arenaId]?.name || activeRoom.arenaId}</span>
                    </>
                  )}
                </div>
                <h2 className="font-pixel text-sm sm:text-base text-yellow-300 mt-1">{activeRoom.name}</h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-lg bg-slate-950 border border-amber-400/70 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">WORLD CODE:</span>
                  <span className="font-mono text-sm font-black text-amber-300 tracking-wider">{activeRoom.code}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
                      setCopiedRoomCode(true);
                      window.setTimeout(() => setCopiedRoomCode(false), 1800);
                    }}
                    className="p-1 text-slate-300 hover:text-white cursor-pointer"
                    title="Copy World Code"
                  >
                    {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playUiSelect();
                    multiplayerClient.leaveRoom();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 font-pixel text-[10px] whitespace-nowrap cursor-pointer"
                >
                  LEAVE WORLD
                </button>
              </div>
            </div>

            {/* Player 1 vs Player 2 / Co-op Partner Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: activeRoom.matchFormat === 'infinity' ? 'ALLY 1 (HOST)' : 'PLAYER 1 (HOST)',
                  slot: activeRoom.host,
                },
                {
                  label: activeRoom.matchFormat === 'infinity' ? 'ALLY 2 (REQUIRED 2P CO-OP)' : 'PLAYER 2 (CHALLENGER)',
                  slot: activeRoom.guest,
                },
              ].map((entry, idx) => {
                const slot = entry.slot;
                const charDef = slot ? CHARACTERS[slot.characterId] : null;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border-2 ${
                      slot?.ready
                        ? 'bg-emerald-950/35 border-emerald-400/80'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-pixel text-[9px] text-amber-300">{entry.label}</span>
                      {slot && (
                        <span
                          className={`font-pixel text-[9px] font-bold ${
                            slot.ready ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          {slot.ready ? 'READY' : 'PICKING...'}
                        </span>
                      )}
                    </div>

                    {slot && charDef ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={slot.avatarUrl}
                          alt={slot.username}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full border-2 border-amber-400 object-cover pixelated shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-pixel text-xs text-white truncate">{slot.username}</div>
                          <div className="font-mono text-[11px] text-slate-400">{slot.playerCode}</div>
                          <div className="text-xs text-cyan-300 font-semibold mt-1">
                            Fighter: {charDef.name}
                          </div>
                        </div>
                        <img
                          src={charDef.portraitUrl}
                          alt={charDef.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-xl border border-slate-700 object-cover bg-slate-900 pixelated shrink-0"
                        />
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400 space-y-2.5">
                        <div>
                          {activeRoom.matchFormat === 'infinity'
                            ? 'Waiting for Ally 2 to join (2 Players Required for 2P Co-op vs 2 Enemies):'
                            : `Waiting for Challenger (${activeRoom.visibility === 'private' ? 'Invite Only' : 'Open Public'})`}
                        </div>
                        {isHost && onlineInvitablePlayers.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {onlineInvitablePlayers.slice(0, 6).map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  multiplayerClient.sendInvite(p.id, activeRoom.code);
                                  soundManager.playUiSelect();
                                  notifySuccess(`Request sent to ${p.username}!`);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-[11px] text-amber-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Invite {p.username}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Host World Configuration (Play: Custom Arcade Controls | Infinity: Normal Auto Zones) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[10px] text-slate-300">SELECT YOUR FIGHTER</span>
                  <span className="text-xs font-semibold text-cyan-300">
                    ({(CHARACTERS[mySlot?.characterId || selectedChar] || CHARACTER_LIST[0]).name})
                  </span>
                </div>
                {isHost && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiMove();
                          multiplayerClient.updateRoom({ matchFormat: 'play' });
                        }}
                        className={`px-2.5 py-1 rounded text-[10px] font-pixel cursor-pointer ${
                          activeRoom.matchFormat !== 'infinity'
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        PLAY
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiMove();
                          multiplayerClient.updateRoom({ matchFormat: 'infinity' });
                        }}
                        className={`px-2.5 py-1 rounded text-[10px] font-pixel flex items-center gap-1 cursor-pointer ${
                          activeRoom.matchFormat === 'infinity'
                            ? 'bg-cyan-400 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <InfinityIcon className="w-3 h-3" />
                        <span>INFINITY</span>
                      </button>
                    </div>

                    {activeRoom.matchFormat !== 'infinity' ? (
                      <>
                        {/* Custom Rounds Arcade Buttons */}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-700">
                          {[1, 2, 3, 5].map(r => {
                            const active = (activeRoom.roundsToWin || 2) === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  soundManager.playUiMove();
                                  multiplayerClient.updateRoom({ roundsToWin: r });
                                }}
                                className={`px-2 py-1 rounded font-pixel text-[9px] cursor-pointer ${
                                  active
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                {r}R
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Timer Arcade Buttons */}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-700">
                          {[
                            { val: 60, label: '60s' },
                            { val: 99, label: '99s' },
                            { val: 0, label: '∞' },
                          ].map(t => {
                            const active = (activeRoom.roundTimerSec ?? 99) === t.val;
                            return (
                              <button
                                key={t.val}
                                type="button"
                                onClick={() => {
                                  soundManager.playUiMove();
                                  multiplayerClient.updateRoom({ roundTimerSec: t.val });
                                }}
                                className={`px-2 py-1 rounded font-pixel text-[9px] cursor-pointer ${
                                  active
                                    ? 'bg-cyan-400 text-slate-950 font-bold'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom In-Game Map Picker Trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            soundManager.playUiSelect();
                            setArenaPickerTarget('room');
                            setIsArenaPickerOpen(true);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-amber-400/70 text-xs text-amber-200 cursor-pointer"
                        >
                          <img
                            src={(ARENAS[activeRoom.arenaId] || ARENA_LIST[0]).imageUrl}
                            alt=""
                            className="w-6 h-4 rounded object-cover border border-slate-700"
                          />
                          <span className="max-w-[120px] truncate font-semibold">
                            {(ARENAS[activeRoom.arenaId] || ARENA_LIST[0]).name}
                          </span>
                          <span className="font-pixel text-[8px] text-amber-300">MAP ▾</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-cyan-300 bg-cyan-950/50 border border-cyan-500/40 rounded-lg px-3 py-1.5">
                        Auto Zone Maps · Unique Enemies · 5s Safe Revive
                      </span>
                    )}
                  </div>
                )}
              </div>

              {unlockInspectChar && !unlockedCharacters.includes(unlockInspectChar) && (() => {
                const lockedDef = CHARACTERS[unlockInspectChar];
                if (lockedDef.ownerOnly) {
                  return (
                    <div className="p-3 rounded-xl bg-purple-950/90 border-2 border-purple-400/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={lockedDef.portraitUrl}
                          alt={lockedDef.name}
                          className="w-11 h-11 rounded-lg border border-purple-400/70 object-contain bg-slate-900 pixelated shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-pixel text-[10px] text-purple-200 truncate">
                            {lockedDef.name} · OWNER EXCLUSIVE
                          </div>
                          <div className="text-[11px] text-purple-200/80 mt-0.5">
                            Locked for all players — only Owner (<span className="font-mono font-bold text-white">himank</span>) can play this fighter.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-3 py-1.5 rounded-lg bg-purple-900/90 border border-purple-300/60 text-purple-100 font-pixel text-[8px]">
                          OWNER ONLY
                        </span>
                        <button
                          type="button"
                          onClick={() => setUnlockInspectChar(null)}
                          className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                }
                const cost = getCharacterUnlockCost(unlockInspectChar);
                const canAfford = totalCoins >= cost;
                return (
                  <div className="p-3 rounded-xl bg-slate-950/95 border-2 border-emerald-400/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={lockedDef.portraitUrl}
                        alt={lockedDef.name}
                        className="w-11 h-11 rounded-lg border border-amber-400/60 object-contain bg-slate-900 pixelated shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-pixel text-[10px] text-yellow-300 truncate">
                          BUY {lockedDef.name}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          Price: <span className="font-mono font-bold text-white">{cost} V</span> · Your Balance:{' '}
                          <span className="font-mono font-bold text-white">{totalCoins} V</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!canAfford || unlockBusy}
                        onClick={() => void handleConfirmOnlineUnlock(unlockInspectChar, true)}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-pixel text-[9px] font-black cursor-pointer disabled:cursor-not-allowed"
                      >
                        {unlockBusy
                          ? 'BUYING...'
                          : canAfford
                          ? `BUY (${cost} V)`
                          : `NEED ${cost - totalCoins} MORE V`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlockInspectChar(null)}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="max-h-[205px] sm:max-h-[245px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {CHARACTER_LIST.map(ch => {
                  const active = (mySlot?.characterId || playableChar) === ch.id;
                  const unlocked = unlockedCharacters.includes(ch.id);
                  const cost = getCharacterUnlockCost(ch.id);
                  const tileAffordable = totalCoins >= cost;
                  return (
                    <div
                      key={ch.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFighterTileClick(ch.id, true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleFighterTileClick(ch.id, true);
                        }
                      }}
                      className={`relative p-2 min-h-[78px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        active
                          ? 'border-yellow-400 bg-amber-950/60 shadow-[0_0_12px_rgba(250,204,21,0.45)]'
                          : unlocked
                          ? 'border-slate-800 bg-slate-950 hover:border-slate-600'
                          : ch.ownerOnly
                          ? 'border-purple-700/80 bg-purple-950/35 hover:border-purple-400/80'
                          : 'border-slate-800/80 bg-slate-950/75 hover:border-amber-500/60'
                      }`}
                    >
                      {!unlocked && (
                        <span className={`absolute top-1 right-1 w-4 h-4 rounded bg-black/85 border flex items-center justify-center ${
                          ch.ownerOnly ? 'border-purple-400/80 text-purple-300' : 'border-amber-400/75 text-amber-300'
                        }`}>
                          <Lock className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <img
                        src={ch.portraitUrl}
                        alt={ch.name}
                        referrerPolicy="no-referrer"
                        className={`w-10 h-10 object-cover rounded pixelated ${
                          !unlocked ? 'opacity-50 grayscale-[40%]' : ''
                        }`}
                      />
                      <span className={`text-[10px] truncate w-full text-center font-semibold ${unlocked ? 'text-slate-200' : 'text-slate-400'}`}>
                        {ch.name}
                      </span>
                      {!unlocked && (
                        ch.ownerOnly ? (
                          <span className="w-full inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-purple-400/75 bg-purple-950/90 text-purple-200 text-[8px] font-pixel font-black leading-none">
                            OWNER
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={unlockBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTileBuyClick(ch.id, true);
                            }}
                            className={`w-full inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-pixel font-black leading-none cursor-pointer transition-colors ${
                              tileAffordable
                                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950'
                                : 'bg-black hover:border-amber-300 border-white/75 text-white'
                            }`}
                            title={`Buy ${ch.name} for ${cost} V-Coins`}
                          >
                            <span>BUY</span>
                            <span className="font-mono">{cost}V</span>
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </div>

            {/* Ready & Start Controls */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  soundManager.playUiSelect();
                  multiplayerClient.updateRoom({ ready: !mySlot?.ready });
                }}
                className={`px-6 py-3 rounded-xl font-pixel text-xs border-2 whitespace-nowrap cursor-pointer ${
                  mySlot?.ready
                    ? 'bg-emerald-500 text-slate-950 border-emerald-200 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-400/80'
                }`}
              >
                {mySlot?.ready ? 'READY ✓ (CANCEL)' : 'CLICK TO READY'}
              </button>

              {isHost && (
                <button
                  type="button"
                  disabled={!canHostStart}
                  onClick={() => {
                    soundManager.playUiSelect();
                    multiplayerClient.startMatch();
                  }}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-pixel text-xs font-black border-2 border-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {activeRoom.matchFormat === 'infinity'
                    ? canHostStart
                      ? 'START 2P INFINITY ▶'
                      : !activeRoom.guest
                      ? 'NEED 2 PLAYERS'
                      : 'WAITING FOR READY'
                    : canHostStart
                    ? 'START 1v1 PLAY ▶'
                    : !activeRoom.guest
                    ? 'NEED 2 PLAYERS'
                    : 'WAITING FOR READY'}
                </button>
              )}
            </div>
          </section>
        ) : (
          /* ================================================================
             MULTIPLAYER HUB TABS: WORLDS / PLAYERS & FRIENDS / RANKS
             ================================================================ */
          <>
            <nav className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
              {[
                { id: 'worlds' as HubTab, shortLabel: `WORLDS (${publicRooms.length})`, label: `WORLDS (${publicRooms.length})`, icon: Globe },
                {
                  id: 'players' as HubTab,
                  shortLabel: `PLAYERS${incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}`,
                  label: `PLAYERS & FRIENDS${incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}`,
                  icon: Users,
                },
                { id: 'ranks' as HubTab, shortLabel: 'RANKS', label: 'LEADERBOARD', icon: Trophy },
              ].map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      soundManager.playUiMove();
                      setTab(t.id);
                      if (t.id === 'worlds') multiplayerClient.listRooms();
                      void refreshSocialAndPlayers();
                    }}
                    className={`py-2.5 px-1.5 sm:px-3 rounded-lg font-pixel text-[8px] sm:text-[11px] flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap cursor-pointer transition-all ${
                      active
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="sm:hidden truncate">{t.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{t.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* TAB 1: WORLDS (CREATE WORLD + PUBLIC WORLDS + PRIVATE CODE + QUICK MATCH) */}
            {tab === 'worlds' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Fighter Picker & Create World */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Fighter Picker */}
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-pixel text-xs text-amber-300">1. PICK YOUR FIGHTER</h2>
                      <div className="flex items-center gap-2">
                        {getCharacterCoinBonusAmount(playableChar) > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400/60 font-mono text-[10px] font-bold text-amber-200 tabular-nums">
                            +{getCharacterCoinBonusAmount(playableChar)} V BONUS
                          </span>
                        )}
                        <span className="text-xs font-semibold text-cyan-300">
                          {(CHARACTERS[selectedChar] || CHARACTER_LIST[0]).name}
                        </span>
                      </div>
                    </div>
                    {unlockInspectChar && !unlockedCharacters.includes(unlockInspectChar) && (() => {
                      const lockedDef = CHARACTERS[unlockInspectChar];
                      if (lockedDef.ownerOnly) {
                        return (
                          <div className="p-3 rounded-xl bg-purple-950/90 border-2 border-purple-400/80 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={lockedDef.portraitUrl}
                                alt={lockedDef.name}
                                className="w-11 h-11 rounded-lg border border-purple-400/70 object-contain bg-slate-900 pixelated shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-pixel text-[10px] text-purple-200 truncate">
                                  {lockedDef.name} · OWNER EXCLUSIVE
                                </div>
                                <div className="text-[11px] text-purple-200/80 mt-0.5">
                                  Locked for all players — only Owner (<span className="font-mono font-bold text-white">himank</span>) can play this fighter.
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-3 py-1.5 rounded-lg bg-purple-900/90 border border-purple-300/60 text-purple-100 font-pixel text-[8px]">
                                OWNER ONLY
                              </span>
                              <button
                                type="button"
                                onClick={() => setUnlockInspectChar(null)}
                                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      const cost = getCharacterUnlockCost(unlockInspectChar);
                      const canAfford = totalCoins >= cost;
                      return (
                        <div className="p-3 rounded-xl bg-slate-950/95 border-2 border-emerald-400/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={lockedDef.portraitUrl}
                              alt={lockedDef.name}
                              className="w-11 h-11 rounded-lg border border-amber-400/60 object-contain bg-slate-900 pixelated shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-pixel text-[10px] text-yellow-300 truncate">
                                BUY {lockedDef.name}
                              </div>
                              <div className="text-[11px] text-slate-300 mt-0.5">
                                Price: <span className="font-mono font-bold text-white">{cost} V</span> · Your Balance:{' '}
                                <span className="font-mono font-bold text-white">{totalCoins} V</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={!canAfford || unlockBusy}
                              onClick={() => void handleConfirmOnlineUnlock(unlockInspectChar, false)}
                              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-pixel text-[9px] font-black cursor-pointer disabled:cursor-not-allowed"
                            >
                              {unlockBusy
                                ? 'BUYING...'
                                : canAfford
                                ? `BUY (${cost} V)`
                                : `NEED ${cost - totalCoins} MORE V`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setUnlockInspectChar(null)}
                              className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="max-h-[205px] sm:max-h-[245px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                      {CHARACTER_LIST.map(ch => {
                        const active = playableChar === ch.id;
                        const unlocked = unlockedCharacters.includes(ch.id);
                        const cost = getCharacterUnlockCost(ch.id);
                        const tileAffordable = totalCoins >= cost;
                        return (
                          <div
                            key={ch.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleFighterTileClick(ch.id, false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleFighterTileClick(ch.id, false);
                              }
                            }}
                            className={`relative p-2 min-h-[78px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                              active
                                ? 'border-yellow-400 bg-amber-950/60 shadow-[0_0_14px_rgba(250,204,21,0.4)]'
                                : unlocked
                                ? 'border-slate-800 bg-slate-950 hover:border-slate-600'
                                : ch.ownerOnly
                                ? 'border-purple-700/80 bg-purple-950/35 hover:border-purple-400/80'
                                : 'border-slate-800/80 bg-slate-950/75 hover:border-amber-500/60'
                            }`}
                          >
                            {!unlocked && (
                              <span className={`absolute top-1 right-1 w-4 h-4 rounded bg-black/85 border flex items-center justify-center ${
                                ch.ownerOnly ? 'border-purple-400/80 text-purple-300' : 'border-amber-400/75 text-amber-300'
                              }`}>
                                <Lock className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <img
                              src={ch.portraitUrl}
                              alt={ch.name}
                              referrerPolicy="no-referrer"
                              className={`w-10 h-10 object-cover rounded pixelated ${
                                !unlocked ? 'opacity-50 grayscale-[40%]' : ''
                              }`}
                            />
                            <span className={`text-[10px] font-semibold truncate w-full text-center ${unlocked ? 'text-slate-200' : 'text-slate-400'}`}>
                              {ch.name}
                            </span>
                            {!unlocked && (
                              ch.ownerOnly ? (
                                <span className="w-full inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-purple-400/75 bg-purple-950/90 text-purple-200 text-[8px] font-pixel font-black leading-none">
                                  OWNER
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={unlockBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTileBuyClick(ch.id, false);
                                  }}
                                  className={`w-full inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-pixel font-black leading-none cursor-pointer transition-colors ${
                                    tileAffordable
                                      ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950'
                                      : 'bg-black hover:border-amber-300 border-white/75 text-white'
                                  }`}
                                  title={`Buy ${ch.name} for ${cost} V-Coins`}
                                >
                                  <span>BUY</span>
                                  <span className="font-mono">{cost}V</span>
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>

                  {/* Create World Box */}
                  <div className="rounded-2xl bg-slate-900/95 border border-amber-400/70 p-4 sm:p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h2 className="font-pixel text-xs text-yellow-300 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        <span>2. CREATE A WORLD</span>
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        {newRoomVisibility === 'public' ? 'Visible to everyone' : 'Invite-only'}
                      </span>
                    </div>

                    {/* Mode Toggle: Play vs Infinity */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiMove();
                          setSelectedMatchFormat('play');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          selectedMatchFormat === 'play'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-pixel text-[10px] flex items-center gap-1.5">
                          <Swords className="w-3.5 h-3.5" />
                          <span>PLAY MODE</span>
                        </div>
                        <div className="text-[10px] text-slate-300/80 mt-1">Custom Rounds, Timer &amp; Map</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playUiMove();
                          setSelectedMatchFormat('infinity');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          selectedMatchFormat === 'infinity'
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-pixel text-[10px] flex items-center gap-1.5">
                          <InfinityIcon className="w-3.5 h-3.5" />
                          <span>INFINITY MODE</span>
                        </div>
                        <div className="text-[10px] text-slate-300/80 mt-1">1P Solo or 2P Co-op Survival</div>
                      </button>
                    </div>

                    {/* World Name (Required) + Public/Private */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          maxLength={32}
                          placeholder="World Name * (Required)"
                          value={newRoomName}
                          onChange={e => {
                            setNewRoomName(e.target.value);
                            if (worldNameError && e.target.value.trim().length >= 2) {
                              setWorldNameError(null);
                            }
                          }}
                          className={`px-3 py-2.5 rounded-lg bg-slate-950 border text-xs text-white focus:outline-none ${
                            worldNameError
                              ? 'border-red-500 focus:border-red-400'
                              : 'border-slate-700 focus:border-amber-400'
                          }`}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playUiMove();
                              setNewRoomVisibility('public');
                            }}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                              newRoomVisibility === 'public'
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Public</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playUiMove();
                              setNewRoomVisibility('private');
                            }}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                              newRoomVisibility === 'private'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Private</span>
                          </button>
                        </div>
                      </div>
                      {worldNameError && (
                        <p className="text-[11px] text-red-400 font-semibold">{worldNameError}</p>
                      )}
                    </div>

                    {/* Play Mode Options ONLY (Custom In-Game Arcade UI, zero native OS select popups) */}
                    {selectedMatchFormat === 'play' ? (
                      <div className="space-y-3 p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Rounds to Win Buttons */}
                          <div>
                            <div className="font-pixel text-[8px] text-slate-400 mb-1.5 flex items-center gap-1">
                              <Swords className="w-3 h-3 text-amber-400" />
                              <span>ROUNDS TO WIN</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { val: 1, label: '1R' },
                                { val: 2, label: '2R' },
                                { val: 3, label: '3R' },
                                { val: 5, label: '5R' },
                              ].map(opt => {
                                const active = selectedRoundsToWin === opt.val;
                                return (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      soundManager.playUiMove();
                                      setSelectedRoundsToWin(opt.val);
                                    }}
                                    className={`py-2 rounded-lg border font-pixel text-[9px] cursor-pointer transition-all ${
                                      active
                                        ? 'bg-amber-400 text-slate-950 border-yellow-200 font-black shadow'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Round Timer Buttons */}
                          <div>
                            <div className="font-pixel text-[8px] text-slate-400 mb-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              <span>ROUND TIMER</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { val: 60, label: '60s' },
                                { val: 99, label: '99s' },
                                { val: 0, label: '∞ TIME' },
                              ].map(opt => {
                                const active = selectedRoundTimerSec === opt.val;
                                return (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      soundManager.playUiMove();
                                      setSelectedRoundTimerSec(opt.val);
                                    }}
                                    className={`py-2 rounded-lg border font-pixel text-[9px] cursor-pointer transition-all ${
                                      active
                                        ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-black shadow'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* In-Game Visual Arena Selector */}
                        <div>
                          <div className="font-pixel text-[8px] text-slate-400 mb-1.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>BATTLE ARENA / MAP</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playUiSelect();
                              setArenaPickerTarget('create');
                              setIsArenaPickerOpen(true);
                            }}
                            className="w-full p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 flex items-center justify-between gap-3 cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={(ARENAS[selectedArena] || ARENA_LIST[0]).imageUrl}
                                alt=""
                                className="w-14 h-9 rounded-lg object-cover border border-amber-400/50 shrink-0"
                              />
                              <div className="text-left min-w-0">
                                <div className="font-pixel text-[10px] text-white truncate">
                                  {(ARENAS[selectedArena] || ARENA_LIST[0]).name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {(ARENAS[selectedArena] || ARENA_LIST[0]).location}
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/60 font-pixel text-[8px] text-amber-300 shrink-0">
                              CHOOSE MAP ▶
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-cyan-950/35 border border-cyan-500/40 text-xs text-cyan-200">
                        2P Online Infinity Co-op: 2 Humans vs 2 Unique Enemies across random Zone maps, zero enemy mirrors, and 5s safe-zone revive!
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={!wsConnected || !isNetOnline}
                        onClick={handleCreateWorld}
                        className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:from-red-500 hover:to-yellow-300 text-slate-950 font-pixel text-[11px] font-black border-2 border-yellow-200 disabled:opacity-50 cursor-pointer"
                      >
                        CREATE WORLD ▶
                      </button>

                      {inQueue ? (
                        <button
                          type="button"
                          onClick={() => multiplayerClient.cancelQuickMatch()}
                          className="py-3 px-4 rounded-xl bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 font-pixel text-[10px] cursor-pointer"
                        >
                          SEARCHING ({queueSeconds}s) · CANCEL
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!wsConnected || !isNetOnline}
                          onClick={() => {
                            soundManager.playUiSelect();
                            multiplayerClient.joinQuickMatch(playableChar, selectedArena, selectedMatchFormat);
                          }}
                          className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/70 text-amber-300 font-pixel text-[10px] disabled:opacity-50 cursor-pointer"
                        >
                          QUICK MATCH ({selectedMatchFormat.toUpperCase()})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Public Worlds + Join Private Code */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Live Public Worlds */}
                  <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/40 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="font-pixel text-xs text-emerald-300">PUBLIC WORLDS</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Open worlds anyone can join anytime</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => multiplayerClient.listRooms()}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                        title="Refresh Worlds"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {publicRooms.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                        No open Public Worlds right now. Create one to appear here!
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[340px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pr-1">
                        {publicRooms.map(room => {
                          const playerCount = room.guest ? 2 : 1;
                          const isOpen = playerCount < 2 && room.status !== 'playing';
                          return (
                            <div
                              key={room.code}
                              className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={room.host.avatarUrl}
                                  alt={room.host.username}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-full border border-emerald-400 object-cover pixelated shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-pixel text-[10px] text-white truncate">{room.name}</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-pixel text-[7px] border ${
                                        room.matchFormat === 'infinity'
                                          ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/70'
                                          : 'bg-amber-950/70 text-amber-300 border-amber-500/70'
                                      }`}
                                    >
                                      {room.matchFormat === 'infinity'
                                        ? 'INFINITY'
                                        : `PLAY · ${room.roundsToWin || 2}R · ${
                                            (room.roundTimerSec ?? 99) === 0 ? '∞' : `${room.roundTimerSec ?? 99}s`
                                          }`}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    Host: {room.host.username} · {playerCount}/2 ·{' '}
                                    {room.matchFormat === 'infinity'
                                      ? 'Auto Zones'
                                      : ARENAS[room.arenaId]?.name || room.arenaId}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={!isOpen}
                                onClick={() => {
                                  soundManager.playUiSelect();
                                  multiplayerClient.joinRoom(room.code, playableChar);
                                }}
                                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-pixel text-[9px] font-bold disabled:opacity-40 cursor-pointer shrink-0"
                              >
                                {isOpen ? 'JOIN' : room.status === 'playing' ? 'LIVE' : 'FULL'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Join World by Code */}
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
                    <h3 className="font-pixel text-[10px] text-slate-300">JOIN WORLD BY CODE</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="WORLD CODE (e.g. FX7A)"
                        value={joinCodeInput}
                        onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-amber-300 uppercase focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={joinCodeInput.trim().length < 4}
                        onClick={() => {
                          soundManager.playUiSelect();
                          multiplayerClient.joinRoom(joinCodeInput, playableChar);
                        }}
                        className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[10px] font-bold disabled:opacity-40 cursor-pointer"
                      >
                        JOIN
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Private Worlds require an invite/request from the host to enter.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PLAYERS & FRIENDS (SEE ONLINE/OFFLINE + ADD FRIEND + 1-CLICK BATTLE / CO-OP) */}
            {tab === 'players' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* All Registered Players Directory */}
                <div className="lg:col-span-7 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-pixel text-xs text-amber-300">ALL PLAYERS ({otherPlayers.length})</h2>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-semibold text-emerald-300">
                          {otherPlayers.filter(p => p.isOnline).length} Online
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-semibold text-slate-400">
                          {otherPlayers.filter(p => !p.isOnline).length} Offline
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Online players appear at the top · Offline accounts below · Add Friends by ID or challenge directly
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshSocialAndPlayers()}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Refresh Players"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingSocial ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void refreshSocialAndPlayers();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Search by Name or Player ID (e.g. FXP-1A2B)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>SEARCH</span>
                    </button>
                  </form>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pr-1">
                    {otherPlayers.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No other players found yet. Invite friends to create an account and join!
                      </div>
                    ) : (
                      otherPlayers.map(p => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => setViewingProfile(p)}
                            className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={p.avatarUrl}
                                alt={p.username}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border border-amber-400 pixelated"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                                  p.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">{p.username}</span>
                                {p.friendStatus === 'friend' && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-semibold">
                                    Friend
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-semibold ${
                                    p.isOnline ? 'text-emerald-400' : 'text-slate-500'
                                  }`}
                                >
                                  {p.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {p.playerId} · {p.wins}W / {p.losses}L · {p.xp} XP
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.isOnline && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDirectChallenge(p, 'play')}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                                  title="Send 1v1 Play Battle Request"
                                >
                                  BATTLE (PLAY)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDirectChallenge(p, 'infinity')}
                                  className="px-2.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                                  title="Send 2P Co-op Infinity Request"
                                >
                                  CO-OP (INFINITY)
                                </button>
                              </>
                            )}

                            {p.friendStatus === 'none' && (
                              <button
                                type="button"
                                onClick={() => void handleSendFriendRequest(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-pixel text-[8px] flex items-center gap-1 cursor-pointer"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>ADD</span>
                              </button>
                            )}
                            {p.friendStatus === 'outgoing' && (
                              <span className="text-[10px] text-amber-300 px-2">Requested</span>
                            )}
                            {p.friendStatus === 'incoming' && p.friendshipId && (
                              <button
                                type="button"
                                onClick={() => void handleRespondFriend(p.friendshipId!, 'accepted')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                              >
                                ACCEPT FRIEND
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Friends List & Pending Friend Requests */}
                <div className="lg:col-span-5 space-y-4">
                  {incomingRequests.length > 0 && (
                    <div className="rounded-2xl bg-slate-900/90 border border-amber-400/70 p-4 space-y-2.5">
                      <h3 className="font-pixel text-[10px] text-amber-300">
                        FRIEND REQUESTS ({incomingRequests.length})
                      </h3>
                      {incomingRequests.map(req => (
                        <div
                          key={req.friendshipId}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={req.profile.avatarUrl}
                              alt={req.profile.username}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-amber-400 pixelated"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{req.profile.username}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{req.profile.playerId}</div>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleRespondFriend(req.friendshipId, 'accepted')}
                              className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                            >
                              ACCEPT
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRespondFriend(req.friendshipId, 'rejected')}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-pixel text-[10px] text-cyan-300">ADD FRIEND BY PLAYER ID</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!user.playerId) return;
                          void navigator.clipboard?.writeText(user.playerId);
                          setCopiedOwnId(true);
                          soundManager.playUiMove();
                          window.setTimeout(() => setCopiedOwnId(false), 1800);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-amber-400 text-[10px] font-mono text-amber-300 cursor-pointer"
                        title="Copy your own Player ID"
                      >
                        <span>YOUR ID: {user.playerId}</span>
                        {copiedOwnId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <form onSubmit={e => void handleAddFriendByCode(e)} className="flex gap-2">
                      <input
                        type="text"
                        maxLength={20}
                        placeholder="Friend ID (e.g. FXP-A1B2C3)"
                        value={friendCodeInput}
                        onChange={e => setFriendCodeInput(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white uppercase focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={friendCodeBusy || friendCodeInput.trim().length < 3}
                        className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-pixel text-[9px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{friendCodeBusy ? '...' : 'ADD'}</span>
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                    <h2 className="font-pixel text-xs text-emerald-300">
                      MY FRIENDS ({acceptedFriends.length})
                    </h2>

                    {acceptedFriends.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        No friends added yet. Enter a Player ID above or click ADD next to any player!
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pr-1">
                        {acceptedFriends.map(fr => (
                          <div
                            key={fr.friendshipId}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => setViewingProfile(fr.profile)}
                              className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={fr.profile.avatarUrl}
                                  alt={fr.profile.username}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover border border-emerald-400 pixelated"
                                />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                                    fr.profile.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{fr.profile.username}</div>
                                <div className="font-mono text-[10px] text-slate-400 truncate">
                                  {fr.profile.playerId} ·{' '}
                                  <span className={fr.profile.isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                                    {fr.profile.isOnline ? 'Online' : 'Offline'}
                                  </span>{' '}
                                  · {fr.profile.wins}W/{fr.profile.losses}L
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDirectChallenge(fr.profile, 'play')}
                                className="px-2 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                                title="Battle in Play Mode"
                              >
                                PLAY
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectChallenge(fr.profile, 'infinity')}
                                className="px-2 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-pixel text-[8px] font-bold cursor-pointer"
                                title="Team up in Infinity Mode"
                              >
                                INFINITY
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveFriend(fr.friendshipId, fr.profile.username)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 cursor-pointer"
                                title="Remove Friend"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {outgoingRequests.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400">Sent Requests ({outgoingRequests.length}):</div>
                        {outgoingRequests.map(out => (
                          <div key={out.friendshipId} className="text-xs text-slate-300 flex justify-between gap-2">
                            <span className="truncate">{out.profile.username} <span className="font-mono text-[10px] text-slate-500">({out.profile.playerId})</span></span>
                            <span className="text-amber-300/80 text-[10px] shrink-0">Pending</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GLOBAL COINS & XP LEADERBOARD (ONLY IN ONLINE SECTION) */}
            {tab === 'ranks' && (
              <section className="rounded-2xl bg-slate-900/95 border-2 border-amber-400/60 p-4 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.45)] shrink-0">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-pixel text-xs sm:text-sm text-yellow-300 arcade-gold-shadow flex items-center gap-2">
                        <span>GLOBAL COINS &amp; XP LEADERBOARD</span>
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        All {rankedLeaderboard.length} Fighters ranked highest to lowest by Coins &amp; XP
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void refreshSocialAndPlayers()}
                    className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSocial ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {rankedLeaderboard.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No fighters on the leaderboard yet. Play matches to earn Coins &amp; XP!
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[540px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pr-1">
                    {rankedLeaderboard.map((row, idx) => {
                      const isOwnerRow = Boolean(row.isOwner) || String(row.username).trim().toLowerCase() === 'himank';
                      const rank = idx + 1;
                      const isMe = row.id === user.id;
                      const isTop1 = !isOwnerRow && rank === 1;
                      const isTop2 = !isOwnerRow && rank === 2;
                      const isTop3 = !isOwnerRow && rank === 3;

                      const cardStyle = isOwnerRow
                        ? 'bg-gradient-to-r from-amber-950/75 via-slate-900 to-slate-950 border-2 border-amber-400/80 hover:brightness-110'
                        : isTop1
                        ? 'bg-gradient-to-r from-amber-950/90 via-yellow-900/40 to-slate-950 border-2 border-yellow-400 shadow-[0_0_26px_rgba(250,204,21,0.42)] hover:brightness-110'
                        : isTop2
                        ? 'bg-gradient-to-r from-slate-800/90 via-cyan-950/45 to-slate-950 border-2 border-cyan-300/90 shadow-[0_0_20px_rgba(103,232,249,0.3)] hover:brightness-110'
                        : isTop3
                        ? 'bg-gradient-to-r from-orange-950/85 via-amber-950/45 to-slate-950 border-2 border-orange-400/90 shadow-[0_0_18px_rgba(251,146,60,0.3)] hover:brightness-110'
                        : isMe
                        ? 'bg-slate-900/95 border border-emerald-400/70 hover:bg-slate-900'
                        : 'bg-slate-950/90 border border-slate-800 hover:bg-slate-900 hover:border-slate-700';

                      const rankBadgeStyle = isOwnerRow
                        ? 'bg-amber-950 text-amber-300 border-amber-400/80'
                        : isTop1
                        ? 'bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 text-slate-950 border-yellow-100 shadow-[0_0_14px_rgba(250,204,21,0.7)]'
                        : isTop2
                        ? 'bg-gradient-to-b from-slate-100 via-cyan-200 to-slate-400 text-slate-950 border-white shadow-[0_0_12px_rgba(103,232,249,0.55)]'
                        : isTop3
                        ? 'bg-gradient-to-b from-orange-200 via-amber-500 to-orange-700 text-slate-950 border-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.55)]'
                        : 'bg-slate-900 text-slate-300 border-slate-700';

                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setViewingProfile(row)}
                          className={`w-full p-2.5 sm:p-3.5 rounded-xl flex items-center justify-between gap-2 sm:gap-3 text-left transition-all cursor-pointer ${cardStyle}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            {/* Rank Position Number In Front */}
                            <div
                              className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 ${rankBadgeStyle}`}
                            >
                              {isTop1 ? (
                                <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 -mb-0.5" />
                              ) : isTop2 || isTop3 ? (
                                <Medal className="w-3 h-3 sm:w-3.5 sm:h-3.5 -mb-0.5" />
                              ) : isOwnerRow ? (
                                <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 -mb-0.5 text-amber-300" />
                              ) : null}
                              <span className="font-pixel text-[9px] sm:text-xs font-black tabular-nums">
                                #{rank}
                              </span>
                            </div>

                            <div className="relative shrink-0">
                              <img
                                src={row.avatarUrl}
                                alt={row.username}
                                referrerPolicy="no-referrer"
                                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover pixelated border-2 ${
                                  isOwnerRow
                                    ? 'border-amber-400'
                                    : isTop1
                                    ? 'border-yellow-300'
                                    : isTop2
                                    ? 'border-cyan-300'
                                    : isTop3
                                    ? 'border-orange-400'
                                    : 'border-slate-700'
                                }`}
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-slate-950 ${
                                  row.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                <span
                                  className={`text-xs sm:text-sm font-bold truncate ${
                                    isOwnerRow
                                      ? 'text-amber-300'
                                      : isTop1
                                      ? 'text-yellow-200'
                                      : isTop2
                                      ? 'text-cyan-100'
                                      : isTop3
                                      ? 'text-orange-200'
                                      : 'text-white'
                                  }`}
                                >
                                  {row.username}
                                </span>
                                {isOwnerRow && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-300 font-pixel text-[7px] text-amber-200 font-black">
                                    <Crown className="w-2.5 h-2.5" />
                                    <span>OWNER</span>
                                  </span>
                                )}
                                {isTop1 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-400/20 border border-yellow-300/70 font-pixel text-[7px] text-yellow-200">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>1ST CHAMPION</span>
                                  </span>
                                )}
                                {isTop2 && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 border border-cyan-300/60 font-pixel text-[7px] text-cyan-200">
                                    2ND ELITE
                                  </span>
                                )}
                                {isTop3 && (
                                  <span className="px-1.5 py-0.5 rounded bg-orange-400/20 border border-orange-300/60 font-pixel text-[7px] text-orange-200">
                                    3RD PRO
                                  </span>
                                )}
                                {isMe && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/70 font-pixel text-[7px] text-emerald-300">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                #{rank} · {row.playerId} ·{' '}
                                <span className={row.isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                                  {row.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side: V-Coins & XP */}
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0">
                            <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-black/90 border border-white/80 flex items-center gap-1.5 shadow">
                              <span
                                className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-black border border-white font-mono text-[9px] sm:text-[10px] font-black text-white leading-none shrink-0"
                                aria-label="V-Coins"
                              >
                                V
                              </span>
                              <span className="font-mono text-[11px] sm:text-sm font-black text-white tabular-nums">
                                {(row.vCoins ?? 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1.5 rounded-lg bg-slate-950/85 border border-cyan-400/40 text-right flex sm:block items-center gap-1">
                              <div className="text-[8px] sm:text-[9px] text-cyan-300/80 font-pixel">XP</div>
                              <div className="font-mono text-[11px] sm:text-sm font-black text-cyan-300 tabular-nums">
                                {(row.xp ?? 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Player Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border-2 border-amber-400 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] text-amber-300">FIGHTER CARD</span>
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={viewingProfile.avatarUrl}
                alt={viewingProfile.username}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full border-2 border-amber-400 object-cover pixelated"
              />
              <div>
                <h3 className="font-pixel text-sm text-white">{viewingProfile.username}</h3>
                <div className="font-mono text-xs text-amber-300 mt-0.5">{viewingProfile.playerId}</div>
                <div className={`text-xs mt-1 font-semibold ${viewingProfile.isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {viewingProfile.isOnline ? '● Online Now' : '○ Offline'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-black/90 border border-white/75 flex flex-col items-center justify-center gap-1">
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white font-mono text-[10px] font-black text-white leading-none"
                  aria-label="V-Coins"
                >
                  V
                </span>
                <div className="font-pixel text-xs text-white tabular-nums">
                  {(viewingProfile.vCoins ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">XP</div>
                <div className="font-pixel text-xs text-cyan-300 mt-0.5">
                  {viewingProfile.xp.toLocaleString()}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">WINS</div>
                <div className="font-pixel text-xs text-emerald-300 mt-0.5">{viewingProfile.wins}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">LOSSES</div>
                <div className="font-pixel text-xs text-rose-300 mt-0.5">{viewingProfile.losses}</div>
              </div>
            </div>
            {user && viewingProfile.id !== user.id && viewingProfile.isOnline && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingProfile;
                    setViewingProfile(null);
                    handleDirectChallenge(target, 'play');
                  }}
                  className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-[9px] font-bold cursor-pointer"
                >
                  BATTLE (PLAY)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingProfile;
                    setViewingProfile(null);
                    handleDirectChallenge(target, 'infinity');
                  }}
                  className="py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-pixel text-[9px] font-bold cursor-pointer"
                >
                  CO-OP (INFINITY)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom In-Game Arena Map Picker Modal */}
      {isArenaPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          onClick={e => {
            if (e.target === e.currentTarget) setIsArenaPickerOpen(false);
          }}
        >
          <div className="w-full max-w-4xl max-h-[88dvh] rounded-2xl bg-slate-900 border-2 border-amber-400 p-4 sm:p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="font-pixel text-xs sm:text-sm text-yellow-300">SELECT BATTLE ARENA</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Choose from 25 battlegrounds for Play Mode</p>
              </div>
              <button
                type="button"
                onClick={() => setIsArenaPickerOpen(false)}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close arena picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pr-1">
              {ARENA_LIST.map(arena => {
                const currentId = arenaPickerTarget === 'room' && activeRoom ? activeRoom.arenaId : selectedArena;
                const active = currentId === arena.id;
                return (
                  <button
                    key={arena.id}
                    type="button"
                    onClick={() => {
                      soundManager.playUiSelect();
                      setSelectedArena(arena.id);
                      if (arenaPickerTarget === 'room' && activeRoom) {
                        multiplayerClient.updateRoom({ arenaId: arena.id });
                      }
                      setIsArenaPickerOpen(false);
                    }}
                    className={`group rounded-xl border-2 overflow-hidden bg-slate-950 text-left transition-all cursor-pointer ${
                      active
                        ? 'border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.45)]'
                        : 'border-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                      <img
                        src={arena.imageUrl}
                        alt={arena.name}
                        className="w-full h-full object-cover pixelated group-hover:scale-105 transition-transform duration-200"
                      />
                      {active && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="font-pixel text-[9px] text-white truncate">{arena.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{arena.location}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
