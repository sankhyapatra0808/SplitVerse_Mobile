import { LibreBaskerville_400Regular } from "@expo-google-fonts/libre-baskerville/400Regular";
import { LibreBaskerville_500Medium } from "@expo-google-fonts/libre-baskerville/500Medium";
import { LibreBaskerville_600SemiBold } from "@expo-google-fonts/libre-baskerville/600SemiBold";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville/700Bold";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import MandatoryWalletPinSetup from "../src/components/MandatoryWalletPinSetup";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import { AuthProvider } from "../src/context/AuthContext";
import LiveNotificationsProvider from "../src/context/LiveNotificationsProvider";
import { useAppSettings } from "../src/context/useAppSettings";

void SplashScreen.preventAutoHideAsync().catch((error) => {
  if (__DEV__) {
    console.warn("Could not keep the splash screen visible:", error);
  }
});
SplashScreen.setOptions({ duration: 250, fade: true });

const PRIVACY_CAPTURE_KEY = "splitverse-privacy-mode";

function PrivacyScreenGuard() {
  const { privacyMode } = useAppSettings();

  useEffect(() => {
    async function syncScreenCaptureProtection() {
      try {
        if (privacyMode) {
          await ScreenCapture.preventScreenCaptureAsync(PRIVACY_CAPTURE_KEY);
          if (Platform.OS === "ios") {
            await ScreenCapture.enableAppSwitcherProtectionAsync(1);
          }
        } else {
          await ScreenCapture.allowScreenCaptureAsync(PRIVACY_CAPTURE_KEY);
          if (Platform.OS === "ios") {
            await ScreenCapture.disableAppSwitcherProtectionAsync();
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("Could not update privacy screen protection:", error);
        }
      }
    }

    void syncScreenCaptureProtection();
  }, [privacyMode]);

  return null;
}

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
        <PrivacyScreenGuard />
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
