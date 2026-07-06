import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  rightSlot,
}: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.caption,
  },
  title: {
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    color: colors.body,
    ...typography.bodySm,
  },
});