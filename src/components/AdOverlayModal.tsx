import React, { useEffect, useState } from 'react';
import { CheckCircle2, Play, Sparkles, Tv, X, AlertCircle } from 'lucide-react';
import { RewardedAdBonusType } from '../services/admobService';
import { soundManager } from '../audio/soundManager';

interface RewardedBonusModalProps {
  initialFocus: RewardedAdBonusType;
  totalCoins: number;
  totalXP: number;
  soundMuted: boolean;
  onWatchRewardedAd: (bonusType: RewardedAdBonusType) => Promise<{
    granted: boolean;
    message: string;
  }>;
  onClose: () => void;
}

export const RewardedBonusModal: React.FC<RewardedBonusModalProps> = ({
  initialFocus,
  totalCoins,
  totalXP,
  soundMuted,
  onWatchRewardedAd,
  onClose,
}) => {
  const [selectedType, setSelectedType] = useState<RewardedAdBonusType>(initialFocus);
  const [busyType, setBusyType] = useState<RewardedAdBonusType | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSelectedType(initialFocus);
    setFeedback(null);
  }, [initialFocus]);

  const handleStartAd = async (bonusType: RewardedAdBonusType) => {
    if (busyType) return;
    setSelectedType(bonusType);
    setBusyType(bonusType);
    setFeedback(null);
    if (!soundMuted) soundManager.playUiSelect();

    try {
      const result = await onWatchRewardedAd(bonusType);
      setFeedback({ ok: result.granted, text: result.message });
      if (result.granted && !soundMuted) {
        if (bonusType === 'coins') {
          soundManager.playCoinPickup();
        } else {
          soundManager.playHealAndXp();
        }
      }
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-950 border-2 border-amber-400/90 shadow-[0_0_50px_rgba(245,158,11,0.35)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-900 via-amber-950/50 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="font-pixel text-xs sm:text-sm text-yellow-300 arcade-gold-shadow">
                FREE REWARDED AD BONUS
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5">
                1 Ad देखने पर तुरंत +100 V-Coins या +100 XP पाएं!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!soundMuted) soundManager.playUiSelect();
              onClose();
            }}
            disabled={Boolean(busyType)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Side-by-Side Coins (+100) and XP (+100) Cards */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: V-Coins +100 */}
            <div
              onClick={() => setSelectedType('coins')}
              className={`rounded-xl border-2 p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                selectedType === 'coins'
                  ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 to-slate-900 shadow-[0_0_24px_rgba(245,158,11,0.28)]'
                  : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-pixel text-[10px] text-amber-300">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white font-mono text-[9px] font-black text-white">
                      V
                    </span>
                    V-COINS
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                    Bal: {totalCoins.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg bg-black/50 border border-amber-500/40 p-2.5 text-center">
                  <div className="font-pixel text-base sm:text-lg text-yellow-300">+100 COINS</div>
                  <p className="text-[11px] text-amber-100/90 font-semibold mt-1">
                    एक Ad देखने पर आपको 100 V-Coins मिलते हैं
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={Boolean(busyType)}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStartAd('coins');
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-pixel text-[10px] font-black border border-yellow-200 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{busyType === 'coins' ? 'LOADING AD...' : 'WATCH AD (+100 COINS)'}</span>
              </button>
            </div>

            {/* Option 2: XP +100 */}
            <div
              onClick={() => setSelectedType('xp')}
              className={`rounded-xl border-2 p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                selectedType === 'xp'
                  ? 'border-cyan-400 bg-gradient-to-b from-cyan-950/60 to-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.28)]'
                  : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-pixel text-[10px] text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    PLAYER XP
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                    Bal: {totalXP.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg bg-black/50 border border-cyan-500/40 p-2.5 text-center">
                  <div className="font-pixel text-base sm:text-lg text-cyan-300">+100 XP</div>
                  <p className="text-[11px] text-cyan-100/90 font-semibold mt-1">
                    एक Ad देखने पर आपको 100 XP मिलेगी
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={Boolean(busyType)}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStartAd('xp');
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-pixel text-[10px] font-black border border-cyan-200 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{busyType === 'xp' ? 'LOADING AD...' : 'WATCH AD (+100 XP)'}</span>
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-xl px-3.5 py-2.5 border flex items-center gap-2 text-xs font-semibold ${
                feedback.ok
                  ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/80 text-rose-200'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
