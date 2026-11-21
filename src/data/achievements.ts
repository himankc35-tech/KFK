import { CharacterId, InfinityAchievement, InfinityAchievementId } from '../types/game';
import { CHARACTERS, STARTER_CHARACTER_IDS } from './characters';

const ACHIEVEMENTS_KEY = 'fighter_xp_infinity_achievements_v1';
const VCOINS_KEY = 'fighter_xp_vcoins_v1';
const XP_KEY = 'fighter_xp_total_xp_v1';
const UNLOCKED_CHARS_KEY = 'fighter_xp_unlocked_chars_v1';

export const INFINITY_ACHIEVEMENTS: InfinityAchievement[] = [
  {
    id: 'first_blood',
    title: 'FIRST CHALLENGER DOWN',
    description: 'Defeat your first rival in Infinity mode.',
    rewardCoins: 10,
  },
  {
    id: 'coin_collector_25',
    title: 'COIN HUNTER',
    description: 'Reach 25 total V-Coins.',
    rewardCoins: 15,
  },
  {
    id: 'coin_tycoon_100',
    title: 'V-COIN TYCOON',
    description: 'Accumulate 100 total V-Coins.',
    rewardCoins: 35,
  },
  {
    id: 'zone_explorer_3',
    title: 'REALM VOYAGER',
    description: 'Advance to Infinity Zone 3.',
    rewardCoins: 20,
  },
  {
    id: 'world_traveler_6',
    title: 'ENDLESS NOMAD',
    description: 'Conquer through Infinity Zone 6.',
    rewardCoins: 40,
  },
  {
    id: 'overdrive_master',
    title: '70-DMG OVERDRIVE',
    description: 'Land a charged Overdrive finishing strike.',
    rewardCoins: 25,
  },
  {
    id: 'combo_king',
    title: 'COMBO MASTER',
    description: 'Chain a 5-hit combo inside a single window.',
    rewardCoins: 25,
  },
  {
    id: 'roster_sweep',
    title: 'ROSTER CONQUEROR',
    description: 'Defeat 12 challengers in an Infinity run.',
    rewardCoins: 60,
  },
];

export function loadUnlockedAchievements(): InfinityAchievementId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InfinityAchievementId[]) : [];
  } catch {
    return [];
  }
}

export function saveUnlockedAchievements(ids: InfinityAchievementId[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // ignore storage errors
  }
}

export function loadTotalVCoins(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(VCOINS_KEY);
    const val = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function saveTotalVCoins(coins: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VCOINS_KEY, String(Math.max(0, Math.floor(coins))));
  } catch {
    // ignore storage errors
  }
}

export function addTotalVCoins(delta: number): number {
  const next = Math.max(0, loadTotalVCoins() + Math.floor(delta));
  saveTotalVCoins(next);
  return next;
}

export function loadTotalXP(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(XP_KEY);
    const val = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function saveTotalXP(xp: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(XP_KEY, String(Math.max(0, Math.floor(xp))));
  } catch {
    // ignore storage errors
  }
}

export function addTotalXP(delta: number): number {
  const next = Math.max(0, loadTotalXP() + Math.floor(delta));
  saveTotalXP(next);
  return next;
}

export function normalizeUnlockedCharacters(ids?: unknown, isOwner = false): CharacterId[] {
  const set = new Set<CharacterId>(STARTER_CHARACTER_IDS);
  if (Array.isArray(ids)) {
    for (const raw of ids) {
      if (typeof raw === 'string' && raw in CHARACTERS) {
        const charId = raw as CharacterId;
        if (CHARACTERS[charId]?.ownerOnly && !isOwner) continue;
        set.add(charId);
      }
    }
  }
  if (isOwner) {
    for (const charDef of Object.values(CHARACTERS)) {
      if (charDef.ownerOnly) {
        set.add(charDef.id);
      }
    }
  }
  return Array.from(set);
}

export function loadUnlockedCharacters(isOwner = false): CharacterId[] {
  if (typeof window === 'undefined') return normalizeUnlockedCharacters(STARTER_CHARACTER_IDS, isOwner);
  try {
    const raw = window.localStorage.getItem(UNLOCKED_CHARS_KEY);
    if (!raw) return normalizeUnlockedCharacters(STARTER_CHARACTER_IDS, isOwner);
    return normalizeUnlockedCharacters(JSON.parse(raw), isOwner);
  } catch {
    return normalizeUnlockedCharacters(STARTER_CHARACTER_IDS, isOwner);
  }
}

export function saveUnlockedCharacters(ids?: unknown, isOwner = false): CharacterId[] {
  const normalized = normalizeUnlockedCharacters(ids, isOwner);
  if (typeof window === 'undefined') return normalized;
  try {
    window.localStorage.setItem(UNLOCKED_CHARS_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
  return normalized;
}
