import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppCard from "../../src/components/AppCard";
import EmptyState from "../../src/components/EmptyState";
import { RoomsListSkeleton } from "../../src/components/PageSkeletons";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAppSettings } from "../../src/context/useAppSettings";
import { getSplitRooms, type SplitRoom } from "../../src/lib/api";
import { showErrorAlert } from "../../src/lib/errors";
import { radius, spacing, typography } from "../../src/theme/tokens";

let roomHistoryCache: SplitRoom[] | null = null;

function getCategoryLabel(value?: string | null) {
  if (!value) return "Split room";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RoomHistory() {
  const { theme } = useAppSettings();
  const [rooms, setRooms] = useState<SplitRoom[]>(roomHistoryCache ?? []);
  const [loading, setLoading] = useState(!roomHistoryCache);

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))),
    [rooms],
  );

  const loadRooms = useCallback(async (silent = false) => {
    try {
      if (!silent && !roomHistoryCache) setLoading(true);
      const data = await getSplitRooms();
      roomHistoryCache = data.rooms ?? [];
      setRooms(data.rooms ?? []);
    } catch (error) {
      if (!silent) {
        showErrorAlert(error, {
          title: "Could not load room history",
          fallbackMessage: "Your split-room history could not be loaded. Pull down to try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRooms(Boolean(roomHistoryCache));
    }, [loadRooms]),
  );

  if (loading && !roomHistoryCache) {
    return (
      <Screen scroll={false}>
        <RoomsListSkeleton rows={4} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => loadRooms(false)} contentStyle={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Rooms</Text>
        <Text style={[styles.title, { color: theme.text }]}>Room history</Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>You are part of {rooms.length} room{rooms.length === 1 ? "" : "s"}.</Text>
      </View>

      <AppCard style={styles.card}>
        {sortedRooms.length === 0 ? (
          <EmptyState title="No rooms yet" message="Rooms you create or join will appear here." />
        ) : (
          <View style={styles.list}>
            {sortedRooms.map((room) => {
              const outstanding = Number(room.outstandingAmount || 0);
              return (
                <Pressable
                  key={room.id}
                  style={({ pressed }) => [
                    styles.roomRow,
                    { borderColor: theme.border, backgroundColor: theme.surface, transform: [{ scale: pressed ? 0.992 : 1 }] },
                  ]}
                  onPress={() => router.push("/(tabs)/split-rooms")}
                >
                  <View style={styles.roomTopLine}>
                    <Text style={[styles.roomName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
                    <Text style={[styles.roomMembers, { color: theme.body }]}>{room.memberCount ?? room.members?.length ?? 0} members</Text>
                  </View>
                  <View style={styles.roomBottomLine}>
                    <View style={styles.roomCopy}>
                      <Text style={[styles.roomMeta, { color: theme.body }]} numberOfLines={1}>{getCategoryLabel(room.category)} · {room.status || "active"}</Text>
                      <Text style={[styles.statusPill, { backgroundColor: theme.surfaceStrong, color: theme.body }]}>{outstanding > 0 ? "Due pending" : "All paid"}</Text>
                    </View>
                    <AmountText amount={Number(room.totalAmount || 0)} size="sm" tone="primary" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  topBar: { paddingTop: spacing.sm },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption },
  title: { ...typography.titleLg },
  subtitle: { ...typography.bodySm },
  card: { gap: spacing.base },
  list: { gap: spacing.sm },
  roomRow: { gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.base },
  roomTopLine: { flexDirection: "row", justifyContent: "space-between", gap: spacing.base },
  roomName: { flex: 1, minWidth: 0, ...typography.titleSm },
  roomMembers: { ...typography.bodySm },
  roomBottomLine: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.base },
  roomCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  roomMeta: { ...typography.bodySm },
  statusPill: { alignSelf: "flex-start", overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, ...typography.caption },
});
