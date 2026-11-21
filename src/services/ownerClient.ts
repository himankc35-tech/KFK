import { OwnerPlayerRecord, OwnerWorldSummary } from '../types/game';
import { getStoredToken } from './authClient';

export interface OwnerOverviewPayload {
  players: OwnerPlayerRecord[];
  worlds: OwnerWorldSummary[];
}

async function ownerFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data.error === 'string'
        ? data.error
        : `Owner request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchOwnerOverview(): Promise<OwnerOverviewPayload> {
  const data = await ownerFetch<OwnerOverviewPayload>('/api/owner/overview', { method: 'GET' });
  return {
    players: Array.isArray(data.players) ? data.players : [],
    worlds: Array.isArray(data.worlds) ? data.worlds : [],
  };
}

export async function setOwnerPlayerWallet(
  playerId: string,
  payload: { vCoins?: number; xp?: number; vCoinsDelta?: number; xpDelta?: number }
): Promise<OwnerPlayerRecord> {
  const data = await ownerFetch<{ player: OwnerPlayerRecord }>(
    `/api/owner/players/${encodeURIComponent(playerId)}/wallet`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return data.player;
}

export async function setOwnerPlayerBan(
  playerId: string,
  banned: boolean,
  reason?: string
): Promise<OwnerPlayerRecord> {
  const data = await ownerFetch<{ player: OwnerPlayerRecord }>(
    `/api/owner/players/${encodeURIComponent(playerId)}/ban`,
    {
      method: 'POST',
      body: JSON.stringify({ banned, reason }),
    }
  );
  return data.player;
}

export async function unlockAllOwnerPlayerCharacters(playerId: string): Promise<OwnerPlayerRecord> {
  const data = await ownerFetch<{ player: OwnerPlayerRecord }>(
    `/api/owner/players/${encodeURIComponent(playerId)}/unlock-all`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
  return data.player;
}

export async function closeOwnerWorld(roomCode: string): Promise<void> {
  await ownerFetch(`/api/owner/worlds/${encodeURIComponent(roomCode)}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
