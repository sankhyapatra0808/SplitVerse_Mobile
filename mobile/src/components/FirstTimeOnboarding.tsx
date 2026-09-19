import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/useAppSettings";
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
} from "../lib/onboarding";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const steps: Step[] = [
  {
    eyebrow: "WELCOME",
    title: "Split smarter. Settle faster.",
    body: "Create shared rooms, divide expenses fairly, and always know what you owe or what others owe you.",
    detail: "SplitVerse keeps shared spending, settlements, wallet activity, and reminders together.",
    icon: "sparkles-outline",
  },
  {
    eyebrow: "FRIENDS & ROOMS",
    title: "Build your circle, then share expenses.",
    body: "Add friends and create Split Rooms for trips, dinners, shopping, rent, or anything you share.",
    detail: "Friends can be added to a room automatically when you assign an item or choose who should split it.",
    icon: "people-outline",
  },
  {
    eyebrow: "SPLITTING",
    title: "Split expenses your way.",
    body: "Use Manual Split when an item belongs to a specific person, or Automatic Split to divide an amount between selected friends.",
    detail: "Assign To and Split Between both use your friend list and keep the room members in sync.",
    icon: "git-compare-outline",
  },
  {
    eyebrow: "PAYABLE & RECEIVABLE",
    title: "See the amount that actually matters.",
    body: "SplitVerse adjusts expenses across rooms so Payable and Receivable show your real net position with each friend.",
    detail: "Opposite dues can offset each other automatically instead of making you settle every raw expense separately.",
    icon: "swap-horizontal-outline",
  },
  {
    eyebrow: "SETTLEMENTS",
    title: "Remind, collect, and see the full story.",
    body: "Send a reminder to one person, record a manual collection, or open Full Settlement to see every room and item behind a balance.",
    detail: "Settlement history keeps wallet payments, manual collections, offsets, pending amounts, and item-level details transparent.",
    icon: "receipt-outline",
  },
  {
    eyebrow: "WALLET & NOTIFICATIONS",
    title: "Keep payments and activity in one place.",
    body: "Use your SplitVerse Wallet for supported payments and stay updated with friend requests, settlements, and reminders.",
    detail: "Incoming, outgoing, and notification activity stay easy to review whenever you need them.",
    icon: "wallet-outline",
  },
  {
    eyebrow: "PRIVACY & SETTINGS",
    title: "Make SplitVerse yours.",
    body: "Use Privacy Mode for sensitive screens and personalize currency, language, appearance, and notification preferences from Settings.",
    detail: "You can change these choices later without affecting your rooms or settlement history.",
    icon: "shield-checkmark-outline",
  },
];

