export const ADMOB_CONFIG = {
  appId: 'ca-app-pub-4386260051887900~6489894791',
  publisherId: 'ca-pub-4386260051887900',
  interstitialAdUnitId: 'ca-app-pub-4386260051887900/9471281351',
  rewardedInterstitialAdUnitId: 'ca-app-pub-4386260051887900/6535668817',
} as const;

export type RewardedAdBonusType = 'coins' | 'xp';

export interface AdDisplayResult {
  completed: boolean;
  rewardGranted: boolean;
  source:
    | 'native_capacitor'
    | 'native_android_bridge'
    | 'native_admob_plus'
    | 'google_h5_adbreak'
    | 'unavailable';
  breakStatus?: string;
  error?: string;
}

interface AdBreakPlacementConfig {
  type: 'next' | 'browse' | 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: { breakStatus?: string }) => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (config: AdBreakPlacementConfig) => void;
    adConfig?: (config: { preloadAdBreaks?: string; sound?: string; onReady?: () => void }) => void;
    Capacitor?: {
      Plugins?: {
        AdMob?: {
          initialize?: (opts?: Record<string, unknown>) => Promise<void>;
          prepareInterstitial?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
          showInterstitial?: () => Promise<void>;
          prepareRewardInterstitialAd?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
          showRewardInterstitialAd?: () => Promise<{ type?: string; amount?: number } | void>;
          prepareRewardVideoAd?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
          showRewardVideoAd?: () => Promise<{ type?: string; amount?: number } | void>;
        };
      };
    };
    admob?: {
      InterstitialAd?: new (opts: { adUnitId: string }) => {
        load: () => Promise<void>;
        show: () => Promise<void>;
      };
      RewardedInterstitialAd?: new (opts: { adUnitId: string }) => {
        load: () => Promise<void>;
        show: () => Promise<void>;
        on?: (event: string, cb: (payload?: unknown) => void) => void;
      };
    };
    AndroidAdMob?: {
      initialize?: (appId: string) => void;
      preloadInterstitial?: (adUnitId: string) => void;
      preloadRewardedInterstitial?: (adUnitId: string) => void;
      showInterstitial?: (adUnitId: string) => boolean | void;
      showRewardedInterstitial?: (adUnitId: string, rewardType: string, amount: number) => boolean | void;
    };
    FighterXPAdMob?: {
      appId: string;
      interstitialAdUnitId: string;
      rewardedInterstitialAdUnitId: string;
      completeNativeAd: (rewarded: boolean) => void;
    };
  }
}

