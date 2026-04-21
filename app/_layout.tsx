import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { registerBackgroundSync } from '../services/BackgroundSync';

export default function RootLayout() {
  useEffect(() => {
    const syncTimeout = setTimeout(() => {
      try {
        registerBackgroundSync();
      } catch (err) {
        console.error("Failed to register background sync", err);
      }
    }, 4000);

    return () => clearTimeout(syncTimeout);
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A1628' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="home" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
