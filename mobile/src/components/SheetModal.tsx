import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useMemo } from "react";
import { useAppSettings } from "../context/useAppSettings";
import { spacing, typography } from "../theme/tokens";
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
  size = "large",
}: SheetModalProps) {
  const { theme } = useAppSettings();

  function stopSheetPress(event: GestureResponderEvent) {
    event.stopPropagation();
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 36) onClose();
        },
      }),
    [onClose],
  );

  const sheetSizeStyle = size === "auto" ? styles.sheetAuto : size === "medium" ? styles.sheetMedium : styles.sheetLarge;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.backdrop }]} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
          <Pressable style={[styles.sheet, sheetSizeStyle, { backgroundColor: theme.canvas }]} onPress={stopSheetPress}>
            <View style={styles.dragArea} {...panResponder.panHandlers}>
              <View style={[styles.grabber, { backgroundColor: theme.border }]} />
            </View>

            {eyebrow ? <Text style={[styles.eyebrow, { color: theme.body }]}>{eyebrow}</Text> : null}
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

            <View style={styles.staticContent}>{children}</View>
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
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  sheetAuto: {
    maxHeight: "92%",
  },
  sheetMedium: {
    minHeight: "64%",
    maxHeight: "92%",
  },
  sheetLarge: {
    minHeight: "82%",
    maxHeight: "96%",
  },
  dragArea: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  eyebrow: {
    ...typography.caption,
  },
  title: {
    marginTop: spacing.xs,
    ...typography.titleMd,
  },
  staticContent: {
    gap: spacing.base,
    marginTop: spacing.base,
  },
});