class AdMobService {
  private initialized = false;
  private pendingNativeResolve: ((result: AdDisplayResult) => void) | null = null;
  private activeLock = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.FighterXPAdMob = {
        appId: ADMOB_CONFIG.appId,
        interstitialAdUnitId: ADMOB_CONFIG.interstitialAdUnitId,
        rewardedInterstitialAdUnitId: ADMOB_CONFIG.rewardedInterstitialAdUnitId,
        completeNativeAd: (rewarded: boolean) => {
          if (this.pendingNativeResolve) {
            const done = this.pendingNativeResolve;
            this.pendingNativeResolve = null;
            done({
              completed: true,
              rewardGranted: Boolean(rewarded),
              source: 'native_android_bridge',
            });
          }
        },
      };
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    try {
      const capAdMob = window.Capacitor?.Plugins?.AdMob;
      if (capAdMob?.initialize) {
        await capAdMob.initialize({ requestTrackingAuthorization: true });
        void capAdMob.prepareInterstitial?.({ adId: ADMOB_CONFIG.interstitialAdUnitId }).catch(() => {});
        void capAdMob.prepareRewardInterstitialAd?.({ adId: ADMOB_CONFIG.rewardedInterstitialAdUnitId }).catch(() => {});
      }
      if (window.AndroidAdMob?.initialize) {
        window.AndroidAdMob.initialize(ADMOB_CONFIG.appId);
        window.AndroidAdMob.preloadInterstitial?.(ADMOB_CONFIG.interstitialAdUnitId);
        window.AndroidAdMob.preloadRewardedInterstitial?.(ADMOB_CONFIG.rewardedInterstitialAdUnitId);
      }
      if (typeof window.adConfig === 'function') {
        window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
      }
    } catch {
      // Non-fatal if native bridge is absent in browser
    }
  }

  /**
   * Interstitial Ad: Strictly triggered when returning to Lobby after a fight.
   * Ad Unit ID: ca-app-pub-4386260051887900/9471281351
   */
  public async showPostMatchInterstitial(onAdLifecycle?: {
    onBeforeAd?: () => void;
    onAfterAd?: () => void;
  }): Promise<AdDisplayResult> {
    if (this.activeLock) {
      return { completed: false, rewardGranted: false, source: 'unavailable', error: 'Ad already open' };
    }
    this.activeLock = true;
    try {
      await this.initialize();

      // 1. Capacitor native AdMob plugin (Android/iOS app build)
      const capAdMob = window.Capacitor?.Plugins?.AdMob;
      if (capAdMob?.prepareInterstitial && capAdMob?.showInterstitial) {
        try {
          onAdLifecycle?.onBeforeAd?.();
          await capAdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitialAdUnitId });
          await capAdMob.showInterstitial();
          onAdLifecycle?.onAfterAd?.();
          void capAdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitialAdUnitId }).catch(() => {});
          return { completed: true, rewardGranted: false, source: 'native_capacitor' };
        } catch {
          onAdLifecycle?.onAfterAd?.();
        }
      }

      // 2. admob-plus Cordova / Capacitor plugin
      if (window.admob?.InterstitialAd) {
        try {
          onAdLifecycle?.onBeforeAd?.();
          const ad = new window.admob.InterstitialAd({ adUnitId: ADMOB_CONFIG.interstitialAdUnitId });
          await ad.load();
          await ad.show();
          onAdLifecycle?.onAfterAd?.();
          return { completed: true, rewardGranted: false, source: 'native_admob_plus' };
        } catch {
          onAdLifecycle?.onAfterAd?.();
        }
      }

      // 3. Android Studio WebView JavascriptInterface bridge
      if (window.AndroidAdMob?.showInterstitial) {
        onAdLifecycle?.onBeforeAd?.();
        const nativeRes = await this.tryAndroidBridge(() =>
          Boolean(window.AndroidAdMob?.showInterstitial?.(ADMOB_CONFIG.interstitialAdUnitId))
        );
        onAdLifecycle?.onAfterAd?.();
        if (nativeRes) return nativeRes;
      }

      // 4. Google AdSense H5 Games Ad Placement API (real browser ads)
      return await this.tryGoogleH5Interstitial(onAdLifecycle);
    } finally {
      this.activeLock = false;
    }
  }

  /**
   * Rewarded Interstitial Ad: Triggered from Lobby '+' on Coins (+100) or XP (+100).
   * Ad Unit ID: ca-app-pub-4386260051887900/6535668817
   */
  public async showRewardedInterstitial(
    rewardType: RewardedAdBonusType,
    rewardAmount = 100,
    onAdLifecycle?: { onBeforeAd?: () => void; onAfterAd?: () => void }
  ): Promise<AdDisplayResult> {
    if (this.activeLock) {
      return { completed: false, rewardGranted: false, source: 'unavailable', error: 'Ad already loading' };
    }
    this.activeLock = true;
    try {
      await this.initialize();

      // 1. Capacitor native AdMob plugin
      const capAdMob = window.Capacitor?.Plugins?.AdMob;
      if (capAdMob?.prepareRewardInterstitialAd && capAdMob?.showRewardInterstitialAd) {
        try {
          onAdLifecycle?.onBeforeAd?.();
          await capAdMob.prepareRewardInterstitialAd({ adId: ADMOB_CONFIG.rewardedInterstitialAdUnitId });
          const reward = await capAdMob.showRewardInterstitialAd();
          onAdLifecycle?.onAfterAd?.();
          void capAdMob.prepareRewardInterstitialAd({ adId: ADMOB_CONFIG.rewardedInterstitialAdUnitId }).catch(() => {});
          return {
            completed: true,
            rewardGranted: reward === undefined || Number(reward?.amount ?? 1) > 0,
            source: 'native_capacitor',
          };
        } catch {
          onAdLifecycle?.onAfterAd?.();
        }
      } else if (capAdMob?.prepareRewardVideoAd && capAdMob?.showRewardVideoAd) {
        try {
          onAdLifecycle?.onBeforeAd?.();
          await capAdMob.prepareRewardVideoAd({ adId: ADMOB_CONFIG.rewardedInterstitialAdUnitId });
          const reward = await capAdMob.showRewardVideoAd();
          onAdLifecycle?.onAfterAd?.();
          return {
            completed: true,
            rewardGranted: reward === undefined || Number(reward?.amount ?? 1) > 0,
            source: 'native_capacitor',
          };
        } catch {
          onAdLifecycle?.onAfterAd?.();
        }
      }

      // 2. admob-plus RewardedInterstitialAd
      if (window.admob?.RewardedInterstitialAd) {
        try {
          onAdLifecycle?.onBeforeAd?.();
          const ad = new window.admob.RewardedInterstitialAd({
            adUnitId: ADMOB_CONFIG.rewardedInterstitialAdUnitId,
          });
          let earned = false;
          ad.on?.('reward', () => {
            earned = true;
          });
          await ad.load();
          await ad.show();
          onAdLifecycle?.onAfterAd?.();
          return { completed: true, rewardGranted: earned, source: 'native_admob_plus' };
        } catch {
          onAdLifecycle?.onAfterAd?.();
        }
      }

      // 3. Android Studio WebView JavascriptInterface bridge
      if (window.AndroidAdMob?.showRewardedInterstitial) {
        onAdLifecycle?.onBeforeAd?.();
        const nativeRes = await this.tryAndroidBridge(() =>
          Boolean(
            window.AndroidAdMob?.showRewardedInterstitial?.(
              ADMOB_CONFIG.rewardedInterstitialAdUnitId,
              rewardType,
              rewardAmount
            )
          )
        );
        onAdLifecycle?.onAfterAd?.();
        if (nativeRes) return nativeRes;
      }

      // 4. Google AdSense H5 Games Ad Placement API (real browser rewarded ad)
      return await this.tryGoogleH5Rewarded(onAdLifecycle);
    } finally {
      this.activeLock = false;
    }
  }

  private tryAndroidBridge(invoke: () => boolean): Promise<AdDisplayResult | null> {
    return new Promise(resolve => {
      try {
        let settled = false;
        const timer = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            this.pendingNativeResolve = null;
            resolve(null);
          }
        }, 60000);

        this.pendingNativeResolve = res => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            resolve(res);
          }
        };

        const accepted = invoke();
        if (!accepted && !settled) {
          settled = true;
          window.clearTimeout(timer);
          this.pendingNativeResolve = null;
          resolve(null);
        }
      } catch {
        this.pendingNativeResolve = null;
        resolve(null);
      }
    });
  }

  private tryGoogleH5Interstitial(onAdLifecycle?: {
    onBeforeAd?: () => void;
    onAfterAd?: () => void;
  }): Promise<AdDisplayResult> {
    if (typeof window === 'undefined' || typeof window.adBreak !== 'function') {
      return Promise.resolve({
        completed: false,
        rewardGranted: false,
        source: 'unavailable',
        error: 'Ad script unavailable',
      });
    }
    return new Promise(resolve => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          onAdLifecycle?.onAfterAd?.();
          resolve({
            completed: false,
            rewardGranted: false,
            source: 'unavailable',
            breakStatus: 'timeout',
          });
        }
      }, 4500);

      try {
        window.adBreak?.({
          type: 'next',
          name: 'return_to_lobby_after_match',
          beforeAd: () => {
            window.clearTimeout(timeout);
            onAdLifecycle?.onBeforeAd?.();
          },
          afterAd: () => {
            onAdLifecycle?.onAfterAd?.();
          },
          adBreakDone: info => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            const status = String(info?.breakStatus || 'unknown');
            if (status === 'viewed' || status === 'dismissed') {
              resolve({
                completed: true,
                rewardGranted: false,
                source: 'google_h5_adbreak',
                breakStatus: status,
              });
            } else {
              resolve({
                completed: false,
                rewardGranted: false,
                source: 'unavailable',
                breakStatus: status,
              });
            }
          },
        });
      } catch {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          onAdLifecycle?.onAfterAd?.();
          resolve({
            completed: false,
            rewardGranted: false,
            source: 'unavailable',
            breakStatus: 'error',
          });
        }
      }
    });
  }

  private tryGoogleH5Rewarded(onAdLifecycle?: {
    onBeforeAd?: () => void;
    onAfterAd?: () => void;
  }): Promise<AdDisplayResult> {
    if (typeof window === 'undefined' || typeof window.adBreak !== 'function') {
      return Promise.resolve({
        completed: false,
        rewardGranted: false,
        source: 'unavailable',
        error: 'Google Ad script load nahi hua.',
      });
    }
    return new Promise(resolve => {
      let settled = false;
      let viewed = false;
      let dismissed = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          onAdLifecycle?.onAfterAd?.();
          resolve({
            completed: false,
            rewardGranted: false,
            source: 'unavailable',
            breakStatus: 'timeout',
            error: 'Google AdMob se real ad fill nahi mila (Android APK ya verified domain par hi live fill aata hai).',
          });
        }
      }, 5000);

      try {
        window.adBreak?.({
          type: 'reward',
          name: 'lobby_rewarded_bonus',
          beforeAd: () => {
            window.clearTimeout(timeout);
            onAdLifecycle?.onBeforeAd?.();
          },
          afterAd: () => {
            onAdLifecycle?.onAfterAd?.();
          },
          beforeReward: showAdFn => {
            window.clearTimeout(timeout);
            showAdFn();
          },
          adViewed: () => {
            viewed = true;
          },
          adDismissed: () => {
            dismissed = true;
          },
          adBreakDone: info => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            const status = String(info?.breakStatus || 'unknown');
            if (viewed || status === 'viewed') {
              resolve({
                completed: true,
                rewardGranted: true,
                source: 'google_h5_adbreak',
                breakStatus: status,
              });
            } else if (dismissed || status === 'dismissed') {
              resolve({
                completed: true,
                rewardGranted: false,
                source: 'google_h5_adbreak',
                breakStatus: status,
                error: 'Ad poora dekhne se pehle band kar diya gaya.',
              });
            } else {
              resolve({
                completed: false,
                rewardGranted: false,
                source: 'unavailable',
                breakStatus: status,
                error:
                  status === 'frequencyCapped'
                    ? 'Abhi abhi ad dekha hai — kuch der baad dobara try karein.'
                    : 'Abhi live Ad fill available nahi hai (Android APK/WebView ya Google-approved domain zaroori hai).',
              });
            }
          },
        });
      } catch {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          onAdLifecycle?.onAfterAd?.();
          resolve({
            completed: false,
            rewardGranted: false,
            source: 'unavailable',
            breakStatus: 'error',
            error: 'Ad service abhi available nahi hai.',
          });
        }
      }
    });
  }
}

export const admobService = new AdMobService();
