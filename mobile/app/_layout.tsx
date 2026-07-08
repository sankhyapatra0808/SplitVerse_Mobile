import { Stack } from "expo-router";
import { AuthProvider } from "../src/context/AuthContext";
import { AppSettingsProvider } from "../src/context/AppSettingsContext";

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </AppSettingsProvider>
  );
}
