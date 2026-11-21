import React, { useState } from 'react';
import { ArrowLeft, Music, Volume2, VolumeX } from 'lucide-react';
import { ArenaId } from '../types/game';
import { ARENAS, ARENA_LIST } from '../data/arenas';
import { soundManager } from '../audio/soundManager';

interface ArenaSelectProps {
  soundMuted: boolean;
  musicMuted: boolean;
  onToggleSound: () => boolean;
  onToggleMusic: () => boolean;
  onSelectArena: (arenaId: ArenaId) => void;
  onBack: () => void;
}

export const ArenaSelect: React.FC<ArenaSelectProps> = ({
  soundMuted,
  musicMuted,
  onToggleSound,
  onToggleMusic,
  onSelectArena,
  onBack,
}) => {
  const [selectedArenaId, setSelectedArenaId] = useState<ArenaId>('jungle_temple');

  const selectedArena = ARENAS[selectedArenaId];

  const handleSelect = (id: ArenaId) => {
    soundManager.playUiMove();
    setSelectedArenaId(id);
  };

  const handleConfirm = () => {
    soundManager.playUiSelect();
    onSelectArena(selectedArenaId);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 select-none flex flex-col justify-between p-2 sm:p-4 lg:p-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <img
        src={selectedArena.imageUrl}
        alt={selectedArena.name}
        referrerPolicy="no-referrer"
        className="fixed inset-0 w-full h-full object-cover object-center pixelated opacity-40 blur-xs transition-opacity duration-300 pointer-events-none"
      />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/90 pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3 gap-2">
        <button
          onClick={() => {
            soundManager.playUiSelect();
            onBack();
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] sm:text-xs font-pixel text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>FIGHTERS</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="font-pixel text-xs sm:text-sm text-yellow-300 tracking-wider">SELECT ARENA</span>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:w-28">
          <button
            type="button"
            onClick={() => {
              onToggleMusic();
              if (!soundMuted) soundManager.playUiSelect();
            }}
            title={musicMuted ? 'Song Off (Tap to Play Song)' : 'Song On (Tap to Mute Song)'}
            aria-label={musicMuted ? 'Unmute Song' : 'Mute Song'}
            className={`relative p-1.5 sm:p-2 rounded border shadow transition-colors cursor-pointer ${
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
            className={`p-1.5 sm:p-2 rounded border shadow transition-colors cursor-pointer ${
              soundMuted
                ? 'bg-red-950/90 border-red-500/80 text-red-300 hover:bg-red-900'
                : 'bg-slate-900 border-amber-400/70 text-amber-300 hover:bg-slate-800'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Content: 25 Arenas Scrollable Box & Stage Preview */}
      <main className="relative z-20 flex-1 min-h-0 flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:gap-4 lg:gap-6 items-stretch sm:items-center py-2 sm:py-3 max-w-7xl mx-auto w-full">
        {/* Arena Scroll Box */}
        <div className="flex-1 min-h-[155px] sm:col-span-6 lg:col-span-5 sm:h-full sm:max-h-[72dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar rounded-xl border border-slate-700/80 bg-slate-900/60 p-2 sm:p-2.5 shadow-inner">
          <div className="grid grid-cols-2 gap-2">
            {ARENA_LIST.map((arena, idx) => {
              const isSelected = selectedArenaId === arena.id;
              return (
                <button
                  key={arena.id}
                  onClick={() => handleSelect(arena.id)}
                  className={`group relative flex flex-col p-1.5 sm:p-2 rounded-lg border-2 text-left transition-all overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'border-yellow-400 bg-amber-950/50 shadow-[0_0_20px_rgba(250,204,21,0.38)] scale-[1.01]'
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                  }`}
                >
                  <div className="relative aspect-video w-full rounded overflow-hidden border border-slate-700 mb-1.5">
                    <img
                      src={arena.imageUrl}
                      alt={arena.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pixelated transition-transform group-hover:scale-105"
                    />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-700 text-[8px] font-pixel text-amber-300">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="font-pixel text-[9px] sm:text-[11px] text-yellow-300 truncate">{arena.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right (Top on Portrait Mobile): Featured Selected Arena Showcase & Action Button */}
        <div className="shrink-0 order-first sm:order-last sm:col-span-6 lg:col-span-7 flex flex-col gap-2 sm:gap-3 lg:gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-2 sm:p-3.5 lg:p-5">
          <div className="relative h-28 sm:h-36 md:h-48 lg:h-auto lg:aspect-video w-full rounded-lg overflow-hidden border-2 border-amber-500/80 shadow-2xl">
            <img
              src={selectedArena.imageUrl}
              alt={selectedArena.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover pixelated"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <div className="absolute bottom-2 sm:bottom-3 left-3 sm:left-4 right-3 sm:right-4 flex items-end justify-between">
              <h3 className="font-pixel text-xs sm:text-base lg:text-xl text-white drop-shadow truncate">
                {selectedArena.name}
              </h3>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleConfirm}
              className="w-full sm:w-auto py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 font-pixel text-xs sm:text-sm tracking-wider font-black border-2 border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              COMMENCE FIGHT ▶
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
