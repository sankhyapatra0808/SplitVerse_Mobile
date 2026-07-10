import { StyleSheet, View } from "react-native";

export default function LoadingState() {
  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 80,
  },
});
