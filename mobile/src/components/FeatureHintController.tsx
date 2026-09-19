import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/useAppSettings";
import {
  hasCompletedOnboarding,
  hasSeenFeatureHint,
  markFeatureHintSeen,
} from "../lib/onboarding";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type Hint = {
  key: string;
  title: string;
  body: string;
};

function getHint(pathname: string): Hint | null {
  if (pathname.includes("settlement-history")) {
    return {
      key: "settlement-history",
      title: "Every balance has a story",
      body: "Full Settlement shows every room, item, wallet payment, manual collection, offset, and pending amount behind this friend balance.",
    };
  }

  if (pathname.includes("settlement-details")) {
    return {
      key: "settlement-details",
      title: "These are adjusted settlements",
      body: "Payable and Receivable can combine dues from several rooms. Use Remind or Manual Collect for one person, or open Full Settlement for the detailed breakdown.",
    };
  }

  if (pathname.includes("split-rooms")) {
    return {
      key: "split-rooms",
      title: "Create first, then add people naturally",
      body: "Create the room first. Assign To and Split Between use your friend list and automatically keep the room member list updated.",
    };
  }

  if (pathname.includes("friends")) {
    return {
      key: "friends",
      title: "Build your SplitVerse circle",
      body: "Search for people, send requests, and keep your friend list ready for shared rooms and expense splitting.",
    };
  }

  if (pathname.includes("wallet")) {
    return {
      key: "wallet",
      title: "Your wallet activity lives here",
      body: "Review balances, incoming and outgoing activity, and use supported wallet payments when settling with friends.",
    };
  }

  if (pathname.includes("notifications")) {
    return {
      key: "notifications",
      title: "Stay on top of what needs attention",
      body: "Friend requests, settlement reminders, and important activity appear here so nothing gets missed.",
    };
  }

  if (pathname.includes("settings")) {
    return {
      key: "settings",
      title: "Make SplitVerse yours",
      body: "Adjust Privacy Mode, currency, language, appearance, wallet preferences, and notifications without changing your expense history.",
    };
  }

  if (pathname.includes("dashboard")) {
    return {
      key: "dashboard",
      title: "Your shared spending at a glance",
      body: "Use the dashboard to see your current position and jump quickly into the parts of SplitVerse you use most.",
    };
  }

  return null;
}

export default function FeatureHintController() {
  const pathname = usePathname();
  const { user, dbUser } = useAuth();
  const { theme } = useAppSettings();
  const hint = useMemo(() => getHint(pathname), [pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkHint() {
      if (!user?.uid || !dbUser || dbUser.has_wallet_pin === false || !hint) {
        setVisible(false);
        return;
      }

      const onboardingComplete = await hasCompletedOnboarding(user.uid);
      if (!onboardingComplete) {
        if (!cancelled) setVisible(false);
        return;
      }

      const seen = await hasSeenFeatureHint(user.uid, hint.key);
      if (!cancelled) setVisible(!seen);
    }

    void checkHint();

    const subscription = DeviceEventEmitter.addListener(
      "splitverse:onboarding-complete",
      () => {
        void checkHint();
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [dbUser, hint, user?.uid]);

  async function dismiss() {
    if (!user?.uid || !hint) return;
    await markFeatureHintSeen(user.uid, hint.key);
    setVisible(false);
  }

  if (!hint) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => void dismiss()}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.backdrop }]}
        onPress={() => void dismiss()}
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => undefined}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}> 
            <Ionicons name="bulb-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>QUICK TIP</Text>
            <Text style={[styles.title, { color: theme.text }]}>{hint.title}</Text>
            <Text style={[styles.body, { color: theme.body }]}>{hint.body}</Text>
          </View>
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => void dismiss()}
          >
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.base,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.base,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 1 },
  title: { ...typography.titleMd },
  body: { ...typography.bodySm },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...typography.button },
});