export default function FirstTimeOnboarding() {
  const { user, dbUser } = useAuth();
  const { theme } = useAppSettings();
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const readyForOnboarding = Boolean(
    user?.uid && dbUser && dbUser.has_wallet_pin !== false,
  );

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!user?.uid || !readyForOnboarding) {
        setVisible(false);
        return;
      }

      setChecking(true);
      try {
        const completed = await hasCompletedOnboarding(user.uid);
        if (!cancelled) {
          setVisible(!completed);
          if (!completed) setStepIndex(0);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [readyForOnboarding, user?.uid]);

  const compact = height < 720;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const progressLabel = useMemo(
    () => `${stepIndex + 1} of ${steps.length}`,
    [stepIndex],
  );

  async function finish() {
    if (!user?.uid) return;
    await markOnboardingCompleted(user.uid);
    setVisible(false);
    DeviceEventEmitter.emit("splitverse:onboarding-complete");
  }

  if (!readyForOnboarding || checking) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.screen, compact && styles.screenCompact]}>
          <View style={styles.topRow}>
            <Text style={[styles.brand, { color: theme.text }]}>SplitVerse</Text>
            {!isLast ? (
              <Pressable onPress={finish} hitSlop={12}>
                <Text style={[styles.skip, { color: theme.muted }]}>Skip</Text>
              </Pressable>
            ) : (
              <View style={styles.skipPlaceholder} />
            )}
          </View>

          <View
            style={[
              styles.hero,
              compact && styles.heroCompact,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={[styles.iconHalo, { backgroundColor: theme.primarySoft }]}> 
              <Ionicons name={step.icon} size={compact ? 64 : 78} color={theme.primary} />
            </View>

            <View style={styles.mockRow}>
              <View style={[styles.mockCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}> 
                <View style={[styles.mockDot, { backgroundColor: theme.primary }]} />
                <View style={[styles.mockLine, { backgroundColor: theme.surfaceStrong }]} />
                <View style={[styles.mockLineShort, { backgroundColor: theme.surfaceStrong }]} />
              </View>
              <View style={[styles.mockCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}> 
                <View style={[styles.mockDot, { backgroundColor: theme.success }]} />
                <View style={[styles.mockLine, { backgroundColor: theme.surfaceStrong }]} />
                <View style={[styles.mockLineShort, { backgroundColor: theme.surfaceStrong }]} />
              </View>
            </View>
          </View>

          <View style={styles.copy}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>{step.eyebrow}</Text>
            <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>{step.title}</Text>
            <Text style={[styles.body, compact && styles.bodyCompact, { color: theme.body }]}>{step.body}</Text>
            <Text style={[styles.detail, { color: theme.muted }]}>{step.detail}</Text>
          </View>

          <View style={styles.bottomArea}>
            <View style={styles.progressRow}>
              <View style={styles.dots}>
                {steps.map((item, index) => (
                  <View
                    key={item.eyebrow}
                    style={[
                      styles.dot,
                      {
                        width: index === stepIndex ? 24 : 7,
                        backgroundColor:
                          index === stepIndex ? theme.primary : theme.surfaceStrong,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.progressText, { color: theme.muted }]}>{progressLabel}</Text>
            </View>

            <View style={styles.actions}>
              {stepIndex > 0 ? (
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  stepIndex === 0 && styles.primaryButtonFull,
                  { backgroundColor: pressed ? theme.primaryActive : theme.primary },
                ]}
                onPress={() => {
                  if (isLast) {
                    void finish();
                    return;
                  }
                  setStepIndex((current) => current + 1);
                }}
              >
                <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  {isLast ? "Start using SplitVerse" : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.lg,
  },
  screenCompact: { gap: spacing.base },
  topRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontFamily: "LibreBaskerville_700Bold",
    fontSize: 22,
    lineHeight: 28,
  },
  skip: { ...typography.bodySm, fontWeight: "700" },
  skipPlaceholder: { width: 36 },
  hero: {
    flex: 1,
    minHeight: 230,
    maxHeight: 360,
    borderWidth: 1,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
    overflow: "hidden",
  },
  heroCompact: { minHeight: 200, maxHeight: 250, padding: spacing.base, gap: spacing.base },
  iconHalo: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: "center",
    justifyContent: "center",
  },
  mockRow: { flexDirection: "row", gap: spacing.sm },
  mockCard: {
    width: 112,
    height: 64,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 6,
  },
  mockDot: { width: 8, height: 8, borderRadius: 4 },
  mockLine: { width: "80%", height: 6, borderRadius: 4 },
  mockLineShort: { width: "55%", height: 6, borderRadius: 4 },
  copy: { gap: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 1.2 },
  title: {
    fontFamily: "LibreBaskerville_700Bold",
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  titleCompact: { fontSize: 25, lineHeight: 31 },
  body: { ...typography.body, fontSize: 16, lineHeight: 24 },
  bodyCompact: { fontSize: 14, lineHeight: 20 },
  detail: { ...typography.bodySm, lineHeight: 20 },
  bottomArea: { gap: spacing.base },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 7, borderRadius: 999 },
  progressText: { ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm },
  secondaryButton: {
    minHeight: 54,
    flex: 0.42,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 54,
    flex: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
  },
  primaryButtonFull: { flex: 1 },
  secondaryButtonText: { ...typography.button },
  primaryButtonText: { ...typography.button, textAlign: "center" },
});
