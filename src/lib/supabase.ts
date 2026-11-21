import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseHealthReport } from '../types/game';

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  // Guard against common .supabase.com typo (official Supabase API endpoints always use .supabase.co)
  return trimmed.replace(/\.supabase\.com$/i, '.supabase.co');
}

const rawEnvUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const rawEnvKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || '';

export const SUPABASE_URL = normalizeSupabaseUrl(rawEnvUrl);
export const SUPABASE_PUBLISHABLE_KEY = rawEnvKey.trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'fighter_xp_supabase_auth_v1',
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    })
  : null;

const REQUIRED_TABLES = ['profiles', 'friendships', 'rooms', 'room_invites', 'matches'] as const;

export async function checkSupabaseHealth(): Promise<SupabaseHealthReport> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      configured: false,
      url: SUPABASE_URL,
      authReachable: false,
      emailAutoconfirm: false,
      schemaReady: false,
      missingTables: [...REQUIRED_TABLES],
      errorMessage: 'Online service is not configured.',
    };
  }

  let authReachable = false;
  let emailAutoconfirm = false;
  let errorMessage: string | null = null;

  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (authRes.ok) {
      authReachable = true;
      const settingsJson = (await authRes.json().catch(() => null)) as {
        mailer_autoconfirm?: boolean;
      } | null;
      emailAutoconfirm = Boolean(settingsJson?.mailer_autoconfirm);
    } else {
      errorMessage = `Auth check returned status ${authRes.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unable to reach online service host';
  }

  const missingTables: string[] = [];
  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
      if (error) {
        const msg = `${error.code || ''} ${error.message || ''}`;
        if (msg.includes('PGRST205') || msg.includes('does not exist') || msg.includes('42P01')) {
          missingTables.push(table);
        }
      }
    } catch {
      missingTables.push(table);
    }
  }

  return {
    configured: true,
    url: SUPABASE_URL,
    authReachable,
    emailAutoconfirm,
    schemaReady: authReachable && missingTables.length === 0,
    missingTables,
    errorMessage,
  };
}
