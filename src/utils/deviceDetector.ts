import { useState, useEffect } from 'react';
import { DeviceType } from '../types/game';

export interface DeviceProfile {
  deviceType: DeviceType;
  isTouchDevice: boolean;
  isMobileOrTablet: boolean;
  isLandscape: boolean;
}

export function detectDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'desktop',
      isTouchDevice: false,
      isMobileOrTablet: false,
      isLandscape: true,
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);
  const ua = navigator.userAgent || '';
  const hasCoarsePointer =
    (window.matchMedia?.('(pointer: coarse)').matches ?? false) ||
    (window.matchMedia?.('(any-pointer: coarse)').matches ?? false);
  const hasNoHover = window.matchMedia?.('(hover: none)').matches ?? false;
  const hasTouchPoints = (navigator.maxTouchPoints || 0) > 0;
  const isTouch = hasCoarsePointer || hasTouchPoints || hasNoHover || 'ontouchstart' in window;

  const isMobileUa = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isTabletUa = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Macintosh|X11|Linux/i.test(ua) && hasTouchPoints);

  let deviceType: DeviceType = 'desktop';
  if (isMobileUa || shortSide < 560 || (isTouch && shortSide < 640 && longSide < 1100)) {
    deviceType = 'mobile';
  } else if (isTabletUa || (isTouch && longSide <= 1440)) {
    deviceType = 'tablet';
  }

  return {
    deviceType,
    isTouchDevice: isTouch,
    isMobileOrTablet: deviceType === 'mobile' || deviceType === 'tablet',
    isLandscape: w >= h,
  };
}

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() => detectDeviceProfile());

  useEffect(() => {
    const sync = () => setProfile(detectDeviceProfile());
    const onFirstTouch = () => {
      setProfile(prev => ({
        ...prev,
        isTouchDevice: true,
        deviceType: prev.deviceType === 'desktop' ? 'tablet' : prev.deviceType,
        isMobileOrTablet: true,
      }));
    };
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('touchstart', onFirstTouch);
    };
  }, []);

  return profile;
}
