import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import AnimatedTabBar from "../../src/components/AnimatedTabBar";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";

export default function TabsLayout() {
  const { user, initializing } = useAuth();
  const { theme } = useAppSettings();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home" }} />
      <Tabs.Screen name="split-rooms" options={{ title: "Rooms" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="room-history" options={{ href: null }} />
      <Tabs.Screen name="blocked-users" options={{ href: null }} />
      <Tabs.Screen name="settlement-details" options={{ href: null }} />
    </Tabs>
  );
}
