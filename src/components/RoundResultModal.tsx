import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, RotateCcw, Users, Home, Volume2, Award } from 'lucide-react';
import { CharacterId, InfinityAchievementId } from '../types/game';
import { CHARACTERS } from '../data/characters';
import { soundManager } from '../audio/soundManager';

interface DefeatMemeSpec {
  id: number;
  src: string;
  chromaKey: boolean;
}

const DEFEAT_MEMES: DefeatMemeSpec[] = [
  {
    id: 1,
    src: '/assets/aistudio/Plankton_Meme_Clean.mp4',
    chromaKey: false,
  },
  {
    id: 2,
    src: '/assets/aistudio/BlackCatClappingandSmilingmeme_GreenScre_8f3d6943.mp4',
    chromaKey: true,
  },
  {
    id: 3,
    src: '/assets/aistudio/Laughing_Cat_Meme_Clean.mp4',
    chromaKey: false,
  },
];

export interface InfinityRunSummary {
  zoneReached: number;
  defeatedCount: number;
  runCoins: number;
  runXP?: number;
  totalCoins: number;
  unlockedAchievements: InfinityAchievementId[];
}

interface RoundResultModalProps {
  winnerSide: 'p1' | 'p2';
  winnerCharId: CharacterId;
  loserCharId: CharacterId;
  p1Wins: number;
  p2Wins: number;
  isCpuMatch: boolean;
  isOnlineMatch?: boolean;
  p1Name?: string;
  p2Name?: string;
  defeatMemeIndex: number | null;
  infinitySummary?: InfinityRunSummary | null;
  matchCoinsEarned?: number;
  matchXpEarned?: number;
  localCharId?: CharacterId;
  winReason?: string;
  soundMuted: boolean;
  soundVolume: number;
  onRematch: () => void;
  onSelectFighters: () => void;
  onReturnLobby: () => void;
}

