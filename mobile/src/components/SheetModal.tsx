import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import AppButton from "./AppButton";
import { colors, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type SheetModalSize = "auto" | "medium" | "large";

type SheetModalProps = {
  visible: boolean;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeTitle?: string;
  size?: SheetModalSize;
  scroll?: boolean;
};

export default function SheetModal({
  visible,
  title,
  eyebrow,
  children,
  onClose,
  closeTitle = "Close",
  size = "medium",
  scroll = true,
}: SheetModalProps) {
  function stopSheetPress(event: GestureResponderEvent) {
    event.stopPropagation();
  }

  const sheetSizeStyle =
    size === "large"
      ? styles.sheetLarge
      : size === "auto"
        ? styles.sheetAuto
        : styles.sheetMedium;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <Pressable
            style={[styles.sheet, sheetSizeStyle]}
            onPress={stopSheetPress}
          >
            <View style={styles.grabber} />

            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>

            {scroll ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                scrollEventThrottle={16}
                bounces={false}
                overScrollMode="never"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.staticContent}>{children}</View>
            )}

            <View style={styles.footer}>
              <AppButton
                title={closeTitle}
                variant="secondary"
                onPress={onClose}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 11, 13, 0.45)",
  },
  keyboardView: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.canvas,
    padding: spacing.base,
  },
  sheetAuto: {
    maxHeight: "92%",
  },
  sheetMedium: {
    minHeight: "58%",
    maxHeight: "92%",
  },
  sheetLarge: {
    minHeight: "76%",
    maxHeight: "94%",
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.ink,
    ...typography.titleMd,
  },
  scroll: {
    flex: 1,
    marginTop: spacing.base,
  },
  scrollContent: {
    gap: spacing.base,
    paddingBottom: spacing.base,
  },
  staticContent: {
    gap: spacing.base,
    marginTop: spacing.base,
  },
  footer: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
});