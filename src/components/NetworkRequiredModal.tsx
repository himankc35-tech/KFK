import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { soundManager } from '../audio/soundManager';

export function useOnlineConnectivity() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? false : true
  );
  const [checking, setChecking] = useState(false);
  const [lastCheckFailed, setLastCheckFailed] = useState(false);
  const failStreakRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const probeHealthOnce = useCallback(async (timeoutMs: number): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller?.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }, []);

  const verifyConnection = useCallback(
    async (strictUserTrigger = true): Promise<boolean> => {
      if (inFlightRef.current && !strictUserTrigger) {
        return isOnline;
      }
      inFlightRef.current = true;
      if (strictUserTrigger) {
        setChecking(true);
        setLastCheckFailed(false);
      }

      try {
        let reachable = await probeHealthOnce(7000);
        if (!reachable && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          await new Promise(resolve => window.setTimeout(resolve, 450));
          reachable = await probeHealthOnce(7000);
        }

        if (reachable) {
          failStreakRef.current = 0;
          setLastCheckFailed(false);
          setIsOnline(true);
          return true;
        }

        failStreakRef.current += 1;
        const osReportsOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (osReportsOffline || strictUserTrigger || failStreakRef.current >= 2) {
          setIsOnline(false);
          if (strictUserTrigger) setLastCheckFailed(true);
        }
        return false;
      } finally {
        inFlightRef.current = false;
        if (strictUserTrigger) setChecking(false);
      }
    },
    [isOnline, probeHealthOnce]
  );

  useEffect(() => {
    const handleOffline = () => {
      void verifyConnection(true);
    };
    const handleOnline = () => {
      void verifyConnection(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    void verifyConnection(false);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [verifyConnection]);

  useEffect(() => {
    const intervalMs = isOnline ? 12000 : 3500;
    const id = window.setInterval(() => {
      void verifyConnection(false);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isOnline, verifyConnection]);

  return {
    isOnline,
    checking,
    lastCheckFailed,
    recheck: () => verifyConnection(true),
  };
}

interface NetworkRequiredModalProps {
  checking?: boolean;
  lastCheckFailed?: boolean;
  onRetry: () => void | Promise<unknown>;
}

export const NetworkRequiredModal: React.FC<NetworkRequiredModalProps> = ({
  checking = false,
  lastCheckFailed = false,
  onRetry,
}) => {
  return (
    <div
      className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-md overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex items-center justify-center p-4 select-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="network-required-title"
    >
      <div className="w-full max-w-md my-auto rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-rose-500 p-6 sm:p-7 text-center space-y-5 shadow-[0_0_60px_rgba(244,63,94,0.4)]">
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-950/80 border-2 border-rose-400 flex items-center justify-center shadow-[0_0_24px_rgba(244,63,94,0.45)] animate-pulse">
          <WifiOff className="w-8 h-8 text-rose-300" />
        </div>

        <div className="space-y-2">
          <h2
            id="network-required-title"
            className="font-pixel text-sm sm:text-base text-rose-300 tracking-wide"
          >
            NET BAND HAI! (NO INTERNET)
          </h2>
          <p className="text-sm sm:text-base text-white font-semibold leading-relaxed">
            कृपया पहले अपना इंटरनेट (Wi-Fi / Mobile Data) चालू करें। जब तक नेट चालू नहीं होगा, गेम आगे नहीं चलेगा।
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Net chalu karne ke baad neeche <span className="text-yellow-300 font-bold">RESTART</span> button dabayein — game check karke turant start ho jayega.
          </p>
        </div>

        {lastCheckFailed && !checking && (
          <div className="px-3 py-2 rounded-lg bg-rose-950/75 border border-rose-500/70 text-xs text-rose-200 font-semibold">
            Abhi bhi internet nahi mila — kripya Net ON karke fir se RESTART dabayein.
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            disabled={checking}
            onClick={() => {
              soundManager.playUiSelect();
              void onRetry();
            }}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 font-pixel text-xs font-black border-2 border-emerald-200 shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'CHECKING NET...' : 'RESTART / CHECK NET'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