const SHERU_VICTORY_SFX_URL = '/assets/aistudio/sheru-victory-sfx.mp3';

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  winnerSide,
  winnerCharId,
  loserCharId,
  p1Wins,
  p2Wins,
  isCpuMatch,
  isOnlineMatch = false,
  p1Name,
  p2Name,
  defeatMemeIndex,
  infinitySummary,
  matchCoinsEarned = 0,
  matchXpEarned = 0,
  localCharId,
  winReason,
  soundMuted,
  soundVolume,
  onRematch,
  onSelectFighters,
  onReturnLobby,
}) => {
  const winnerDef = CHARACTERS[winnerCharId];
  const loserDef = CHARACTERS[loserCharId];

  const activeMeme: DefeatMemeSpec | null =
    defeatMemeIndex !== null && defeatMemeIndex >= 0
      ? DEFEAT_MEMES[defeatMemeIndex % DEFEAT_MEMES.length]
      : null;

  const isSheruVictory =
    !activeMeme && (winnerCharId === 'lion' || (isOnlineMatch && localCharId === 'lion'));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sheruAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);

  const stopMemePlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const audio = sheruAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // ignore audio teardown errors
      }
      sheruAudioRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.muted = true;
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore media teardown errors
      }
    }
  }, []);

  useEffect(() => {
    // Never play victory or defeat background song
    soundManager.stopBgm();
    if (!activeMeme) {
      if (isSheruVictory) {
        if (!soundMuted) {
          const audio = new Audio(SHERU_VICTORY_SFX_URL);
          audio.volume = Math.max(0, Math.min(1, soundVolume));
          sheruAudioRef.current = audio;
          void audio.play().catch(() => {
            setNeedsSoundTap(true);
          });
        }
      } else {
        soundManager.playAnnouncer('YOU_WIN');
      }
    }
    return () => {
      stopMemePlayback();
      soundManager.stopBgm();
    };
  }, [activeMeme, isSheruVictory, soundMuted, soundVolume, stopMemePlayback]);

  useEffect(() => {
    if (!activeMeme) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    video.src = activeMeme.src;
    video.loop = true;
    video.playsInline = true;
    video.muted = soundMuted;
    video.volume = Math.max(0, Math.min(1, soundVolume));

    const startPlayback = async () => {
      try {
        await video.play();
        if (!cancelled) setNeedsSoundTap(false);
      } catch {
        // Browser blocked unmuted autoplay; fall back to muted loop with tap-to-unmute
        if (cancelled) return;
        try {
          video.muted = true;
          await video.play();
          if (!cancelled && !soundMuted) setNeedsSoundTap(true);
        } catch {
          // ignore
        }
      }
    };
    void startPlayback();

    const renderChromaFrame = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (activeMeme.chromaKey && canvas && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const maxProcH = 360;
        const procScale = Math.min(1, maxProcH / vh);
        const pw = Math.max(2, Math.round(vw * procScale));
        const ph = Math.max(2, Math.round(vh * procScale));

        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const off = offscreenCanvasRef.current;
        if (off.width !== pw || off.height !== ph) {
          off.width = pw;
          off.height = ph;
        }
        const offCtx = off.getContext('2d', { willReadFrequently: true });
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, pw, ph);
          const frame = offCtx.getImageData(0, 0, pw, ph);
          const d = frame.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            const maxRB = r > b ? r : b;
            const greenness = g - maxRB;

            if (g > 68 && greenness > 20 && g > r * 1.15 && g > b * 1.15) {
              if (greenness > 52) {
                d[i + 3] = 0;
              } else {
                const alpha = Math.max(0, Math.min(255, Math.round(((52 - greenness) / 32) * 255)));
                d[i + 3] = alpha;
                d[i + 1] = Math.min(g, maxRB + 6);
              }
            } else if (g > r + 8 && g > b + 8) {
              // Suppress subtle green reflection spill on fur/whisker boundaries
              d[i + 1] = Math.round((g + maxRB) * 0.5);
            }
          }
          offCtx.putImageData(frame, 0, 0);

          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const cw = Math.max(1, Math.round(rect.width * dpr));
          const ch = Math.max(1, Math.round(rect.height * dpr));
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, cw, ch);
            const scale = Math.min(cw / pw, ch / ph);
            const drawW = pw * scale;
            const drawH = ph * scale;
            const dx = (cw - drawW) * 0.5;
            const dy = (ch - drawH) * 0.5;
            ctx.drawImage(off, dx, dy, drawW, drawH);
          }
        }
      }
      rafRef.current = requestAnimationFrame(renderChromaFrame);
    };

    if (activeMeme.chromaKey) {
      rafRef.current = requestAnimationFrame(renderChromaFrame);
    }

    return () => {
      cancelled = true;
      stopMemePlayback();
    };
  }, [activeMeme, soundMuted, soundVolume, stopMemePlayback]);

  const handleEnableSound = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = Math.max(0, Math.min(1, soundVolume));
      void video.play();
    }
    const audio = sheruAudioRef.current;
    if (audio && !soundMuted) {
      audio.volume = Math.max(0, Math.min(1, soundVolume));
      void audio.play();
    }
    setNeedsSoundTap(false);
  };

  const handleExit = (cb: () => void) => {
    stopMemePlayback();
    soundManager.playUiSelect();
    cb();
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 select-none flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-gradient-to-t from-black via-slate-950 to-amber-950/30 pointer-events-none" />

      <div className="relative z-20 w-full max-w-2xl my-auto bg-slate-900/95 border-2 border-yellow-400 rounded-2xl p-4 sm:p-8 shadow-[0_0_50px_rgba(250,204,21,0.3)] space-y-4 sm:space-y-5">
        {/* Top Winner Banner */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 font-pixel text-xs sm:text-sm text-yellow-300 arcade-gold-shadow">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span>
              {isOnlineMatch
                ? `${winnerSide === 'p1' ? p1Name || 'PLAYER 1' : p2Name || 'PLAYER 2'} WINS!`
                : winnerSide === 'p1'
                ? 'PLAYER 1 VICTORY!'
                : isCpuMatch
                ? 'CPU VICTORY!'
                : 'PLAYER 2 VICTORY!'}
            </span>
          </div>
          <div className="font-pixel text-xs text-slate-300 tabular-nums">
            {infinitySummary
              ? `ZONE ${infinitySummary.zoneReached} · KO ${infinitySummary.defeatedCount}`
              : `SCORE: ${p1Wins} - ${p2Wins}`}
          </div>
        </div>

        {(winReason === 'opponent_left' || winReason === 'opponent_disconnected') && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-950/85 border border-emerald-400/80 text-center font-pixel text-[10px] sm:text-xs text-emerald-200">
            OPPONENT LEFT THE MATCH — YOU WIN!
          </div>
        )}

        {infinitySummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-center">
            <div>
              <div className="font-pixel text-[9px] text-slate-400">ZONES</div>
              <div className="font-pixel text-sm text-amber-300 mt-1 tabular-nums">{infinitySummary.zoneReached}</div>
            </div>
            <div>
              <div className="font-pixel text-[9px] text-slate-400">V-COINS</div>
              <div className="font-pixel text-sm text-white mt-1 tabular-nums flex items-center justify-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white text-[9px] font-bold">V</span>
                <span>+{infinitySummary.runCoins}</span>
              </div>
            </div>
            <div>
              <div className="font-pixel text-[9px] text-slate-400">BONUS XP</div>
              <div className="font-pixel text-sm text-cyan-300 mt-1 tabular-nums">
                +{infinitySummary.runXP ?? 0}
              </div>
            </div>
            <div>
              <div className="font-pixel text-[9px] text-slate-400">MEDALS</div>
              <div className="font-pixel text-sm text-emerald-300 mt-1 tabular-nums flex items-center justify-center gap-1">
                <Award className="w-3.5 h-3.5" />
                <span>{infinitySummary.unlockedAchievements.length}/8</span>
              </div>
            </div>
          </div>
        ) : (matchCoinsEarned > 0 || matchXpEarned > 0) ? (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-center">
            <div>
              <div className="font-pixel text-[9px] text-slate-400">REWARD V-COINS</div>
              <div className="font-pixel text-sm text-white mt-1 tabular-nums flex items-center justify-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white text-[9px] font-bold">V</span>
                <span>+{matchCoinsEarned}</span>
              </div>
            </div>
            <div>
              <div className="font-pixel text-[9px] text-slate-400">REWARD XP</div>
              <div className="font-pixel text-sm text-cyan-300 mt-1 tabular-nums">+{matchXpEarned} XP</div>
            </div>
          </div>
        ) : null}

        {/* Character Portrait / Sequential Defeat Meme Video Slot & Quote */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            {activeMeme ? (
              <div
                onClick={needsSoundTap ? handleEnableSound : undefined}
                className={`relative w-56 h-44 sm:w-64 sm:h-52 rounded-xl border-3 border-yellow-400 overflow-hidden shadow-2xl bg-[radial-gradient(circle_at_center,#1e293b_0%,#020617_90%)] flex items-center justify-center ${
                  needsSoundTap ? 'cursor-pointer' : ''
                }`}
              >
                <video
                  ref={videoRef}
                  playsInline
                  loop
                  preload="auto"
                  className={
                    activeMeme.chromaKey
                      ? 'absolute w-1 h-1 opacity-0 pointer-events-none'
                      : 'w-full h-full object-contain'
                  }
                />
                {activeMeme.chromaKey && (
                  <canvas ref={canvasRef} className="w-full h-full block" />
                )}
                {needsSoundTap && (
                  <button
                    type="button"
                    onClick={handleEnableSound}
                    className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-pixel text-[9px] font-black flex items-center gap-1 shadow-md"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>SOUND</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={needsSoundTap ? handleEnableSound : undefined}
                className={`relative ${needsSoundTap ? 'cursor-pointer' : ''}`}
              >
                <img
                  src={winnerDef.portraitUrl}
                  alt={winnerDef.name}
                  referrerPolicy="no-referrer"
                  className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl border-3 border-yellow-400 object-contain pixelated shadow-2xl bg-slate-950"
                />
                {needsSoundTap && (
                  <button
                    type="button"
                    onClick={handleEnableSound}
                    className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-pixel text-[9px] font-black flex items-center gap-1 shadow-md"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>SOUND</span>
                  </button>
                )}
              </div>
            )}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded bg-yellow-400 text-slate-950 font-pixel text-[10px] font-black shadow whitespace-nowrap">
              {activeMeme ? 'K.O. REPLAY' : 'CHAMPION'}
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="font-pixel text-2xl sm:text-3xl text-yellow-300 arcade-gold-shadow">
              {winnerDef.name}
            </h2>
            <div className="text-xs font-pixel text-slate-300">
              DEFEATED <span className="text-red-300">{loserDef.name}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid grid-cols-1 ${isOnlineMatch ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3 pt-2 border-t border-slate-800`}>
          <button
            onClick={() => handleExit(onRematch)}
            className="py-3 px-4 rounded-lg bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 font-pixel text-xs font-black flex items-center justify-center gap-2 border border-yellow-200 shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isOnlineMatch ? 'ONLINE HUB' : 'REMATCH'}</span>
          </button>

          {!isOnlineMatch && (
            <button
              onClick={() => handleExit(onSelectFighters)}
              className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-pixel text-xs flex items-center justify-center gap-2 border border-slate-700"
            >
              <Users className="w-4 h-4 text-sky-400" />
              <span>FIGHTERS</span>
            </button>
          )}

          <button
            onClick={() => handleExit(onReturnLobby)}
            className="py-3 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 font-pixel text-xs flex items-center justify-center gap-2 border border-slate-800"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>LOBBY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
