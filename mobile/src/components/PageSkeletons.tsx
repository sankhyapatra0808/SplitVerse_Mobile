import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing } from "../theme/tokens";
import { SkeletonLine } from "./Skeleton";

function SkeletonBlock({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const { theme } = useAppSettings();
  return (
    <View
      style={[
        styles.block,
        compact && styles.blockCompact,
        { borderColor: theme.borderSoft, backgroundColor: theme.card },
      ]}
    >
      {children}
    </View>
  );
}

function MetricRow() {
  return (
    <View style={styles.metricRow}>
      <SkeletonLine width="26%" height={42} />
      <SkeletonLine width="26%" height={42} />
      <SkeletonLine width="26%" height={42} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonBlock>
        <SkeletonLine width="32%" height={14} />
        <SkeletonLine width="58%" height={34} />
        <SkeletonLine width="76%" height={16} />
      </SkeletonBlock>
      <MetricRow />
      <SkeletonBlock>
        <SkeletonLine width="46%" height={18} />
        <SkeletonLine width="100%" height={160} />
      </SkeletonBlock>
      <SkeletonBlock>
        <SkeletonLine width="52%" height={18} />
        <SkeletonLine width="100%" height={48} />
        <SkeletonLine width="70%" height={48} />
      </SkeletonBlock>
    </View>
  );
}

export function RoomsSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonBlock>
        <SkeletonLine width="30%" height={14} />
        <SkeletonLine width="62%" height={34} />
        <SkeletonLine width="92%" height={48} />
        <SkeletonLine width="78%" height={48} />
      </SkeletonBlock>
      <SkeletonBlock>
        <SkeletonLine width="42%" height={18} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.roomRow}>
            <View style={styles.copy}>
              <SkeletonLine width="46%" height={22} />
              <SkeletonLine width="28%" height={16} />
              <SkeletonLine width="22%" height={20} />
            </View>
          </View>
        ))}
      </SkeletonBlock>
    </View>
  );
}

export function RoomsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.inlineList}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.roomRow}>
          <SkeletonLine width="44%" height={22} />
          <SkeletonLine width="28%" height={16} />
          <SkeletonLine width="24%" height={22} />
        </View>
      ))}
    </View>
  );
}

export function WalletSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonBlock>
        <SkeletonLine width="34%" height={14} />
        <SkeletonLine width="70%" height={38} />
        <SkeletonLine width="56%" height={16} />
      </SkeletonBlock>
      <MetricRow />
      <SkeletonBlock>
        <SkeletonLine width="48%" height={18} />
        <SkeletonLine width="100%" height={54} />
        <SkeletonLine width="88%" height={54} />
      </SkeletonBlock>
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonBlock>
        <View style={styles.center}>
          <SkeletonLine width={88} height={88} style={styles.circle} />
          <SkeletonLine width="54%" height={26} />
          <SkeletonLine width="42%" height={16} />
        </View>
      </SkeletonBlock>
      <MetricRow />
      <SkeletonBlock>
        <SkeletonLine width="44%" height={18} />
        <SkeletonLine width="100%" height={58} />
        <SkeletonLine width="86%" height={58} />
      </SkeletonBlock>
    </View>
  );
}

export function FriendsSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonBlock>
        <SkeletonLine width="36%" height={14} />
        <SkeletonLine width="58%" height={30} />
        <SkeletonLine width="100%" height={48} />
      </SkeletonBlock>
      <SkeletonBlock>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.friendRow}>
            <SkeletonLine width={48} height={48} style={styles.circle} />
            <View style={styles.copy}>
              <SkeletonLine width="58%" height={18} />
              <SkeletonLine width="36%" height={14} />
            </View>
          </View>
        ))}
      </SkeletonBlock>
    </View>
  );
}

export function InlineListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.inlineList}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.friendRow}>
          <SkeletonLine width={42} height={42} style={styles.circle} />
          <View style={styles.copy}>
            <SkeletonLine width="60%" height={16} />
            <SkeletonLine width="42%" height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.base,
    padding: spacing.base,
    paddingBottom: spacing.xxl + 96,
  },
  block: {
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  blockCompact: {
    padding: spacing.base,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  roomRow: {
    minHeight: 94,
    justifyContent: "center",
    gap: spacing.xs,
  },
  friendRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
  },
  circle: {
    borderRadius: radius.full,
  },
  inlineList: {
    gap: spacing.sm,
  },
});
