import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAppSettings } from "../../src/context/useAppSettings";

const sections = [
  {
    title: "1. Acceptance and eligibility",
    body: "By using SplitVerse, you agree to these Terms. You must be legally capable of entering into a binding agreement and, where required by law, be at least 18 years old. You are responsible for ensuring that your use of the app is lawful in your location.",
  },
  {
    title: "2. What SplitVerse provides",
    body: "SplitVerse helps users record expenses, create split rooms, assign item-wise shares, track dues, and initiate supported payment or wallet actions. SplitVerse is not a bank, lender, escrow service, investment platform, or financial adviser. Any payment, wallet, or settlement feature is subject to applicable law and the terms of the authorised payment provider used for that transaction.",
  },
  {
    title: "3. Accounts and security",
    body: "You must provide accurate information, protect your password, OTPs, wallet PIN, and device, and notify SplitVerse promptly if you suspect unauthorised access. You are responsible for activity performed through your account unless applicable law provides otherwise.",
  },
  {
    title: "4. Payments, wallet balances, and third parties",
    body: "Payments may be processed by third-party providers such as Razorpay, banks, card networks, UPI participants, or other regulated entities. Their terms, privacy practices, verification requirements, fees, processing times, and failure rules may also apply. SplitVerse does not guarantee that every payment attempt will succeed or settle instantly.",
  },
  {
    title: "5. Expense records and user disputes",
    body: "Users are responsible for entering correct amounts, assigning expenses to the correct people, and checking settlement details before paying. SplitVerse may calculate balances from the information supplied by users, but it does not independently verify restaurant bills, purchases, loans, personal arrangements, or offline payments. Disputes between users should first be resolved between the users involved.",
  },
  {
    title: "6. Failed, reversed, and refunded transactions",
    body: "A failed, pending, reversed, duplicated, or refunded transaction may take time to appear correctly because banks and payment providers process updates on their own timelines. Refund eligibility depends on the underlying transaction, the payment provider, the recipient, and applicable law. SplitVerse may request supporting information before investigating a payment issue.",
  },
  {
    title: "7. Prohibited use",
    body: "You must not use SplitVerse for fraud, money laundering, unauthorised money transmission, illegal goods or services, gambling where prohibited, sanctions evasion, harassment, impersonation, account abuse, security attacks, or any activity that violates law or another person's rights. SplitVerse may restrict, suspend, or close accounts where misuse or legal risk is suspected.",
  },
  {
    title: "8. Privacy and data",
    body: "SplitVerse processes account, expense, room, friend, device, and transaction-related information to operate and secure the service. Payment providers may process additional information under their own policies. You should not upload sensitive information that is unnecessary for using the app.",
  },
  {
    title: "9. Service availability",
    body: "The service may occasionally be unavailable because of maintenance, internet failures, banking downtime, payment-provider issues, security incidents, or events outside reasonable control. SplitVerse will try to restore service promptly but does not promise uninterrupted availability.",
  },
  {
    title: "10. Limitation of responsibility",
    body: "To the maximum extent permitted by law, SplitVerse is not responsible for indirect or consequential loss, disputes caused by incorrect user-entered information, losses caused by sharing credentials or OTPs, or failures originating from banks, networks, devices, or third-party providers. Nothing in these Terms excludes rights or liability that cannot legally be excluded.",
  },
  {
    title: "11. Changes and termination",
    body: "SplitVerse may update features or these Terms when needed for security, legal, operational, or product reasons. Material changes should be communicated through the app or another reasonable channel. You may stop using the service, and account deletion remains subject to completion of pending obligations and legally required record retention.",
  },
  {
    title: "12. Governing law and complaints",
    body: "These Terms are governed by the laws of India. Before starting formal proceedings, users should contact SplitVerse through the support channel available in the app and allow a reasonable opportunity to investigate. Any mandatory consumer, payment, or data-protection rights continue to apply.",
  },
];

export default function TermsAndConditions() {
  const { theme } = useAppSettings();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === "dark";

  const palette = {
    top: dark ? "#202B40" : "#BBD8F8",
    panel: dark ? "#010213" : "#FFFFFF",
    text: dark ? "#FFFFFF" : "#101828",
    muted: dark ? "#9CA4B8" : "#667085",
    line: dark ? "#343B50" : "#E4E7EC",
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: palette.top }]}
    >
      <StatusBar
        style={dark ? "light" : "dark"}
        backgroundColor={palette.top}
      />

      <View
        style={[
          styles.page,
          {
            backgroundColor: palette.panel,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={[styles.header, { backgroundColor: palette.top }]}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  borderColor: dark
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(7,18,38,0.14)",
                },
              ]}
            >
              <Ionicons name="chevron-back" size={21} color={palette.text} />
            </Pressable>

            <View style={styles.brandRow}>
              <View style={styles.logoWrap}>
                <Image
                  source={require("../../assets/splitverse-logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View>
                <NativeText
                  allowFontScaling={false}
                  style={[styles.brandName, { color: palette.text }]}
                >
                  SplitVerse
                </NativeText>
                <NativeText
                  allowFontScaling={false}
                  style={[styles.brandTagline, { color: palette.muted }]}
                >
                  Split fairly. Settle clearly.
                </NativeText>
              </View>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <NativeText
            allowFontScaling={false}
            style={[styles.headerTitle, { color: palette.text }]}
          >
            Terms & Conditions
          </NativeText>
          <NativeText
            allowFontScaling={false}
            style={[styles.updatedText, { color: palette.muted }]}
          >
            Last updated: 12 July 2026
          </NativeText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
        >
          <NativeText
            allowFontScaling={false}
            style={[styles.intro, { color: palette.muted }]}
          >
            Please read these Terms before using SplitVerse, especially before
            using wallet, payment, or settlement features.
          </NativeText>

          {sections.map((section) => (
            <View
              key={section.title}
              style={[styles.section, { borderBottomColor: palette.line }]}
            >
              <NativeText
                allowFontScaling={false}
                style={[styles.sectionTitle, { color: palette.text }]}
              >
                {section.title}
              </NativeText>
              <NativeText
                allowFontScaling={false}
                style={[styles.sectionBody, { color: palette.muted }]}
              >
                {section.body}
              </NativeText>
            </View>
          ))}

          <NativeText
            allowFontScaling={false}
            style={[styles.finalNote, { color: palette.muted }]}
          >
            Using SplitVerse does not remove your responsibility to comply with
            banking, tax, consumer, payment, anti-fraud, and other applicable
            laws.
          </NativeText>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: dark ? "#3D4E68" : "#020314",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <NativeText allowFontScaling={false} style={styles.closeButtonText}>
              Back to login
            </NativeText>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 20,
  },
  headerSpacer: {
    width: 40,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  logoWrap: {
    width: 38,
    height: 38,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 35,
    height: 35,
  },
  brandName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    includeFontPadding: true,
  },
  brandTagline: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "400",
    includeFontPadding: true,
  },
  headerTitle: {
    marginTop: 22,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    includeFontPadding: true,
  },
  updatedText: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 15,
    includeFontPadding: true,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  intro: {
    marginBottom: 18,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: true,
  },
  section: {
    paddingBottom: 17,
    marginBottom: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    marginBottom: 7,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    includeFontPadding: true,
  },
  sectionBody: {
    fontSize: 11,
    lineHeight: 18,
    includeFontPadding: true,
  },
  finalNote: {
    fontSize: 10,
    lineHeight: 17,
    includeFontPadding: true,
  },
  closeButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 4,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    includeFontPadding: true,
  },
});
