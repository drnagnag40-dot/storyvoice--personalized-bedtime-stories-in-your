import { Redirect } from 'expo-router';

// Sign-up is now handled inside the combined sign-in screen.
// Redirecting here so any existing links still work.
export default function SignUpRedirect() {
  return <Redirect href="/(auth)/sign-in" />;
}
