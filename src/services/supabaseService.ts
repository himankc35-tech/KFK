import { supabase } from '../lib/supabase';
import {
  ArenaId,
  CharacterId,
  FriendRelation,
  LeaderboardEntry,
  OnlineMatchRecord,
  OnlinePlayerSummary,
  RoomInviteInfo,
  UserAccountProfile,
} from '../types/game';

function makeFallbackPlayerCode(uuid: string): string {
  const clean = uuid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `FXP-${(clean.slice(0, 6) || '000001').padEnd(6, '0')}`;
}

export function isSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const text = `${e.code || ''} ${e.message || ''}`;
  return text.includes('PGRST205') || text.includes('42P01') || text.includes('does not exist');
}

function mapProfileRow(row: Record<string, unknown>, email?: string): UserAccountProfile {
  return {
    id: String(row.id || ''),
    playerId: String(row.player_id || makeFallbackPlayerCode(String(row.id || ''))),
    email,
    username: String(row.username || 'Fighter'),
    avatarUrl: String(row.avatar_url || '/assets/oggy/oggy_portrait.png'),
    vCoins: Number(row.v_coins || 0),
    xp: Number(row.xp || 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    isOnline: Boolean(row.is_online ?? true),
    authProvider: 'supabase',
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapSummaryRow(row: Record<string, unknown>): OnlinePlayerSummary {
  return {
    id: String(row.id || ''),
    playerId: String(row.player_id || makeFallbackPlayerCode(String(row.id || ''))),
    username: String(row.username || 'Fighter'),
    avatarUrl: String(row.avatar_url || '/assets/oggy/oggy_portrait.png'),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    xp: Number(row.xp || 0),
    isOnline: Boolean(row.is_online),
    lastSeen: row.last_seen ? String(row.last_seen) : undefined,
  };
}

export interface SupabaseAuthResult {
  user: UserAccountProfile | null;
  needsEmailConfirmation: boolean;
  schemaPending: boolean;
  message?: string;
}

export async function signUpWithSupabase(params: {
  email: string;
  username: string;
  password: string;
  avatarUrl: string;
  localCoins: number;
  localXP: number;
}): Promise<SupabaseAuthResult> {
  if (!supabase) throw new Error('Online account service is unavailable.');

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanUsername = params.username.normalize('NFC').trim().replace(/\s+/g, ' ');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (cleanUsername.length < 2 || cleanUsername.length > 32) {
    throw new Error('Username must be 2 to 32 characters.');
  }
  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // Pre-check username collision if schema exists
  const { data: existingName, error: checkErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', cleanUsername)
    .limit(1);

  if (!checkErr && existingName && existingName.length > 0) {
    throw new Error('That username is already taken. Please choose another.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      data: {
        username: cleanUsername,
        avatar_url: params.avatarUrl,
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Sign Up failed.');
  }
  if (!data.user) {
    throw new Error('Account creation did not return user details.');
  }

  // When email confirmation is enabled, session stays null until verified
  if (!data.session) {
    return {
      user: null,
      needsEmailConfirmation: true,
      schemaPending: Boolean(checkErr && isSchemaMissingError(checkErr)),
      message: 'Verification email sent! Please check your email inbox and confirm your account, then Log In.',
    };
  }

  const profile = await ensureSupabaseProfile(data.user.id, {
    email: data.user.email || cleanEmail,
    username: cleanUsername,
    avatarUrl: params.avatarUrl,
    vCoins: params.localCoins,
    xp: params.localXP,
  });

  return {
    user: profile.user,
    needsEmailConfirmation: false,
    schemaPending: profile.schemaPending,
  };
}

export async function loginWithSupabase(params: {
  email: string;
  password: string;
}): Promise<SupabaseAuthResult> {
  if (!supabase) throw new Error('Online account service is unavailable.');

  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !params.password) {
    throw new Error('Email and password are required.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: params.password,
  });

  if (error) {
    throw new Error(error.message || 'Invalid email or password.');
  }
  if (!data.user) {
    throw new Error('Login failed.');
  }

  const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
  const ensured = await ensureSupabaseProfile(data.user.id, {
    email: data.user.email || cleanEmail,
    username: String(meta.username || cleanEmail.split('@')[0] || 'Fighter'),
    avatarUrl: String(meta.avatar_url || '/assets/oggy/oggy_portrait.png'),
    vCoins: 0,
    xp: 0,
  });

  return {
    user: ensured.user,
    needsEmailConfirmation: false,
    schemaPending: ensured.schemaPending,
  };
}

async function ensureSupabaseProfile(
  authUserId: string,
  defaults: {
    email?: string;
    username: string;
    avatarUrl: string;
    vCoins: number;
    xp: number;
  }
): Promise<{ user: UserAccountProfile; schemaPending: boolean }> {
  if (!supabase) {
    throw new Error('Online account service is unavailable.');
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (fetchErr) {
    if (isSchemaMissingError(fetchErr)) {
      return {
        user: {
          id: authUserId,
          playerId: makeFallbackPlayerCode(authUserId),
          email: defaults.email,
          username: defaults.username,
          avatarUrl: defaults.avatarUrl,
          vCoins: defaults.vCoins,
          xp: defaults.xp,
          wins: 0,
          losses: 0,
          isOnline: true,
          authProvider: 'supabase',
          createdAt: new Date().toISOString(),
        },
        schemaPending: true,
      };
    }
    throw new Error(fetchErr.message);
  }

  if (existing) {
    await supabase
      .from('profiles')
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq('id', authUserId);
    return {
      user: mapProfileRow(existing as Record<string, unknown>, defaults.email),
      schemaPending: false,
    };
  }

  const playerCode = makeFallbackPlayerCode(authUserId);
  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      id: authUserId,
      player_id: playerCode,
      username: defaults.username,
      avatar_url: defaults.avatarUrl,
      v_coins: Math.max(0, Math.floor(defaults.vCoins)),
      xp: Math.max(0, Math.floor(defaults.xp)),
      is_online: true,
      last_seen: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (insertErr || !inserted) {
    throw new Error(insertErr?.message || 'Could not initialize player profile.');
  }

  return {
    user: mapProfileRow(inserted as Record<string, unknown>, defaults.email),
    schemaPending: false,
  };
}

export async function fetchCurrentSupabaseUser(): Promise<{
  user: UserAccountProfile | null;
  schemaPending: boolean;
}> {
  if (!supabase) return { user: null, schemaPending: false };
  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser) return { user: null, schemaPending: false };

  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  try {
    return await ensureSupabaseProfile(authUser.id, {
      email: authUser.email,
      username: String(meta.username || authUser.email?.split('@')[0] || 'Fighter'),
      avatarUrl: String(meta.avatar_url || '/assets/oggy/oggy_portrait.png'),
      vCoins: 0,
      xp: 0,
    });
  } catch {
    return { user: null, schemaPending: false };
  }
}

export async function updateSupabaseUserProfile(params: {
  userId: string;
  email?: string;
  username?: string;
  avatarUrl?: string;
  newPassword?: string;
}): Promise<UserAccountProfile> {
  if (!supabase) throw new Error('Online account service is unavailable.');

  const authUpdate: { password?: string; data?: Record<string, string> } = {};
  if (params.newPassword && params.newPassword.length >= 6) {
    authUpdate.password = params.newPassword;
  }
  if (params.username || params.avatarUrl) {
    authUpdate.data = {};
    if (params.username) authUpdate.data.username = params.username;
    if (params.avatarUrl) authUpdate.data.avatar_url = params.avatarUrl;
  }

  if (authUpdate.password || authUpdate.data) {
    const { error: authErr } = await supabase.auth.updateUser(authUpdate);
    if (authErr) throw new Error(authErr.message);
  }

  const profilePatch: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
  };
  if (params.username) profilePatch.username = params.username;
  if (params.avatarUrl) profilePatch.avatar_url = params.avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', params.userId)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) {
      return {
        id: params.userId,
        playerId: makeFallbackPlayerCode(params.userId),
        email: params.email,
        username: params.username || 'Fighter',
        avatarUrl: params.avatarUrl || '/assets/oggy/oggy_portrait.png',
        vCoins: 0,
        xp: 0,
        wins: 0,
        losses: 0,
        isOnline: true,
        authProvider: 'supabase',
        createdAt: new Date().toISOString(),
      };
    }
    throw new Error(error.message);
  }

  return mapProfileRow((data || { id: params.userId, ...profilePatch }) as Record<string, unknown>, params.email);
}

export async function syncSupabaseWallet(userId: string, vCoins: number, xp: number): Promise<void> {
  if (!supabase || !userId) return;
  try {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('v_coins, xp')
      .eq('id', userId)
      .maybeSingle();
    if (error || !existing) return;
    const nextCoins = Math.max(Number(existing.v_coins || 0), Math.floor(vCoins));
    const nextXp = Math.max(Number(existing.xp || 0), Math.floor(xp));
    await supabase
      .from('profiles')
      .update({
        v_coins: nextCoins,
        xp: nextXp,
        is_online: true,
        last_seen: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch {
    // non-fatal sync
  }
}

export async function setSupabaseWalletAfterPurchase(userId: string, vCoins: number): Promise<void> {
  if (!supabase || !userId) return;
  try {
    await supabase
      .from('profiles')
      .update({
        v_coins: Math.max(0, Math.floor(vCoins)),
        is_online: true,
        last_seen: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch {
    // non-fatal sync
  }
}

export async function logoutSupabase(userId?: string): Promise<void> {
  if (!supabase) return;
  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', userId);
    } catch {
      // ignore if schema pending
    }
  }
  await supabase.auth.signOut();
}

export async function updateOnlinePresenceStatus(userId: string, isOnline: boolean): Promise<void> {
  if (!supabase || !userId) return;
  try {
    await supabase
      .from('profiles')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // ignore
  }
}

// ============================================================================
// FRIENDS SYSTEM (Search by Player ID or Username, Requests, Accept/Reject, Remove)
// ============================================================================

export async function searchSupabasePlayers(
  query: string,
  excludeUserId: string
): Promise<OnlinePlayerSummary[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (!q) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', excludeUserId)
      .order('is_online', { ascending: false })
      .order('xp', { ascending: false })
      .limit(100);
    if (error) {
      if (isSchemaMissingError(error)) throw new Error('SCHEMA_PENDING');
      throw new Error(error.message);
    }
    return (data || []).map(row => mapSummaryRow(row as Record<string, unknown>));
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', excludeUserId)
    .or(`username.ilike.%${q}%,player_id.ilike.%${q}%`)
    .limit(20);

  if (error) {
    if (isSchemaMissingError(error)) throw new Error('SCHEMA_PENDING');
    throw new Error(error.message);
  }
  return (data || []).map(row => mapSummaryRow(row as Record<string, unknown>));
}

export async function fetchSupabaseFriendships(myId: string): Promise<FriendRelation[]> {
  if (!supabase || !myId) return [];
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) throw new Error('SCHEMA_PENDING');
    throw new Error(error.message);
  }
  if (!rows || rows.length === 0) return [];

  const otherIds = Array.from(
    new Set(
      rows
        .map(r => (r.requester_id === myId ? String(r.addressee_id) : String(r.requester_id)))
        .filter(Boolean)
    )
  );

  const { data: profilesData, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .in('id', otherIds);
  if (profErr) throw new Error(profErr.message);

  const profileMap = new Map<string, OnlinePlayerSummary>();
  (profilesData || []).forEach(p => {
    const summary = mapSummaryRow(p as Record<string, unknown>);
    profileMap.set(summary.id, summary);
  });

  const relations: FriendRelation[] = [];
  for (const r of rows) {
    const otherId = r.requester_id === myId ? String(r.addressee_id) : String(r.requester_id);
    const prof = profileMap.get(otherId);
    if (!prof) continue;
    const status = String(r.status) as FriendRelation['status'];
    if (status === 'rejected') continue;
    const direction: FriendRelation['direction'] =
      status === 'accepted' ? 'friend' : r.requester_id === myId ? 'outgoing' : 'incoming';
    relations.push({
      friendshipId: String(r.id),
      status,
      direction,
      profile: prof,
      createdAt: String(r.created_at),
    });
  }
  return relations;
}

export async function sendSupabaseFriendRequest(myId: string, targetId: string): Promise<void> {
  if (!supabase) throw new Error('Online service is unavailable.');
  if (myId === targetId) throw new Error('You cannot add yourself.');

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${myId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already in your friends list.');
    if (existing.status === 'pending') throw new Error('Friend request already pending.');
    await supabase
      .from('friendships')
      .update({ requester_id: myId, addressee_id: targetId, status: 'pending' })
      .eq('id', existing.id);
    return;
  }

  const { error } = await supabase.from('friendships').insert({
    requester_id: myId,
    addressee_id: targetId,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function respondSupabaseFriendRequest(
  friendshipId: string,
  decision: 'accepted' | 'rejected'
): Promise<void> {
  if (!supabase) throw new Error('Online service is unavailable.');
  if (decision === 'rejected') {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw new Error(error.message);
}

export async function removeSupabaseFriend(friendshipId: string): Promise<void> {
  if (!supabase) throw new Error('Online service is unavailable.');
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// ROOM INVITES
// ============================================================================

export async function sendSupabaseRoomInvite(params: {
  senderId: string;
  receiverId: string;
  roomCode: string;
  roomName: string;
}): Promise<void> {
  if (!supabase) throw new Error('Online service is unavailable.');
  const { error } = await supabase.from('room_invites').insert({
    sender_id: params.senderId,
    receiver_id: params.receiverId,
    room_code: params.roomCode,
    room_name: params.roomName,
    status: 'pending',
  });
  if (error) {
    if (isSchemaMissingError(error)) {
      throw new Error('Online invite service is temporarily unavailable.');
    }
    throw new Error(error.message);
  }
}

export async function fetchMySupabaseInvites(myId: string): Promise<RoomInviteInfo[]> {
  if (!supabase || !myId) return [];
  const { data: rows, error } = await supabase
    .from('room_invites')
    .select('*')
    .eq('receiver_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw new Error(error.message);
  }
  if (!rows || rows.length === 0) return [];

  const senderIds = Array.from(new Set(rows.map(r => String(r.sender_id))));
  const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);
  const senderMap = new Map<string, OnlinePlayerSummary>();
  (senders || []).forEach(s => {
    const summary = mapSummaryRow(s as Record<string, unknown>);
    senderMap.set(summary.id, summary);
  });

  return rows
    .map(r => {
      const sender = senderMap.get(String(r.sender_id));
      if (!sender) return null;
      return {
        id: String(r.id),
        roomCode: String(r.room_code),
        roomName: String(r.room_name || 'Private Arena'),
        status: String(r.status) as RoomInviteInfo['status'],
        sender,
        createdAt: String(r.created_at),
      };
    })
    .filter((v): v is RoomInviteInfo => v !== null);
}

export async function respondSupabaseRoomInvite(
  inviteId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  if (!supabase) return;
  await supabase.from('room_invites').update({ status }).eq('id', inviteId);
}

// ============================================================================
// MATCHES, STATS & LEADERBOARD
// ============================================================================

export async function recordOnlineMatchToSupabase(params: {
  roomCode: string;
  p1Id: string;
  p2Id: string;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  winnerId: string;
  p1Wins: number;
  p2Wins: number;
}): Promise<{ saved: boolean; error?: string }> {
  if (!supabase) return { saved: false, error: 'Online service not configured' };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.p1Id) || !uuidRegex.test(params.p2Id) || !uuidRegex.test(params.winnerId)) {
    return { saved: false, error: 'Match record skipped for guest player session' };
  }

  const { error } = await supabase.rpc('record_online_match_result', {
    p_room_code: params.roomCode,
    p_p1_id: params.p1Id,
    p_p2_id: params.p2Id,
    p_p1_char: params.p1Char,
    p_p2_char: params.p2Char,
    p_arena_id: params.arenaId,
    p_winner_id: params.winnerId,
    p_p1_wins: params.p1Wins,
    p_p2_wins: params.p2Wins,
  });

  if (error) {
    return { saved: false, error: error.message };
  }
  return { saved: true };
}

export async function fetchSupabaseMatchHistory(myId: string): Promise<OnlineMatchRecord[]> {
  if (!supabase || !myId) return [];
  const { data: rows, error } = await supabase
    .from('matches')
    .select('*')
    .or(`p1_id.eq.${myId},p2_id.eq.${myId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (isSchemaMissingError(error)) throw new Error('SCHEMA_PENDING');
    throw new Error(error.message);
  }
  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(
    new Set(rows.flatMap(r => [String(r.p1_id), String(r.p2_id)]))
  );
  const { data: profs } = await supabase.from('profiles').select('id, username').in('id', userIds);
  const nameMap = new Map<string, string>();
  (profs || []).forEach(p => nameMap.set(String(p.id), String(p.username)));

  return rows.map(r => ({
    id: String(r.id),
    roomCode: r.room_code ? String(r.room_code) : null,
    p1Id: String(r.p1_id),
    p2Id: String(r.p2_id),
    p1Name: nameMap.get(String(r.p1_id)) || 'Fighter 1',
    p2Name: nameMap.get(String(r.p2_id)) || 'Fighter 2',
    p1Char: String(r.p1_char) as CharacterId,
    p2Char: String(r.p2_char) as CharacterId,
    arenaId: String(r.arena_id) as ArenaId,
    winnerId: String(r.winner_id),
    p1Wins: Number(r.p1_wins || 0),
    p2Wins: Number(r.p2_wins || 0),
    xpAwarded: Number(r.xp_awarded || 100),
    createdAt: String(r.created_at),
  }));
}

export async function fetchSupabaseLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('wins', { ascending: false })
    .order('xp', { ascending: false })
    .limit(100);

  if (error) {
    if (isSchemaMissingError(error)) throw new Error('SCHEMA_PENDING');
    throw new Error(error.message);
  }

  return (data || [])
    .map(row => {
      const r = row as Record<string, unknown>;
      const wins = Number(r.wins || 0);
      const losses = Number(r.losses || 0);
      const total = wins + losses;
      const summary = mapSummaryRow(r);
      return {
        ...summary,
        winRate: total === 0 ? 0 : Math.round((wins / total) * 1000) / 10,
      };
    })
    .sort((a, b) => {
      const aOwner = a.isOwner || a.username.trim().toLowerCase() === 'himank';
      const bOwner = b.isOwner || b.username.trim().toLowerCase() === 'himank';
      if (aOwner !== bOwner) return aOwner ? 1 : -1;
      const scoreDiff = (Number(b.vCoins || 0) + Number(b.xp || 0)) - (Number(a.vCoins || 0) + Number(a.xp || 0));
      if (scoreDiff !== 0) return scoreDiff;
      return b.wins - a.wins;
    });
}
