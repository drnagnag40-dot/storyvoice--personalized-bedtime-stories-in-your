import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.midnightNavy },
      }}
    />
  );
}
