import { router } from "expo-router";
import { useEffect } from "react";
import LoadingState from "../../src/components/LoadingState";
import Screen from "../../src/components/Screen";

export default function FriendsRedirect() {
  useEffect(() => {
    router.replace("/(tabs)/profile");
  }, []);

  return (
    <Screen scroll={false}>
      <LoadingState label="Opening profile..." />
    </Screen>
  );
}