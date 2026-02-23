import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// ──────────────────────────────────────────────────────────
// Safe Supabase initialization
// ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing environment variables: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Supabase features will be unavailable. Please connect Supabase to your project.'
  );
}

// Only create the real client when credentials are available.
// When they're missing we use a placeholder URL so the client can be
// instantiated without throwing – every actual request will still fail
// gracefully because the URL/key are invalid, but the app won't crash
// on startup.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

/** Whether the Supabase client has valid credentials */
export const isSupabaseAvailable = isSupabaseConfigured;

// Only set up auto-refresh when Supabase is properly configured
if (isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  user_id: string;
  name: string;
  birthday: string | null;
  age: number | null;
  interests: string[];
  life_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentVoice {
  id: string;
  user_id: string;
  child_id: string | null;
  voice_type: 'mom' | 'dad' | 'custom';
  voice_name: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  script_paragraphs_recorded: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const SUPABASE_NOT_CONFIGURED_ERROR = {
  message: 'Supabase is not configured. Please connect Supabase to your project.',
  details: '',
  hint: 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.',
  code: 'SUPABASE_NOT_CONFIGURED',
  name: 'SupabaseNotConfiguredError',
};

// ──────────────────────────────────────────────────────────
// Database helpers – each one guards against missing config
// ──────────────────────────────────────────────────────────
export async function upsertUserProfile(userId: string, email: string, fullName?: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] upsertUserProfile skipped – Supabase not configured.');
    return SUPABASE_NOT_CONFIGURED_ERROR;
  }
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      email,
      full_name: fullName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  return error;
}

export async function createChild(data: Omit<Child, 'id' | 'created_at' | 'updated_at'>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] createChild skipped – Supabase not configured.');
    return { child: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: child, error } = await supabase
    .from('children')
    .insert(data)
    .select()
    .single();
  return { child, error };
}

export async function updateChild(id: string, data: Partial<Child>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] updateChild skipped – Supabase not configured.');
    return { child: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: child, error } = await supabase
    .from('children')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { child, error };
}

export async function getChildren(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getChildren skipped – Supabase not configured.');
    return { children: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { children: data as Child[] | null, error };
}

export async function createParentVoice(data: Omit<ParentVoice, 'id' | 'created_at' | 'updated_at'>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] createParentVoice skipped – Supabase not configured.');
    return { voice: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: voice, error } = await supabase
    .from('parent_voices')
    .insert(data)
    .select()
    .single();
  return { voice, error };
}

export async function updateParentVoice(id: string, data: Partial<ParentVoice>) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] updateParentVoice skipped – Supabase not configured.');
    return { voice: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data: voice, error } = await supabase
    .from('parent_voices')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { voice, error };
}

export async function getParentVoices(userId: string) {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] getParentVoices skipped – Supabase not configured.');
    return { voices: null, error: SUPABASE_NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase
    .from('parent_voices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { voices: data as ParentVoice[] | null, error };
}
