import React from 'react';
import { ArrowLeft, Volume2, VolumeX, Music, ShieldAlert } from 'lucide-react';
import { Difficulty, GameSettings } from '../types/game';
import { soundManager } from '../audio/soundManager';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onClose: () => void;
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'MASTER'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const update = (partial: Partial<GameSettings>) => {
    onUpdateSettings({ ...settings, ...partial });
  };

  const isSfxMuted = Boolean(settings.soundMuted);
  const isMusicMuted = Boolean(settings.musicMuted);

  const toggleSfxMuted = () => {
    const nextMuted = !isSfxMuted;
    const nextSfxVol = !nextMuted && settings.soundVolume <= 0 ? 1.0 : settings.soundVolume;
    soundManager.setSfxVolume(nextSfxVol);
    soundManager.setSfxMuted(nextMuted);
    update({
      soundMuted: nextMuted,
      soundVolume: nextSfxVol,
    });
    if (!nextMuted) {
      soundManager.playUiSelect();
    }
  };

  const toggleMusicMuted = () => {
    const nextMuted = !isMusicMuted;
    const nextBgmVol = !nextMuted && settings.musicVolume <= 0 ? 0.5 : settings.musicVolume;
    soundManager.setBgmVolume(nextBgmVol);
    soundManager.setBgmMuted(nextMuted);
    update({
      musicMuted: nextMuted,
      musicVolume: nextBgmVol,
    });
    if (!nextMuted) {
      soundManager.playBgm('lobby');
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar bg-slate-950 select-none flex flex-col justify-between p-2.5 sm:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3 max-w-3xl mx-auto w-full">
        <button
          type="button"
          onClick={() => {
            soundManager.playUiSelect();
            onClose();
          }}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] sm:text-xs font-pixel text-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>LOBBY</span>
        </button>

        <span className="font-pixel text-xs sm:text-base text-yellow-300 arcade-gold-shadow">
          GAME SETTINGS
        </span>

        <div className="w-16 sm:w-24 hidden sm:block" />
      </header>

      {/* Main Content */}
      <main className="relative z-20 flex-1 py-2.5 sm:py-5 max-w-2xl mx-auto w-full flex items-start sm:items-center justify-center">
        <section className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <h2 className="font-pixel text-xs text-amber-400">
              AUDIO &amp; TOURNAMENT RULES
            </h2>
            <span className="text-[10px] font-semibold text-slate-400">
              Independent Sound &amp; Song
            </span>
          </div>

          {/* Sound Effects Volume (Independent) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-pixel text-[11px] text-slate-200">
                {isSfxMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>SOUND (SFX)</span>
                <span className="text-[10px] text-amber-300 tabular-nums">
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </span>
              <button
                type="button"
                onClick={toggleSfxMuted}
                className={`px-3 py-1 rounded font-pixel text-[10px] border cursor-pointer transition-colors ${
                  isSfxMuted
                    ? 'bg-red-950/70 border-red-600 text-red-300 hover:bg-red-900/70'
                    : 'bg-emerald-950/70 border-emerald-600 text-emerald-300 hover:bg-emerald-900/70'
                }`}
              >
                {isSfxMuted ? 'OFF' : 'ON'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.soundVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                soundManager.setSfxVolume(v);
                if (v > 0 && isSfxMuted) {
                  soundManager.setSfxMuted(false);
                  update({ soundVolume: v, soundMuted: false });
                } else {
                  update({ soundVolume: v });
                }
              }}
              className="w-full accent-amber-400"
            />
          </div>

          {/* Lobby Song / BGM Volume (Independent) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-pixel text-[11px] text-slate-200">
                <Music className={`w-4 h-4 ${isMusicMuted ? 'text-red-400' : 'text-sky-400'}`} />
                <span>SONG (BGM)</span>
                <span className="text-[10px] text-sky-300 tabular-nums">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </span>
              <button
                type="button"
                onClick={toggleMusicMuted}
                className={`px-3 py-1 rounded font-pixel text-[10px] border cursor-pointer transition-colors ${
                  isMusicMuted
                    ? 'bg-red-950/70 border-red-600 text-red-300 hover:bg-red-900/70'
                    : 'bg-emerald-950/70 border-emerald-600 text-emerald-300 hover:bg-emerald-900/70'
                }`}
              >
                {isMusicMuted ? 'OFF' : 'ON'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                soundManager.setBgmVolume(v);
                if (v > 0 && isMusicMuted) {
                  soundManager.setBgmMuted(false);
                  soundManager.playBgm('lobby');
                  update({ musicVolume: v, musicMuted: false });
                } else {
                  update({ musicVolume: v });
                }
              }}
              className="w-full accent-sky-400"
            />
          </div>

          {/* CPU Difficulty */}
          <div className="space-y-2">
            <span className="flex items-center gap-2 font-pixel text-[11px] text-slate-200">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              CPU DIFFICULTY
            </span>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    soundManager.playUiMove();
                    update({ difficulty: d });
                  }}
                  className={`py-2 rounded font-pixel text-[10px] border transition-colors ${
                    settings.difficulty === d
                      ? 'bg-amber-500 text-slate-950 border-yellow-300 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Rounds & Timer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="font-pixel text-[10px] text-slate-300 block">ROUNDS TO WIN</span>
              <div className="flex gap-2">
                {[1, 2, 3].map(r => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => {
                      soundManager.playUiMove();
                      update({ roundsToWin: r });
                    }}
                    className={`flex-1 py-2 rounded font-pixel text-xs border ${
                      settings.roundsToWin === r
                        ? 'bg-amber-500 text-slate-950 border-yellow-300 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-pixel text-[10px] text-slate-300 block">ROUND TIMER</span>
              <div className="flex gap-2">
                {[60, 99, 0].map(sec => (
                  <button
                    type="button"
                    key={sec}
                    onClick={() => {
                      soundManager.playUiMove();
                      update({ roundTimerSec: sec });
                    }}
                    className={`flex-1 py-2 rounded font-pixel text-[10px] border ${
                      settings.roundTimerSec === sec
                        ? 'bg-amber-500 text-slate-950 border-yellow-300 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {sec === 0 ? 'INF' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                soundManager.playUiSelect();
                onClose();
              }}
              className="w-full sm:w-auto py-3 px-6 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-pixel text-xs font-bold border border-yellow-200"
            >
              SAVE &amp; RETURN
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

