import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getErrorPresentation } from "../lib/errors";

type Props = {
  children: ReactNode;
};

type State = {
  error: unknown | null;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const presentation = getErrorPresentation(error, {
      title: "SplitVerse ran into a problem",
      fallbackMessage:
        "An unexpected app error occurred. Try reopening this screen.",
    });
    if (__DEV__) {
      console.error(
        "Unhandled SplitVerse UI error:",
        presentation.message,
        info.componentStack,
      );
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const presentation = getErrorPresentation(this.state.error, {
      title: "SplitVerse ran into a problem",
      fallbackMessage:
        "An unexpected app error occurred. Tap Try again. If it continues, restart the app.",
    });

    return (
      <View accessibilityLiveRegion="assertive" style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>APP ERROR</Text>
          <Text style={styles.title}>{presentation.title}</Text>
          <Text style={styles.message}>{presentation.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading SplitVerse again"
            style={styles.button}
            onPress={this.retry}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#050608",
    padding: 20,
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#2a2f39",
    borderRadius: 24,
    backgroundColor: "#15171c",
    padding: 22,
  },
  eyebrow: {
    color: "#ff8a1f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: "#f4f5f7",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },
  message: {
    color: "#c2c7d0",
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: "#ff8a1f",
    overflow: "hidden",
  },
  buttonText: {
    width: "100%",
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
