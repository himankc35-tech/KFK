import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, Cpu, Infinity as InfinityIcon, Lock, Music, Volume2, VolumeX } from 'lucide-react';
import { CharacterId, GameMode, FighterState } from '../types/game';
import { CHARACTERS, CHARACTER_LIST, getCharacterCoinBonusAmount, getCharacterUnlockCost } from '../data/characters';
import { spriteRenderer } from '../game/spriteRenderer';
import { soundManager } from '../audio/soundManager';
import rosterBg from '../assets/images/pixel_fighters_roster_1794405989323.jpg';

interface CharacterSelectProps {
  isInfinityMode?: boolean;
  totalCoins: number;
  unlockedCharacters: CharacterId[];
  soundMuted: boolean;
  musicMuted: boolean;
  onToggleSound: () => boolean;
  onToggleMusic: () => boolean;
  onUnlockCharacter: (charId: CharacterId) => Promise<{ ok: boolean; error?: string }>;
  onConfirmSelection: (p1Char: CharacterId, p2Char: CharacterId, mode: GameMode) => void;
  onBack: () => void;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  isInfinityMode = false,
  totalCoins,
  unlockedCharacters,
  soundMuted,
  musicMuted,
  onToggleSound,
  onToggleMusic,
  onUnlockCharacter,
  onConfirmSelection,
  onBack,
}) => {
  const [p1Selection, setP1Selection] = useState<CharacterId>('oggy');
  const [p2Selection, setP2Selection] = useState<CharacterId>('buster');
  const [selectionPhase, setSelectionPhase] = useState<'P1' | 'P2' | 'READY'>('P1');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockFeedback, setUnlockFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const mode: GameMode = isInfinityMode ? 'INFINITY' : 'ARCADE';

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPlayerPickPhase = isInfinityMode || selectionPhase === 'P1';
  const activeCharId = selectionPhase === 'P2' ? p2Selection : p1Selection;
  const activeFighter = CHARACTERS[activeCharId];
  const isP1Locked = !unlockedCharacters.includes(p1Selection);
  const isInspectingLocked = isPlayerPickPhase && isP1Locked;
  const activeCost = getCharacterUnlockCost(p1Selection);
  const activeCoinBonus = getCharacterCoinBonusAmount(activeCharId);
  const canAffordUnlock = totalCoins >= activeCost;

  // Render live animated sprite preview of active character in the select screen
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const dummyFighter: FighterState = {
      id: selectionPhase === 'P2' ? 'p2' : 'p1',
      characterId: activeCharId,
      name: activeFighter.name,
      x: 140,
      y: 218,
      vx: 0,
      vy: 0,
      width: 50,
      height: 90,
      facing: 1,
      health: 200,
      maxHealth: 200,
      damageGhost: 200,
      superMeter: 60,
      maxSuperMeter: 100,
      action: 'idle',
      frameIndex: 0,
      frameTimer: 0,
      animSpeed: 0.1,
      isGrounded: true,
      isBlocking: false,
      isInvincible: false,
      hitStun: 0,
      blockStun: 0,
      comboHits: 0,
      comboDamage: 0,
      wins: 0,
      hasFiredProjectileInAction: false,
      hasHitInCurrentAction: false,
      overdriveArmed: false,
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Pedestal glow
      const grad = ctx.createRadialGradient(140, 218, 12, 140, 218, 108);
      grad.addColorStop(0, 'rgba(250, 204, 21, 0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(140, 218, 102, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      spriteRenderer.drawFighter(ctx, dummyFighter, 218, time, false, 1.32);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeCharId, selectionPhase, activeFighter.name]);

  const handleSelectFighter = (id: CharacterId) => {
    soundManager.playUiMove();
    setUnlockFeedback(null);
    if (selectionPhase === 'P1') {
      setP1Selection(id);
    } else if (selectionPhase === 'P2') {
      setP2Selection(id);
    }
  };

  const handleUnlockSelected = async () => {
    if (!isInspectingLocked || unlockBusy) return;
    setUnlockBusy(true);
    setUnlockFeedback(null);
    try {
      const res = await onUnlockCharacter(p1Selection);
      if (res.ok) {
        soundManager.playUiSelect();
        setUnlockFeedback({
          type: 'ok',
          text: `${CHARACTERS[p1Selection].name} BOUGHT!`,
        });
      } else {
        setUnlockFeedback({
          type: 'err',
          text: res.error || 'Not enough V-Coins.',
        });
      }
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleDirectBuyChar = async (charId: CharacterId) => {
    if (unlockBusy || unlockedCharacters.includes(charId)) return;
    setP1Selection(charId);
    const cost = getCharacterUnlockCost(charId);
    if (totalCoins < cost) {
      soundManager.playUiMove();
      setUnlockFeedback({
        type: 'err',
        text: `Need ${cost - totalCoins} more V-Coins to buy ${CHARACTERS[charId].name}.`,
      });
      return;
    }
    setUnlockBusy(true);
    setUnlockFeedback(null);
    try {
      const res = await onUnlockCharacter(charId);
      if (res.ok) {
        soundManager.playUiSelect();
        setUnlockFeedback({
          type: 'ok',
          text: `${CHARACTERS[charId].name} BOUGHT!`,
        });
      } else {
        setUnlockFeedback({
          type: 'err',
          text: res.error || 'Not enough V-Coins.',
        });
      }
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleConfirmCurrent = () => {
    if (isPlayerPickPhase && !unlockedCharacters.includes(p1Selection)) {
      if (CHARACTERS[p1Selection]?.ownerOnly) {
        soundManager.playUiMove();
        setUnlockFeedback({
          type: 'err',
          text: `${CHARACTERS[p1Selection].name} is Owner-Exclusive (himank only).`,
        });
        return;
      }
      void handleUnlockSelected();
      return;
    }
    soundManager.playUiSelect();
    if (isInfinityMode) {
      const otherChars = CHARACTER_LIST.filter(c => c.id !== p1Selection && !c.ownerOnly);
      const firstCpu = otherChars[Math.floor(Math.random() * otherChars.length)].id;
      setSelectionPhase('READY');
      setTimeout(() => {
        onConfirmSelection(p1Selection, firstCpu, 'INFINITY');
      }, 450);
      return;
    }

    if (selectionPhase === 'P1') {
      const otherChars = CHARACTER_LIST.filter(c => c.id !== p1Selection && !c.ownerOnly);
      const randomCpu = otherChars[Math.floor(Math.random() * otherChars.length)].id;
      setP2Selection(randomCpu);
      setUnlockFeedback(null);
      setSelectionPhase('P2');
    } else if (selectionPhase === 'P2') {
      setSelectionPhase('READY');
      setTimeout(() => {
        onConfirmSelection(p1Selection, p2Selection, 'ARCADE');
      }, 700);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 select-none flex flex-col justify-between p-2 sm:p-4 lg:p-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div
        className="fixed inset-0 opacity-20 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${rosterBg})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/90 pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 sm:pb-3">
        <button
          onClick={() => {
            soundManager.playUiSelect();
            setUnlockFeedback(null);
            if (selectionPhase === 'P2') {
              setSelectionPhase('P1');
            } else {
              onBack();
            }
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] sm:text-xs font-pixel text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{selectionPhase === 'P2' ? 'BACK TO P1' : 'LOBBY'}</span>
        </button>

        {/* Phase Indicator */}
        <div className="flex flex-col items-center text-center order-last sm:order-none w-full sm:w-auto">
          <span className="font-pixel text-[11px] sm:text-sm text-yellow-300 tracking-wider sm:tracking-widest arcade-gold-shadow">
            {isInfinityMode
              ? 'INFINITY: SELECT FIGHTER'
              : selectionPhase === 'P1'
              ? 'PLAYER 1: SELECT FIGHTER'
              : selectionPhase === 'P2'
              ? 'SELECT OPPONENT (CPU)'
              : 'FIGHTERS READY!'}
          </span>
          {selectionPhase === 'P2' && (
            <span className="text-[10px] text-emerald-300 font-semibold mt-0.5">
              All {CHARACTER_LIST.length} fighters available for CPU opponent
            </span>
          )}
        </div>

        {/* Wallet + Solo Mode Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded bg-black/90 border border-white/80 shadow"
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
            className={`relative p-1.5 rounded border shadow transition-colors cursor-pointer ${
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
            className={`p-1.5 rounded border shadow transition-colors cursor-pointer ${
              soundMuted
                ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                : 'bg-slate-900 border-amber-400/70 text-amber-300 hover:bg-slate-800'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded border border-amber-500/50 text-xs font-pixel text-amber-300">
            {isInfinityMode ? (
              <>
                <InfinityIcon className="w-3.5 h-3.5" />
                <span>SOLO INFINITY</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                <span>VS CPU</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Select Stage: Left preview / Middle Scrollable Roster / Right Live Model */}
      <main className="relative z-20 flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2 lg:gap-4 items-stretch lg:items-center py-1.5 sm:py-2 max-w-7xl mx-auto w-full">
        {/* Left Column (Compact 2-up Strip on Phone, Full Cards on Desktop) */}
        <div className="shrink-0 lg:col-span-3 flex flex-col gap-1.5 lg:gap-3">
          <div className={`grid ${isInfinityMode ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'} lg:grid-cols-1 gap-2 lg:gap-3 items-stretch`}>
            <div
              className={`relative p-2 sm:p-3 rounded-lg border-2 transition-all ${
                selectionPhase === 'P1'
                  ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.28)]'
                  : 'bg-slate-900/80 border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1 lg:mb-2">
                <span className="font-pixel text-[9px] sm:text-[11px] text-amber-400 flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 inline-block shrink-0" /> PLAYER 1
                </span>
                <span className="text-[8px] sm:text-[10px] text-slate-400 font-pixel">
                  {unlockedCharacters.includes(p1Selection) ? '1P' : 'LOCKED'}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <img
                  src={CHARACTERS[p1Selection].portraitUrl}
                  alt={CHARACTERS[p1Selection].name}
                  referrerPolicy="no-referrer"
                  className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-20 lg:h-20 rounded border-2 border-amber-500/80 object-contain bg-slate-950 pixelated shadow-lg shrink-0 ${
                    isP1Locked ? 'opacity-60 grayscale-[35%]' : ''
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-pixel text-[11px] sm:text-sm text-yellow-300 truncate">
                    {CHARACTERS[p1Selection].name}
                  </h4>
                  {getCharacterCoinBonusAmount(p1Selection) > 0 && (
                    <div className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 font-mono text-[9px] font-bold text-amber-200 tabular-nums">
                      +{getCharacterCoinBonusAmount(p1Selection)} V
                    </div>
                  )}
                  {isP1Locked && (
                    CHARACTERS[p1Selection]?.ownerOnly ? (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[9px] font-pixel font-black border bg-purple-950/90 border-purple-400/80 text-purple-200">
                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>OWNER ONLY</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={unlockBusy}
                        onClick={() => void handleDirectBuyChar(p1Selection)}
                        className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[9px] font-pixel font-black border cursor-pointer transition-all ${
                          canAffordUnlock
                            ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950'
                            : 'bg-black border-white/75 text-white hover:border-amber-300'
                        }`}
                      >
                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>BUY · {activeCost}V</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {isInfinityMode ? (
              <div className="hidden sm:flex lg:flex flex-col justify-center p-2.5 sm:p-3.5 rounded-lg border border-amber-500/40 bg-slate-900/85 space-y-1">
                <div className="flex items-center gap-2 font-pixel text-[10px] text-amber-300">
                  <InfinityIcon className="w-4 h-4 shrink-0" />
                  <span>SOLO INFINITY</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Endless zone progression with rotating arenas and V-Coin rewards.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:flex items-center justify-center my-0.5">
                  <div className="px-4 py-0.5 rounded-full bg-red-600/90 border border-yellow-400 font-pixel text-xs text-yellow-300 tracking-wider shadow">
                    VS
                  </div>
                </div>

                <div
                  className={`relative p-2 sm:p-3 rounded-lg border-2 transition-all ${
                    selectionPhase === 'P2'
                      ? 'bg-red-950/40 border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.28)]'
                      : 'bg-slate-900/80 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 lg:mb-2">
                    <span className="font-pixel text-[9px] sm:text-[11px] text-red-400 flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-400 inline-block shrink-0" /> CPU
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-slate-400 font-pixel">OPPONENT</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <img
                      src={CHARACTERS[p2Selection].portraitUrl}
                      alt={CHARACTERS[p2Selection].name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 sm:w-12 sm:h-12 lg:w-20 lg:h-20 rounded border-2 border-red-500/80 object-contain bg-slate-950 pixelated shadow-lg shrink-0"
                    />
                    <h4 className="font-pixel text-[11px] sm:text-sm text-red-300 truncate">
                      {CHARACTERS[p2Selection].name}
                    </h4>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Scrollable Fighter Box + Pinned Bottom Action Bar */}
        <div className="flex-1 min-h-0 lg:col-span-5 flex flex-col items-center lg:justify-center">
          {/* Compact Mobile Active Selection Info Strip */}
          <div className="lg:hidden shrink-0 w-full max-w-[560px] mb-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-pixel text-[10px] text-yellow-300 truncate">{activeFighter.name}</span>
              {activeCoinBonus > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400/60 font-mono text-[9px] font-bold text-amber-200 shrink-0 tabular-nums">
                  +{activeCoinBonus} V BONUS
                </span>
              )}
            </div>
            {isPlayerPickPhase && (
              unlockedCharacters.includes(activeCharId) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/70 font-pixel text-[8px] text-emerald-300 shrink-0">
                  <Check className="w-2.5 h-2.5" />
                  <span>OWNED</span>
                </span>
              ) : activeFighter.ownerOnly ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/90 border border-purple-400/80 font-pixel text-[8px] text-purple-200 shrink-0">
                  <Lock className="w-2.5 h-2.5 text-purple-300" />
                  <span>OWNER ONLY</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black border border-white/80 font-mono text-[10px] font-black text-white shrink-0">
                  <Lock className="w-2.5 h-2.5 text-amber-300" />
                  <span>{activeCost} V</span>
                </span>
              )
            )}
          </div>

          {/* Dedicated Scrollable Fighter Roster Box */}
          <div className="w-full max-w-[560px] flex-1 min-h-[156px] lg:flex-initial lg:max-h-[48vh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar rounded-xl border border-slate-700/80 bg-slate-900/70 p-2 sm:p-2.5 shadow-inner">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {CHARACTER_LIST.map((char) => {
                const isP1 = p1Selection === char.id;
                const isP2 = p2Selection === char.id;
                const isCurrent = (selectionPhase === 'P1' && isP1) || (selectionPhase === 'P2' && isP2);
                const isUnlocked = unlockedCharacters.includes(char.id);
                const price = getCharacterUnlockCost(char.id);
                const showLockBadge = isPlayerPickPhase && !isUnlocked;
                const tileAffordable = totalCoins >= price;

                return (
                  <div
                    key={char.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectFighter(char.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectFighter(char.id);
                      }
                    }}
                    className={`group relative flex flex-col items-center p-1.5 rounded-xl border-2 transition-all transform hover:scale-[1.03] active:scale-95 cursor-pointer ${
                      isCurrent
                        ? showLockBadge
                          ? 'border-amber-400 bg-slate-900 shadow-[0_0_22px_rgba(251,191,36,0.4)] ring-2 ring-amber-400/40'
                          : 'border-yellow-400 bg-amber-950/70 shadow-[0_0_25px_rgba(250,204,21,0.55)] ring-2 ring-yellow-400/50'
                        : showLockBadge
                        ? 'border-slate-800 bg-slate-950/90 hover:border-slate-600'
                        : 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
                    }`}
                  >
                    <div className="relative w-full h-12 sm:h-15 rounded-lg overflow-hidden border border-slate-700 shadow-lg bg-slate-950">
                      <img
                        src={char.portraitUrl}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-contain pixelated transition-transform group-hover:scale-105 ${
                          showLockBadge ? 'opacity-50 grayscale-[40%]' : ''
                        }`}
                      />

                      <div className="absolute top-1 left-1 flex gap-1">
                        {isP1 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-pixel text-[8px] font-black shadow-md border border-amber-300">
                            1P
                          </span>
                        )}
                        {!isInfinityMode && isP2 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-pixel text-[8px] font-black shadow-md border border-red-300">
                            CPU
                          </span>
                        )}
                      </div>

                      {showLockBadge && (
                        <span
                          className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-black/85 border border-amber-400/75 text-amber-300 flex items-center justify-center shadow"
                          title={`Locked - ${price} V-Coins`}
                        >
                          <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-center w-full">
                      <div
                        className={`font-pixel text-[9px] sm:text-[10px] tracking-wider truncate font-black ${
                          showLockBadge ? 'text-slate-300' : 'text-yellow-300'
                        }`}
                      >
                        {char.name}
                      </div>
                      {showLockBadge && (
                        char.ownerOnly ? (
                          <div
                            className="mt-1 w-full inline-flex items-center justify-center gap-1 px-1 py-0.5 rounded border text-[7px] sm:text-[8px] font-pixel font-black leading-none bg-purple-950/90 border-purple-400/80 text-purple-200"
                            title="Owner Exclusive (Locked for all other players)"
                          >
                            <span>OWNER</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={unlockBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDirectBuyChar(char.id);
                            }}
                            className={`mt-1 w-full inline-flex items-center justify-center gap-1 px-1 py-0.5 rounded border text-[8px] font-pixel font-black leading-none cursor-pointer transition-colors ${
                              tileAffordable
                                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950'
                                : 'bg-black hover:border-amber-300 border-white/75 text-white'
                            }`}
                            title={`Buy ${char.name} for ${price} V-Coins`}
                          >
                            <span>BUY</span>
                            <span className="font-mono">{price}V</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pinned Bottom Action Area (Always visible without scrolling) */}
          <div className="shrink-0 w-full max-w-[560px] flex flex-col items-center pt-2">
            {unlockFeedback && (
              <div
                className={`mb-2 w-full text-center px-3 py-1 rounded-lg border text-xs font-semibold ${
                  unlockFeedback.type === 'ok'
                    ? 'bg-emerald-950/85 border-emerald-400 text-emerald-200'
                    : 'bg-red-950/85 border-red-500 text-red-200'
                }`}
              >
                {unlockFeedback.text}
              </div>
            )}

            {isInspectingLocked ? (
              activeFighter.ownerOnly ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto py-2.5 sm:py-3 px-6 sm:px-7 rounded-lg font-pixel text-xs sm:text-sm tracking-wider font-black border-2 flex items-center justify-center gap-2 bg-purple-950/90 text-purple-200 border-purple-500/80 opacity-90 cursor-not-allowed"
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>OWNER EXCLUSIVE · LOCKED</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canAffordUnlock || unlockBusy}
                  onClick={() => void handleUnlockSelected()}
                  className={`w-full sm:w-auto py-2.5 sm:py-3 px-6 sm:px-7 rounded-lg font-pixel text-xs sm:text-sm tracking-wider font-black border-2 transition-all flex items-center justify-center gap-2 ${
                    canAffordUnlock
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 border-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer transform hover:-translate-y-0.5'
                      : 'bg-slate-900 text-slate-400 border-slate-700 opacity-80 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    {unlockBusy
                      ? 'BUYING...'
                      : canAffordUnlock
                      ? `BUY ${activeFighter.name} · ${activeCost} V ▶`
                      : `NEED ${activeCost - totalCoins} MORE V`}
                  </span>
                </button>
              )
            ) : (
              <button
                onClick={handleConfirmCurrent}
                className="w-full sm:w-auto py-2.5 sm:py-3 px-6 sm:px-7 rounded-lg font-pixel text-xs sm:text-sm tracking-wider font-black border-2 transition-all bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5 cursor-pointer"
              >
                {isInfinityMode
                  ? 'START INFINITY ▶'
                  : selectionPhase === 'P1'
                  ? 'CONFIRM PLAYER 1 ▶'
                  : selectionPhase === 'P2'
                  ? 'CONFIRM & CHOOSE ARENA ▶'
                  : 'PREPARING BATTLE...'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column (Desktop Spotlight Preview Canvas) */}
        <div className="hidden lg:flex lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex-col gap-3">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-pixel text-base sm:text-lg text-yellow-300 tracking-wider truncate">
                {activeFighter.name}
              </h3>
              {activeCoinBonus > 0 && (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400/60 font-mono text-[10px] font-bold text-amber-200 tabular-nums">
                  +{activeCoinBonus} V BONUS
                </div>
              )}
            </div>
            {isPlayerPickPhase && (
              unlockedCharacters.includes(activeCharId) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/70 font-pixel text-[8px] text-emerald-300 shrink-0">
                  <Check className="w-3 h-3" />
                  <span>OWNED</span>
                </span>
              ) : activeFighter.ownerOnly ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/90 border border-purple-400/80 font-pixel text-[8px] text-purple-200 shrink-0">
                  <Lock className="w-3 h-3 text-purple-300" />
                  <span>OWNER ONLY</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black border border-white/80 font-mono text-[11px] font-black text-white shrink-0">
                  <Lock className="w-3 h-3 text-amber-300" />
                  <span>{activeCost} V</span>
                </span>
              )
            )}
          </div>

          <div className="relative w-full h-60 sm:h-68 bg-slate-950/85 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
            <canvas
              ref={previewCanvasRef}
              width={280}
              height={250}
              className="w-full h-full object-contain pixelated"
            />
            {isInspectingLocked && (
              activeFighter.ownerOnly ? (
                <div className="absolute bottom-2.5 inset-x-3 px-3 py-1.5 rounded-lg bg-purple-950/95 border border-purple-400/80 flex items-center justify-between gap-2 text-xs">
                  <span className="text-purple-200 font-semibold truncate">
                    Exclusive to Owner (himank)
                  </span>
                  <span className="px-2.5 py-1 rounded bg-purple-900/90 border border-purple-400/60 text-purple-100 font-pixel text-[8px] shrink-0">
                    LOCKED
                  </span>
                </div>
              ) : (
                <div className="absolute bottom-2.5 inset-x-3 px-3 py-1.5 rounded-lg bg-black/90 border border-amber-400/70 flex items-center justify-between gap-2 text-xs">
                  <span className="text-amber-200 font-semibold truncate">
                    {canAffordUnlock
                      ? `Price: ${activeCost} V`
                      : `Need ${activeCost - totalCoins} more V`}
                  </span>
                  <button
                    type="button"
                    disabled={!canAffordUnlock || unlockBusy}
                    onClick={() => void handleUnlockSelected()}
                    className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-pixel text-[9px] font-black shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {unlockBusy ? 'BUYING...' : `BUY · ${activeCost} V`}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
