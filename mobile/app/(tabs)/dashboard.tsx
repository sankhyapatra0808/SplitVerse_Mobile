import { StyleSheet, Text } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Screen>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>SplitVerse mobile dashboard</Text>
        <Text style={styles.cardText}>
          Next we will connect this screen to your backend summary API.
        </Text>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.xl,
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.body,
    ...typography.bodySm,
  },
  card: {
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
});