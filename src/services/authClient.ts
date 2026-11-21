import { CharacterId, UserAccountProfile } from '../types/game';
import { normalizeUnlockedCharacters } from '../data/achievements';

const AUTH_TOKEN_KEY = 'fighter_xp_auth_token_v1';
const CACHED_USER_KEY = 'fighter_xp_cached_user_v1';
let memoryTokenFallback: string | null = null;
let memoryUserFallback: UserAccountProfile | null = null;

class StatusError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface PresetAvatarLogo {
  id: string;
  label: string;
  url: string;
}

export const PRESET_AVATAR_LOGOS: PresetAvatarLogo[] = [
  { id: 'oggy', label: 'Oggy', url: '/assets/oggy/oggy_portrait.png' },
  { id: 'buster', label: 'BOB', url: '/assets/buster/buster_portrait.png' },
  { id: 'lion', label: 'Sheru', url: '/assets/lion/lion_portrait.png' },
  { id: 'ninja', label: 'Ryu', url: '/assets/ninja/ninja_portrait.png' },
  { id: 'hero_a', label: 'Cyber Ranger', url: '/assets/hero_a/hero_a_portrait.png' },
  { id: 'death_wolf', label: 'Wolf', url: '/assets/death_wolf/death_wolf_portrait.png' },
  { id: 'hellfire', label: 'Magma Knight', url: '/assets/hellfire/hellfire_portrait.png' },
  { id: 'akita', label: 'Kuttiya', url: '/assets/akita/akita_portrait.png' },
];

export function getStoredToken(): string | null {
  try {
    const val = window.localStorage.getItem(AUTH_TOKEN_KEY);
    return val || memoryTokenFallback;
  } catch {
    return memoryTokenFallback;
  }
}

export function setStoredToken(token: string | null): void {
  memoryTokenFallback = token;
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage quota / iframe restrictions
  }
}

export function getCachedUser(): UserAccountProfile | null {
  if (!getStoredToken()) return null;
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return memoryUserFallback;
    const parsed = JSON.parse(raw) as UserAccountProfile;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.username === 'string') {
      return normalizeAuthUser(parsed);
    }
  } catch {
    // ignore corrupt cache
  }
  return memoryUserFallback;
}

function setCachedUser(user: UserAccountProfile | null): void {
  memoryUserFallback = user;
  try {
    if (user) {
      window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore storage quota / iframe restrictions
  }
}

async function apiJson<T>(
  url: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (includeAuth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new StatusError('Server connection failed. Please try again.', 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new StatusError(
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`,
      res.status
    );
  }
  if (!data || typeof data !== 'object') {
    throw new StatusError('Unexpected response from server.', 500);
  }
  return data as T;
}

function normalizeAuthUser(user: UserAccountProfile): UserAccountProfile {
  const isOwner = Boolean(user.isOwner || user.username.trim().toLowerCase() === 'himank');
  return {
    ...user,
    playerId:
      user.playerId ||
      `FXP-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`,
    wins: user.wins ?? 0,
    losses: user.losses ?? 0,
    isOwner,
    banned: Boolean(user.banned),
    bannedReason: user.bannedReason,
    walletRevision: user.walletRevision ?? 0,
    authProvider: user.authProvider || 'local',
    unlockedCharacters: normalizeUnlockedCharacters(user.unlockedCharacters, isOwner),
  };
}

export async function fetchCurrentUser(): Promise<UserAccountProfile | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const data = await apiJson<{ user: UserAccountProfile }>('/api/auth/me', { method: 'GET' }, true);
    const normalized = normalizeAuthUser(data.user);
    setCachedUser(normalized);
    return normalized;
  } catch (err) {
    // Only log the user out on explicit 401 token rejection; preserve session for banned / offline states
    if (err instanceof StatusError && err.status === 401) {
      setStoredToken(null);
      setCachedUser(null);
      return null;
    }
    return getCachedUser();
  }
}

export async function signupAccount(params: {
  username: string;
  password: string;
  avatarUrl: string;
  vCoins: number;
  xp: number;
  unlockedCharacters?: CharacterId[];
}): Promise<UserAccountProfile> {
  const data = await apiJson<{ token: string; user: UserAccountProfile }>(
    '/api/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    false
  );
  const normalized = normalizeAuthUser(data.user);
  setStoredToken(data.token);
  setCachedUser(normalized);
  return normalized;
}

export async function loginAccount(params: {
  username: string;
  password: string;
}): Promise<UserAccountProfile> {
  const data = await apiJson<{ token: string; user: UserAccountProfile }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    false
  );
  const normalized = normalizeAuthUser(data.user);
  setStoredToken(data.token);
  setCachedUser(normalized);
  return normalized;
}

export async function updateUserProfile(params: {
  username?: string;
  avatarUrl?: string;
  password?: string;
}): Promise<UserAccountProfile> {
  const data = await apiJson<{ token: string; user: UserAccountProfile }>(
    '/api/auth/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(params),
    },
    true
  );
  const normalized = normalizeAuthUser(data.user);
  setStoredToken(data.token);
  setCachedUser(normalized);
  return normalized;
}

export async function syncWalletToAccount(
  vCoins: number,
  xp: number,
  expectedRevision?: number
): Promise<UserAccountProfile | null> {
  if (!getStoredToken()) return null;
  try {
    const data = await apiJson<{ user: UserAccountProfile }>(
      '/api/auth/sync-wallet',
      {
        method: 'POST',
        body: JSON.stringify({ vCoins, xp, expectedRevision }),
      },
      true
    );
    const normalized = normalizeAuthUser(data.user);
    setCachedUser(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function awardMatchRewards(
  coinsDelta: number,
  xpDelta: number
): Promise<UserAccountProfile | null> {
  if (!getStoredToken()) return null;
  try {
    const data = await apiJson<{ user: UserAccountProfile }>(
      '/api/auth/award-rewards',
      {
        method: 'POST',
        body: JSON.stringify({ coinsDelta, xpDelta }),
      },
      true
    );
    const normalized = normalizeAuthUser(data.user);
    setCachedUser(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function unlockCharacterAccount(characterId: CharacterId): Promise<UserAccountProfile> {
  const data = await apiJson<{ user: UserAccountProfile }>(
    '/api/auth/unlock-character',
    {
      method: 'POST',
      body: JSON.stringify({ characterId }),
    },
    true
  );
  const normalized = normalizeAuthUser(data.user);
  setCachedUser(normalized);
  return normalized;
}

export function logoutAccount(): void {
  setStoredToken(null);
  setCachedUser(null);
}

/**
 * Crops and scales any selected phone photo to a crisp 160x160 square JPEG
 * so profile images load fast and sync reliably across devices.
 */
export function resizeAvatarImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
