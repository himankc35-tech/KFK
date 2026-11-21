import {
  FriendRelation,
  LeaderboardEntry,
  OnlineMatchRecord,
  OnlinePlayerSummary,
  RoomInviteInfo,
} from '../types/game';
import { getStoredToken } from './authClient';

export interface OnlineSocialPayload {
  friends: FriendRelation[];
  invites: RoomInviteInfo[];
  history: OnlineMatchRecord[];
  leaderboard: LeaderboardEntry[];
}

async function onlineFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
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
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchOnlinePlayers(query = ''): Promise<OnlinePlayerSummary[]> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const data = await onlineFetch<{ players: OnlinePlayerSummary[] }>(`/api/online/players${qs}`);
  return Array.isArray(data.players) ? data.players : [];
}

export async function fetchOnlineSocial(): Promise<OnlineSocialPayload> {
  const data = await onlineFetch<OnlineSocialPayload>('/api/online/social');
  return {
    friends: Array.isArray(data.friends) ? data.friends : [],
    invites: Array.isArray(data.invites) ? data.invites : [],
    history: Array.isArray(data.history) ? data.history : [],
    leaderboard: Array.isArray(data.leaderboard) ? data.leaderboard : [],
  };
}

export async function sendFriendRequest(targetPlayerId: string): Promise<{ ok: boolean; status: string }> {
  return onlineFetch<{ ok: boolean; status: string }>('/api/online/friends/request', {
    method: 'POST',
    body: JSON.stringify({ targetPlayerId }),
  });
}

export async function respondFriendRequest(
  friendshipId: string,
  decision: 'accepted' | 'rejected'
): Promise<void> {
  await onlineFetch('/api/online/friends/respond', {
    method: 'POST',
    body: JSON.stringify({ friendshipId, decision }),
  });
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await onlineFetch(`/api/online/friends/${encodeURIComponent(friendshipId)}`, {
    method: 'DELETE',
  });
}

export async function respondRoomInvite(
  inviteId: string,
  decision: 'accepted' | 'declined'
): Promise<void> {
  await onlineFetch('/api/online/invites/respond', {
    method: 'POST',
    body: JSON.stringify({ inviteId, decision }),
  });
}
