import { Stack } from "expo-router";
import MandatoryWalletPinSetup from "../src/components/MandatoryWalletPinSetup";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";
import { AuthProvider } from "../src/context/AuthContext";
import LiveNotificationsProvider from "../src/context/LiveNotificationsProvider";

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <LiveNotificationsProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <MandatoryWalletPinSetup />
        </LiveNotificationsProvider>
      </AuthProvider>
    </AppSettingsProvider>
  );
}
