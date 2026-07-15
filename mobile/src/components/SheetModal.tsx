import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
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
  scroll = true,
}: SheetModalProps) {
  const { theme } = useAppSettings();

  function stopSheetPress(event: GestureResponderEvent) {
    event.stopPropagation();
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return (
            Math.abs(gesture.dy) > 10 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx)
          );
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 36) {
            onClose();
          }
        },
      }),
    [onClose],
  );

  const sheetSizeStyle =
    size === "auto"
      ? styles.sheetAuto
      : size === "medium"
        ? styles.sheetMedium
        : styles.sheetLarge;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated={Platform.OS === "android"}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.backdrop }]}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardView}
        >
          <Pressable
            accessibilityViewIsModal
            accessibilityLabel={title}
            style={[
              styles.sheet,
              sheetSizeStyle,
              {
                backgroundColor: theme.canvas,
                borderColor: theme.border,
              },
            ]}
            onPress={stopSheetPress}
          >
            <View style={styles.dragArea} {...panResponder.panHandlers}>
              <View
                style={[styles.grabber, { backgroundColor: theme.border }]}
              />
            </View>

            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: theme.body }]}>
                {eyebrow}
              </Text>
            ) : null}

            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              nestedScrollEnabled
              overScrollMode="never"
              scrollEnabled={scroll}
            >
              {children}
            </ScrollView>
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
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.xxl,
    overflow: "hidden",
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
    minHeight: 34,
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
  contentScroll: {
    flex: 1,
    marginTop: spacing.base,
  },
  contentContainer: {
    gap: spacing.base,
    paddingBottom: Platform.OS === "ios" ? spacing.xxl : spacing.xxl + 42,
  },
});
