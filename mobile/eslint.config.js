// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores(["dist/*"]),
  expoConfig,
  {
    files: [
      "app/(tabs)/dashboard.tsx",
      "app/(tabs)/profile.tsx",
      "app/(tabs)/settings.tsx",
      "app/(tabs)/split-rooms.tsx",
      "app/(tabs)/wallet.tsx",
      "src/context/LiveNotificationsProvider.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "app/(tabs)/profile.tsx",
      "src/components/AnimatedTabBar.tsx",
      "src/components/AuthFullscreenScaffold.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
    },
  },
]);
