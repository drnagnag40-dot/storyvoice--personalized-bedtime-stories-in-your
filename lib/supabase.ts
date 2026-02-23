import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

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
// Database helpers
// ──────────────────────────────────────────────────────────
export async function upsertUserProfile(userId: string, email: string, fullName?: string) {
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
  const { data: child, error } = await supabase
    .from('children')
    .insert(data)
    .select()
    .single();
  return { child, error };
}

export async function updateChild(id: string, data: Partial<Child>) {
  const { data: child, error } = await supabase
    .from('children')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { child, error };
}

export async function getChildren(userId: string) {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { children: data as Child[] | null, error };
}

export async function createParentVoice(data: Omit<ParentVoice, 'id' | 'created_at' | 'updated_at'>) {
  const { data: voice, error } = await supabase
    .from('parent_voices')
    .insert(data)
    .select()
    .single();
  return { voice, error };
}

export async function updateParentVoice(id: string, data: Partial<ParentVoice>) {
  const { data: voice, error } = await supabase
    .from('parent_voices')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { voice, error };
}

export async function getParentVoices(userId: string) {
  const { data, error } = await supabase
    .from('parent_voices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { voices: data as ParentVoice[] | null, error };
}
