import React, { useState } from 'react';
import { Ban, LogOut, RefreshCw } from 'lucide-react';
import { UserAccountProfile } from '../types/game';
import { soundManager } from '../audio/soundManager';

interface BannedAccountModalProps {
  user: UserAccountProfile;
  onRecheckStatus: () => Promise<void>;
  onLogoutAndSwitch: () => void;
}

export const BannedAccountModal: React.FC<BannedAccountModalProps> = ({
  user,
  onRecheckStatus,
  onLogoutAndSwitch,
}) => {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (checking) return;
    soundManager.playUiSelect();
    setChecking(true);
    try {
      await onRecheckStatus();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/95 backdrop-blur-md overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md my-auto rounded-2xl bg-slate-900 border-2 border-red-500 p-6 shadow-[0_0_55px_rgba(239,68,68,0.35)] space-y-5 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-400">
          <Ban className="w-8 h-8" strokeWidth={2.4} />
        </div>

        <div className="space-y-2">
          <h2 className="font-pixel text-base sm:text-lg text-red-400">ACCOUNT BANNED</h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            This account has been suspended by the Owner. You cannot play or access Online Arena until the Owner unbans it, or you log out and create a new ID.
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex items-center gap-3 text-left">
          <img
            src={user.avatarUrl}
            alt={user.username}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full border border-red-500/70 object-cover pixelated shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-xs text-white truncate">{user.username}</div>
            <div className="font-mono text-[11px] text-slate-400 mt-0.5">
              {user.playerId || `FXP-${user.id.slice(0, 6).toUpperCase()}`}
            </div>
            {user.bannedReason && (
              <div className="text-xs text-red-300 mt-1 break-words">Reason: {user.bannedReason}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-pixel text-[10px] border border-slate-600 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'CHECKING...' : 'CHECK STATUS'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              onLogoutAndSwitch();
            }}
            className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-pixel text-[10px] border border-red-300 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>NEW ACCOUNT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
