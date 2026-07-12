import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useAppSettings } from "../context/useAppSettings";

export type AuthScreenPalette = {
  outer: string;
  top: string;
  panel: string;
  text: string;
  muted: string;
  line: string;
  button: string;
  buttonText: string;
  google: string;
  googleBorder: string;
  brandText: string;
  brandMuted: string;
};

export type AuthFullscreenScaffoldLayout = "default" | "login" | "signup";

type AuthFullscreenScaffoldProps = {
  title: string;
  layout?: AuthFullscreenScaffoldLayout;
  children: (context: {
    palette: AuthScreenPalette;
    compact: boolean;
    keyboardVisible: boolean;
  }) => ReactNode;
};

function blurCurrentInput() {
  const state = TextInput.State as unknown as {
    currentlyFocusedInput?: () => TextInput | null;
  };

  state.currentlyFocusedInput?.()?.blur();
}

export function AuthFullscreenScaffold({
  title,
  layout = "default",
  children,
}: AuthFullscreenScaffoldProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, t } = useAppSettings();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const dark = theme.mode === "dark";
  const compact = height < 720;
  const loginLayout = layout === "login";
  const signupLayout = layout === "signup";

  // Slightly wider than the screen so the roof base fully covers both edges.
  const peakBaseWidth = width * 1.18;
  const peakSize = peakBaseWidth / Math.SQRT2;

  const palette: AuthScreenPalette = {
    outer: dark ? "#080C15" : "#F3F7FB",
    top: dark ? "#202B40" : "#BBD8F8",
    panel: dark ? "#010213" : "#FFFFFF",
    text: dark ? "#FFFFFF" : "#101828",
    muted: dark ? "#8F97AB" : "#707887",
    line: dark ? "#343B50" : "#BFC4CC",
    button: dark ? "#3D4E68" : "#020314",
    buttonText: "#FFFFFF",
    google: dark ? "transparent" : "#F5F7F9",
    googleBorder: dark ? "#384158" : "#EDF0F4",
    brandText: dark ? "#FFFFFF" : "#071226",
    brandMuted: dark
      ? "rgba(255,255,255,0.74)"
      : "rgba(7,18,38,0.72)",
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      blurCurrentInput();
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function dismissKeyboardAndBlur() {
    blurCurrentInput();
    Keyboard.dismiss();
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: palette.top }]}
    >
      <StatusBar
        style={dark ? "light" : "dark"}
        backgroundColor={palette.top}
      />

      <KeyboardAvoidingView
        style={[
          styles.keyboardView,
          {
            backgroundColor: palette.panel,
            paddingBottom: insets.bottom,
          },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Pressable
          accessible={false}
          onPress={dismissKeyboardAndBlur}
          style={[styles.page, { backgroundColor: palette.panel }]}
        >
          <View style={[styles.authShell, { backgroundColor: palette.top }]}>
            <View
              style={[
                styles.brandArea,
                compact && styles.brandAreaCompact,
                loginLayout && styles.brandAreaLogin,
                signupLayout && styles.brandAreaSignup,
                compact && loginLayout && styles.brandAreaLoginCompact,
                compact && signupLayout && styles.brandAreaSignupCompact,
              ]}
            >
              <View style={styles.brandRow}>
                <View style={styles.logoWrap}>
                  <Image
                    source={require("../../assets/splitverse-logo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.brandCopy}>
                  <NativeText
                    allowFontScaling={false}
                    style={[styles.brandName, { color: palette.brandText }]}
                  >
                    SplitVerse
                  </NativeText>
                  <NativeText
                    allowFontScaling={false}
                    style={[
                      styles.brandTagline,
                      { color: palette.brandMuted },
                    ]}
                  >
                    Split fairly. Settle clearly.
                  </NativeText>
                </View>
              </View>
            </View>

            <View style={[styles.formPanel, { backgroundColor: palette.panel }]}>
              <View
                pointerEvents="none"
                style={[
                  styles.panelPeak,
                  {
                    width: peakSize,
                    height: peakSize,
                    top: -peakSize / 2.5,
                    marginLeft: -peakSize / 2,
                    backgroundColor: palette.panel,
                    transform: [{ rotate: "45deg" }],
                  },
                ]}
              />

              <View
                style={[
                  styles.formContent,
                  compact && styles.formContentCompact,
                  signupLayout && styles.formContentSignup,
                  compact && signupLayout && styles.formContentSignupCompact,
                ]}
              >
                <NativeText
                  allowFontScaling={false}
                  style={[
                    styles.formTitle,
                    compact && styles.formTitleCompact,
                    signupLayout && styles.formTitleSignup,
                    compact && signupLayout && styles.formTitleSignupCompact,
                    { color: palette.text },
                  ]}
                >
                  {t(title)}
                </NativeText>

                {children({ palette, compact, keyboardVisible })}
              </View>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FloatingAuthFieldProps = Omit<
  TextInputProps,
  "style" | "placeholder" | "onFocus" | "onBlur"
> & {
  label: string;
  palette: AuthScreenPalette;
  compact?: boolean;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
  rightIconName?: ComponentProps<typeof Ionicons>["name"];
  rightIconAccessibilityLabel?: string;
  onRightIconPress?: () => void;
  onFocus?: TextInputProps["onFocus"];
  onBlur?: TextInputProps["onBlur"];
};

export const FloatingAuthField = forwardRef<TextInput, FloatingAuthFieldProps>(
  function FloatingAuthField(
    {
      label,
      palette,
      compact = false,
      rightActionLabel,
      onRightActionPress,
      rightIconName,
      rightIconAccessibilityLabel,
      onRightIconPress,
      value,
      editable = true,
      onFocus,
      onBlur,
      ...props
    },
    forwardedRef,
  ) {
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = useState(false);
    const progress = useRef(
      new Animated.Value(String(value ?? "").length > 0 ? 1 : 0),
    ).current;

    useImperativeHandle(forwardedRef, () => inputRef.current as TextInput);

    const raised = focused || String(value ?? "").length > 0;

    useEffect(() => {
      Animated.timing(progress, {
        toValue: raised ? 1 : 0,
        duration: 160,
        useNativeDriver: false,
      }).start();
    }, [progress, raised]);

    const labelTop = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [compact ? 19 : 21, 1],
    });

    const labelSize = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [compact ? 12 : 14, compact ? 9 : 10],
    });

    const hasRightAction = Boolean(
      rightActionLabel && onRightActionPress,
    );
    const hasRightIcon = Boolean(rightIconName && onRightIconPress);

    const inputRightPadding =
      hasRightAction && hasRightIcon
        ? 116
        : hasRightIcon
          ? 42
          : hasRightAction
            ? 78
            : 0;

    return (
      <Pressable
        accessible={false}
        onPress={() => {
          if (editable) inputRef.current?.focus();
        }}
        style={[
          styles.floatingField,
          compact && styles.floatingFieldCompact,
          { borderBottomColor: palette.line },
        ]}
      >
        <Animated.Text
          allowFontScaling={false}
          pointerEvents="none"
          style={[
            styles.floatingLabel,
            {
              top: labelTop,
              fontSize: labelSize,
              color: focused ? palette.text : palette.muted,
            },
          ]}
        >
          {label}
        </Animated.Text>

        {hasRightIcon || hasRightAction ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.rightControls,
              compact && styles.rightControlsCompact,
            ]}
          >
            {hasRightIcon ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rightIconAccessibilityLabel}
                onPress={onRightIconPress}
                disabled={!editable}
                hitSlop={8}
                style={styles.inlineEyeButton}
              >
                <Ionicons
                  name={rightIconName}
                  size={19}
                  color={palette.muted}
                />
              </Pressable>
            ) : null}

            {hasRightAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rightActionLabel}
                onPress={onRightActionPress}
                disabled={!editable}
                hitSlop={8}
                style={styles.inlineActionButton}
              >
                <NativeText
                  allowFontScaling={false}
                  style={[
                    styles.rightActionText,
                    { color: palette.text },
                  ]}
                >
                  {rightActionLabel}
                </NativeText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <TextInput
          {...props}
          ref={inputRef}
          value={value}
          editable={editable}
          placeholder=""
          placeholderTextColor="transparent"
          selectionColor={palette.text}
          cursorColor={palette.text}
          allowFontScaling={false}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.floatingInput,
            compact && styles.floatingInputCompact,
            {
              color: palette.text,
              paddingRight: inputRightPadding,
            },
          ]}
        />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: "100%",
  },
  authShell: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
  },
  brandArea: {
    height: "42%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 22,
    paddingTop: 72,
  },
  brandAreaCompact: {
    height: "39%",
    paddingTop: 44,
  },
  brandAreaLogin: {
    height: "40%",
    paddingTop: 52,
    position: "relative",
    zIndex: 4,
    elevation: 4,
  },
  brandAreaLoginCompact: {
    height: "37%",
    paddingTop: 34,
  },
  brandAreaSignup: {
    height: "35%",
    paddingTop: 44,
    position: "relative",
    zIndex: 4,
    elevation: 4,
  },
  brandAreaSignupCompact: {
    height: "32%",
    paddingTop: 28,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  logoWrap: {
    width: 48,
    height: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandCopy: {
    gap: 0,
  },
  brandName: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    includeFontPadding: true,
  },
  brandTagline: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
    includeFontPadding: true,
  },
  formPanel: {
    flex: 1,
    marginTop: 16,
    position: "relative",
  },
  panelPeak: {
    position: "absolute",
    left: "50%",
    borderRadius: 50,
  },
  formContent: {
    flex: 1,
    position: "relative",
    zIndex: 2,
    paddingHorizontal: 34,
    paddingBottom: 22,
  },
  formContentCompact: {
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  formContentSignup: {
    paddingHorizontal: 32,
    paddingBottom: 10,
  },
  formContentSignupCompact: {
    paddingHorizontal: 26,
    paddingBottom: 6,
  },
  formTitle: {
    alignSelf: "center",
    marginTop: -34,
    marginBottom: 26,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    includeFontPadding: true,
  },
  formTitleCompact: {
    marginTop: -27,
    marginBottom: 15,
    fontSize: 25,
    lineHeight: 32,
  },
  formTitleSignup: {
    marginTop: -32,
    marginBottom: 14,
    fontSize: 28,
    lineHeight: 36,
  },
  formTitleSignupCompact: {
    marginTop: -25,
    marginBottom: 8,
    fontSize: 24,
    lineHeight: 30,
  },
  floatingField: {
    height: 58,
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  floatingFieldCompact: {
    height: 51,
  },
  floatingLabel: {
    position: "absolute",
    left: 0,
    zIndex: 2,
    fontWeight: "500",
    includeFontPadding: true,
  },
  floatingInput: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 3,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    includeFontPadding: true,
  },
  floatingInputCompact: {
    paddingTop: 15,
    fontSize: 12,
    lineHeight: 17,
  },
  rightControls: {
    position: "absolute",
    right: 0,
    bottom: 6,
    zIndex: 6,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  rightControlsCompact: {
    bottom: 3,
    minHeight: 32,
    gap: 7,
  },
  inlineEyeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineActionButton: {
    minHeight: 34,
    minWidth: 48,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  rightActionText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    includeFontPadding: true,
  },
});
