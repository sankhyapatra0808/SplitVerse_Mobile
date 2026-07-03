import { View, Text, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>SplitVerse Mobile</Text>
      <Text style={styles.subtitle}>Mobile app setup is working.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  title: {
    color: "#0a0b0d",
    fontSize: 32,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 8,
    color: "#5b616e",
    fontSize: 16,
  },
});