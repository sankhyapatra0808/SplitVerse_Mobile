import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/tokens";

export default function TabsLayout() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home" }} />
      <Tabs.Screen name="split-rooms" options={{ title: "Rooms" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}