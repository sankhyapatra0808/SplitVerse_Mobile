import { LibreBaskerville_400Regular } from "@expo-google-fonts/libre-baskerville/400Regular";
import { LibreBaskerville_500Medium } from "@expo-google-fonts/libre-baskerville/500Medium";
import { LibreBaskerville_600SemiBold } from "@expo-google-fonts/libre-baskerville/600SemiBold";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville/700Bold";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Stack } from "expo-router";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import MandatoryWalletPinSetup from "../src/components/MandatoryWalletPinSetup";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import { AuthProvider } from "../src/context/AuthContext";
import LiveNotificationsProvider from "../src/context/LiveNotificationsProvider";

void SplashScreen.preventAutoHideAsync().catch((error) => {
  if (__DEV__) {
    console.warn("Could not keep the splash screen visible:", error);
  }
});
SplashScreen.setOptions({ duration: 250, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    LibreBaskerville_400Regular,
    LibreBaskerville_500Medium,
    LibreBaskerville_600SemiBold,
    LibreBaskerville_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch((error) => {
        if (__DEV__) {
          console.warn("Could not hide the splash screen:", error);
        }
      });
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <AppSettingsProvider>
        <AuthProvider>
          <LiveNotificationsProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <MandatoryWalletPinSetup />
          </LiveNotificationsProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </AppErrorBoundary>
  );
}
