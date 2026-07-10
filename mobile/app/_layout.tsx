import {
  LibreBaskerville_400Regular,
  LibreBaskerville_500Medium,
  LibreBaskerville_600SemiBold,
  LibreBaskerville_700Bold,
} from "@expo-google-fonts/libre-baskerville";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import MandatoryWalletPinSetup from "../src/components/MandatoryWalletPinSetup";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import { AuthProvider } from "../src/context/AuthContext";
import LiveNotificationsProvider from "../src/context/LiveNotificationsProvider";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    LibreBaskerville_400Regular,
    LibreBaskerville_500Medium,
    LibreBaskerville_600SemiBold,
    LibreBaskerville_700Bold,
  });

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
