import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme/tokens";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
};

export default function Screen({ children, scroll = true }: ScreenProps) {
  if (!scroll) {
    return <SafeAreaView style={styles.safe}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
});