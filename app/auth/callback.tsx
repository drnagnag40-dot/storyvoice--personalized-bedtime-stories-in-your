import { AuthCallbackPage } from '@fastshot/auth';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Callback() {
  const router = useRouter();
  return (
    <AuthCallbackPage
      supabaseClient={supabase}
      onSuccess={() => router.replace('/(onboarding)/child-profile')}
      onError={(error) =>
        router.replace(`/(auth)/sign-in?error=${encodeURIComponent(error.message)}`)
      }
      loadingText="Completing sign in…"
    />
  );
}
