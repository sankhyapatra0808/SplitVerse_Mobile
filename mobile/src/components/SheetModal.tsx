import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import AppButton from "./AppButton";
import { colors, radius, spacing, typography } from "../theme/tokens";

type SheetModalProps = {
  visible: boolean;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeTitle?: string;
};

export default function SheetModal({
  visible,
  title,
  eyebrow,
  children,
  onClose,
  closeTitle = "Close",
}: SheetModalProps) {
  function stopSheetPress(event: GestureResponderEvent) {
    event.stopPropagation();
  }

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
          <Pressable style={styles.sheet} onPress={stopSheetPress}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEventThrottle={16}
            >
              {children}
            </ScrollView>

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
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.canvas,
    padding: spacing.base,
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
    marginTop: spacing.base,
  },
  scrollContent: {
    gap: spacing.base,
    paddingBottom: spacing.base,
  },
  footer: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
});