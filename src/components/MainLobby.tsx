import React, { useEffect, useRef, useState } from 'react';
import { FolderCog, Globe, Infinity as InfinityIcon, Music, Plus, User, Volume2, VolumeX } from 'lucide-react';
import { UserAccountProfile } from '../types/game';
import { soundManager } from '../audio/soundManager';

interface MainLobbyProps {
  totalCoins: number;
  totalXP: number;
  soundMuted: boolean;
  musicMuted: boolean;
  user: UserAccountProfile | null;
  onOpenProfile: () => void;
  onToggleSound: () => boolean;
  onToggleMusic: () => boolean;
  onOpenRewardedAd: (type: 'coins' | 'xp') => void;
  onOwnerPanel?: () => void;
  onPlay: () => void;
  onOnline: () => void;
  onInfinity: () => void;
  onSettings: () => void;
}

export const MainLobby: React.FC<MainLobbyProps> = ({
  totalCoins,
  totalXP,
  soundMuted,
  musicMuted,
  user,
  onOpenProfile,
  onToggleSound,
  onToggleMusic,
  onOpenRewardedAd,
  onOwnerPanel,
  onPlay,
  onOnline,
  onInfinity,
  onSettings,
}) => {
  const isOwner = Boolean(user && (user.isOwner || user.username.trim().toLowerCase() === 'himank'));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));

  useEffect(() => {
    const syncViewport = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const isLandscapeShort = viewport.w >= 500 && viewport.h <= 520;
  const isPortraitCompact = !isLandscapeShort && viewport.h <= 680;
  const isMobilePortrait = !isLandscapeShort && viewport.w < 640;

  // Subtle canvas environmental animations over the uploaded jungle temple image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgImg = new Image();
    bgImg.src = '/assets/aistudio/Gemini_Generated_Image_mbj2pxmbj2pxmbj2_b73b2b99.png';

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const leaves: { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number; color: string }[] = [];
    const motes: { x: number; y: number; vx: number; vy: number; radius: number; alpha: number; pulse: number }[] = [];

    for (let i = 0; i < 24; i++) {
      leaves.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.75 + Math.random() * 1.4,
        vy: 0.45 + Math.random() * 1.1,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        size: 5 + Math.random() * 6,
        color: Math.random() > 0.4 ? '#4ade80' : '#84cc16',
      });
    }

    for (let i = 0; i < 36; i++) {
      motes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.45,
        radius: 1.5 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.5,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;
    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      if (bgImg.complete && bgImg.naturalWidth > 0) {
        const coverScale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
        const drawW = bgImg.naturalWidth * coverScale;
        const drawH = bgImg.naturalHeight * coverScale;
        const drawX = (width - drawW) * 0.5;
        const drawY = (height - drawH) * 0.5;

        ctx.save();
        ctx.globalAlpha = 0.24;
        const canopyH = height * 0.28;
        const sliceH = 12;
        for (let sy = 0; sy < canopyH; sy += sliceH) {
          const weight = 1 - sy / canopyH;
          const swayX = Math.sin(time * 2.1 + sy * 0.045) * (2.6 * weight);
          const srcY = ((sy - drawY) / drawH) * bgImg.naturalHeight;
          const srcSliceH = (sliceH / drawH) * bgImg.naturalHeight;
          if (srcY >= 0 && srcY + srcSliceH <= bgImg.naturalHeight) {
            ctx.drawImage(bgImg, 0, srcY, bgImg.naturalWidth, srcSliceH, drawX + swayX, sy, drawW, sliceH + 1);
          }
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.32;
        const waterTop = height * 0.76;
        const waterBottom = height * 0.94;
        const wSlice = 4;
        for (let wy = waterTop; wy < waterBottom; wy += wSlice) {
          const waveX = Math.sin(time * 5.2 + wy * 0.24) * 2.4;
          const srcY = ((wy - drawY) / drawH) * bgImg.naturalHeight;
          const srcSliceH = (wSlice / drawH) * bgImg.naturalHeight;
          if (srcY >= 0 && srcY + srcSliceH <= bgImg.naturalHeight) {
            ctx.drawImage(
              bgImg,
              bgImg.naturalWidth * 0.52,
              srcY,
              bgImg.naturalWidth * 0.44,
              srcSliceH,
              drawX + drawW * 0.52 + waveX,
              wy,
              drawW * 0.44,
              wSlice + 0.5
            );
          }
        }
        ctx.restore();
      }

      const pondX = width * 0.72;
      const pondY = height * 0.82;
      ctx.save();
      for (let r = 0; r < 4; r++) {
        const rad = ((time * 25 + r * 35) % 90) + 10;
        const alpha = Math.max(0, 0.35 - rad / 120);
        ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(pondX + Math.sin(r) * 40, pondY + Math.cos(r) * 15, rad, rad * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      const lanternX = width * 0.31;
      const lanternY = height * 0.74;
      const lanternGlow = 0.25 + Math.sin(time * 6) * 0.06 + Math.sin(time * 14) * 0.04;
      const grad = ctx.createRadialGradient(lanternX, lanternY, 5, lanternX, lanternY, 95);
      grad.addColorStop(0, `rgba(251, 191, 36, ${lanternGlow})`);
      grad.addColorStop(0.5, `rgba(245, 158, 11, ${lanternGlow * 0.5})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lanternX, lanternY, 95, 0, Math.PI * 2);
      ctx.fill();

      motes.forEach(m => {
        m.x += m.vx;
        m.y += m.vy;
        m.pulse += 0.04;
        if (m.y < -10) m.y = height + 10;
        if (m.x < -10) m.x = width + 10;
        if (m.x > width + 10) m.x = -10;

        const currentAlpha = m.alpha * (0.6 + Math.sin(m.pulse) * 0.4);
        ctx.fillStyle = `rgba(253, 224, 71, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      leaves.forEach(l => {
        l.x += l.vx;
        l.y += l.vy;
        l.rot += l.rotSpeed;
        if (l.x > width + 20) l.x = -20;
        if (l.y > height + 20) l.y = -20;

        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.fillStyle = l.color;
        ctx.fillRect(-l.size / 2, -l.size / 4, l.size, l.size / 2);
        ctx.fillStyle = '#166534';
        ctx.fillRect(-l.size / 4, 0, l.size / 2, 1);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const renderActionButtons = () => {
    const compact = isLandscapeShort || isPortraitCompact;
    const useTwoColModes = isLandscapeShort || isMobilePortrait || isPortraitCompact;

    return (
      <div
        className={`pointer-events-auto w-full ${
          isLandscapeShort
            ? 'max-w-[330px] grid grid-cols-2 gap-1.5'
            : useTwoColModes
            ? `max-w-[340px] sm:max-w-sm grid grid-cols-2 ${compact ? 'gap-2' : 'gap-2.5'}`
            : 'max-w-xs sm:max-w-sm flex flex-col items-center gap-3'
        }`}
      >
        {/* EXCLUSIVE OWNER FOLDER PANEL BUTTON (Only visible to Owner "himank") */}
        {isOwner && onOwnerPanel && (
          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              onOwnerPanel();
            }}
            className={`${
              useTwoColModes ? 'col-span-2' : 'w-full'
            } group relative w-full text-left cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 transition-all`}
          >
            <div
              className={`inline-flex items-center gap-1 ml-2 rounded-t-md bg-amber-500 border-2 border-b-0 border-yellow-200 text-slate-950 font-pixel font-black tracking-wider ${
                compact ? 'px-2 py-0.5 text-[7px]' : 'px-2.5 py-0.5 sm:px-3 sm:py-1 text-[8px]'
              }`}
            >
              <span>OWNER</span>
            </div>
            <div
              className={`w-full rounded-lg rounded-tl-none bg-gradient-to-r from-slate-950 via-amber-950/90 to-slate-950 hover:from-amber-950 hover:to-slate-900 text-yellow-200 font-pixel tracking-wider border-2 border-amber-400 shadow-[0_6px_22px_rgba(245,158,11,0.4)] flex items-center justify-between gap-2 ${
                compact ? 'py-2 px-3.5 text-[10px]' : 'py-2.5 sm:py-3 px-4 sm:px-5 text-xs sm:text-sm'
              }`}
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <FolderCog className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-300 shrink-0`} strokeWidth={2.4} />
                <span>OWNER PANEL</span>
              </span>
              <span className="text-amber-300 text-xs">▶</span>
            </div>
          </button>
        )}

        {/* PLAY Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playUiSelect();
            onPlay();
          }}
          className={`${
            useTwoColModes ? 'col-span-2' : 'w-full'
          } group relative w-full px-6 rounded-lg bg-gradient-to-r from-red-700 via-red-600 to-amber-500 hover:from-red-600 hover:to-amber-400 text-white font-pixel tracking-wider text-center border-2 border-yellow-300 shadow-[0_8px_28px_rgba(239,68,68,0.55)] hover:shadow-[0_0_36px_rgba(250,204,21,0.85)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
            compact ? 'py-2.5 text-sm' : 'py-3.5 sm:py-4 text-base sm:text-lg'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            <span className="text-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
            <span>PLAY</span>
            <span className="text-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity">◀</span>
          </span>
          <div className="absolute inset-0 bg-yellow-300/15 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
        </button>

        {/* ONLINE ARENA Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playUiSelect();
            onOnline();
          }}
          className={`${
            useTwoColModes ? 'col-span-1 px-2' : 'w-full px-6'
          } group relative w-full rounded-lg bg-gradient-to-r from-cyan-950 via-slate-900 to-emerald-950 hover:from-cyan-900 hover:to-emerald-900 text-cyan-200 hover:text-white font-pixel tracking-wide text-center border-2 border-cyan-400/90 shadow-[0_6px_22px_rgba(34,211,238,0.3)] hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
            compact
              ? 'py-2.5 text-[9px]'
              : useTwoColModes
              ? 'py-3 text-[9px] sm:text-xs'
              : 'py-3.5 text-sm'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Globe className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-cyan-300 group-hover:rotate-12 transition-transform shrink-0`} strokeWidth={2.3} />
            <span>ONLINE</span>
          </span>
        </button>

        {/* INFINITY Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playUiSelect();
            onInfinity();
          }}
          className={`${
            useTwoColModes ? 'col-span-1 px-2' : 'w-full px-8'
          } group relative w-full rounded-lg bg-gradient-to-r from-slate-950 via-zinc-900 to-slate-950 hover:from-zinc-900 hover:to-slate-800 text-amber-300 hover:text-yellow-200 font-pixel tracking-wide text-center border-2 border-amber-400/90 shadow-[0_6px_22px_rgba(245,158,11,0.35)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
            compact
              ? 'py-2.5 text-[9px]'
              : useTwoColModes
              ? 'py-3 text-[9px] sm:text-xs'
              : 'py-3.5 text-base'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
            <InfinityIcon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4 sm:w-5 sm:h-5'} text-amber-300 group-hover:text-yellow-200 transition-transform group-hover:scale-110 shrink-0`} strokeWidth={2.5} />
            <span>INFINITY</span>
          </span>
        </button>

        {/* SETTINGS Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playUiSelect();
            onSettings();
          }}
          className={`${
            useTwoColModes ? 'col-span-2' : 'w-full'
          } group relative w-full px-6 rounded-lg bg-slate-950/85 hover:bg-slate-900/95 text-slate-200 hover:text-white font-pixel tracking-wider text-center border-2 border-slate-600/90 hover:border-amber-400 shadow-[0_6px_20px_rgba(0,0,0,0.75)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm cursor-pointer ${
            compact ? 'py-2 text-[10px]' : 'py-3 sm:py-3.5 text-xs sm:text-sm'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span className="text-amber-400">⚙</span>
            <span>SETTINGS</span>
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y custom-scrollbar select-none bg-black">
      <div className="fixed inset-0 pointer-events-none">
        <img
          src="/assets/aistudio/Gemini_Generated_Image_mbj2pxmbj2pxmbj2_b73b2b99.png"
          alt="Banyan Jungle Temple"
          className="w-full h-full object-cover object-center pixelated"
        />
        <div className="absolute inset-0 bg-radial from-transparent via-black/15 to-black/70 pointer-events-none" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
      </div>

      <div className="relative z-20 h-full min-h-[100dvh] flex flex-col justify-between">
        {/* Top Bar: Profile Button & Unified Coin/XP Wallet */}
        <header
          className={`relative z-40 shrink-0 flex items-center justify-between gap-1.5 sm:gap-3 pointer-events-none ${
            isLandscapeShort
              ? 'px-3.5 pt-2'
              : 'px-2.5 sm:px-6 pt-[max(0.625rem,env(safe-area-inset-top))] sm:pt-4'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              onOpenProfile();
            }}
            className={`pointer-events-auto min-w-0 flex items-center gap-1.5 sm:gap-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border-2 border-amber-400/90 hover:border-yellow-300 shadow-[0_6px_24px_rgba(0,0,0,0.65)] transition-all active:scale-95 cursor-pointer ${
              isLandscapeShort ? 'pr-2.5 pl-1.5 py-1' : 'pr-2.5 sm:pr-4 pl-1.5 sm:pl-2 py-1 sm:py-2'
            }`}
          >
            <div
              className={`rounded-full overflow-hidden border border-amber-300 bg-slate-900 flex items-center justify-center shrink-0 ${
                isLandscapeShort ? 'w-7 h-7' : 'w-7 h-7 sm:w-9 sm:h-9'
              }`}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover pixelated"
                />
              ) : (
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              )}
            </div>
            <div className="text-left leading-tight min-w-0">
              <div className="font-pixel text-[8px] sm:text-[11px] text-yellow-200 max-w-[54px] min-[400px]:max-w-[78px] sm:max-w-[170px] truncate">
                {user ? user.username : 'PROFILE'}
              </div>
              <div className="text-[7px] sm:text-[9px] text-amber-300/85 font-semibold truncate">
                {isOwner ? 'OWNER' : user ? 'ACTIVE' : 'SIGN IN'}
              </div>
            </div>
          </button>

          <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Unified V-Coins Wallet + Rewarded Ad '+' Button */}
            <div className="pl-1.5 pr-1 sm:pl-2.5 sm:pr-1.5 py-0.5 sm:py-1 rounded-lg bg-black/90 border-2 border-white flex items-center gap-1 sm:gap-1.5 shadow-lg">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-black border border-white font-mono text-[8px] sm:text-[10px] font-black text-white leading-none shrink-0">
                V
              </span>
              <span className="font-pixel text-[8px] sm:text-xs text-white tabular-nums">
                {totalCoins.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!soundMuted) soundManager.playUiSelect();
                  onOpenRewardedAd('coins');
                }}
                title="Watch Ad for +100 V-Coins"
                aria-label="Watch Ad for +100 V-Coins"
                className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded bg-amber-400 hover:bg-yellow-300 text-slate-950 font-black transition-transform active:scale-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={3} />
              </button>
            </div>

            {/* Unified XP Wallet + Rewarded Ad '+' Button */}
            <div className="pl-1.5 pr-1 sm:pl-2.5 sm:pr-1.5 py-0.5 sm:py-1 rounded-lg bg-slate-950/90 border-2 border-cyan-400/80 flex items-center gap-1 sm:gap-1.5 shadow-lg">
              <span className="font-pixel text-[8px] sm:text-[9px] text-cyan-300">XP</span>
              <span className="font-pixel text-[8px] sm:text-xs text-white tabular-nums">
                {totalXP.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!soundMuted) soundManager.playUiSelect();
                  onOpenRewardedAd('xp');
                }}
                title="Watch Ad for +100 XP"
                aria-label="Watch Ad for +100 XP"
                className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black transition-transform active:scale-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={3} />
              </button>
            </div>

            {/* Independent Song Toggle */}
            <button
              type="button"
              onClick={() => {
                onToggleMusic();
                if (!soundMuted) soundManager.playUiSelect();
              }}
              title={musicMuted ? 'Song Off (Tap to Play Song)' : 'Song On (Tap to Mute Song)'}
              aria-label={musicMuted ? 'Unmute Song' : 'Mute Song'}
              className={`relative p-1 sm:p-1.5 rounded-lg border-2 shadow-lg transition-colors cursor-pointer ${
                musicMuted
                  ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                  : 'bg-slate-950/90 border-sky-400/80 text-sky-300 hover:bg-slate-900'
              }`}
            >
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {musicMuted && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="w-4.5 h-0.5 bg-red-400 rotate-45 rounded-full" />
                </span>
              )}
            </button>

            {/* Independent SFX Sound Toggle */}
            <button
              type="button"
              onClick={() => {
                const muted = onToggleSound();
                if (!muted) soundManager.playUiSelect();
              }}
              title={soundMuted ? 'Sound Effects Muted (Tap to Unmute)' : 'Sound Effects On (Tap to Mute)'}
              aria-label={soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              className={`p-1 sm:p-1.5 rounded-lg border-2 shadow-lg transition-colors cursor-pointer ${
                soundMuted
                  ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                  : 'bg-slate-950/90 border-amber-400/80 text-amber-300 hover:bg-slate-900'
              }`}
            >
              {soundMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </header>

        {/* Adaptive Main Stage: Landscape 2-Col Showcase vs Portrait Full-Screen Fit */}
        {isLandscapeShort ? (
          <main className="relative z-30 pointer-events-none flex-1 min-h-0 flex items-center justify-between gap-4 px-5 pb-3 max-w-5xl mx-auto w-full">
            <div className="flex flex-col items-start text-left max-w-[46%]">
              <h1 className="font-pixel text-[clamp(1.65rem,4.6vw,2.75rem)] text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-400 to-red-600 drop-shadow-[0_6px_12px_rgba(0,0,0,0.95)] tracking-tight leading-tight">
                FIGHTER XP
              </h1>
              <div className="mt-2 h-1 w-40 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-transparent shadow-[0_0_16px_rgba(251,191,36,0.7)]" />
            </div>

            {renderActionButtons()}
          </main>
        ) : (
          <main
            className={`relative z-30 pointer-events-none flex-1 min-h-0 flex flex-col items-center justify-between px-4 ${
              isPortraitCompact
                ? 'pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-2'
                : 'pt-3 sm:pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-8 gap-3 sm:gap-4'
            }`}
          >
            <div className="flex flex-col items-center text-center mt-0.5 sm:mt-2">
              <h1
                className={`font-pixel text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-400 to-red-600 drop-shadow-[0_6px_12px_rgba(0,0,0,0.95)] tracking-tight leading-tight px-2 ${
                  isPortraitCompact
                    ? 'text-[clamp(1.5rem,7vw,2.5rem)]'
                    : 'text-[clamp(1.75rem,8vw,4.5rem)]'
                }`}
              >
                FIGHTER XP
              </h1>
              <div
                className={`rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_16px_rgba(251,191,36,0.7)] ${
                  isPortraitCompact ? 'mt-1.5 h-1 w-28' : 'mt-2 sm:mt-3 h-1 w-32 sm:w-56'
                }`}
              />
            </div>

            {renderActionButtons()}
          </main>
        )}
      </div>
    </div>
  );
};
