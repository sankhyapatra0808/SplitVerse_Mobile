import { StyleSheet, Text, type TextProps } from "react-native";
import { useAppSettings, type CurrencyCode } from "../context/useAppSettings";
import { colors } from "../theme/tokens";

type AmountTextProps = TextProps & {
  amount?: number | null;
  currency?: string | CurrencyCode;
  sourceCurrency?: CurrencyCode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "success" | "danger" | "primary";
};

export default function AmountText({
  amount = 0,
  currency,
  sourceCurrency = "INR",
  size = "md",
  tone = "default",
  style,
  ...props
}: AmountTextProps) {
  const { appCurrency, convertCurrency, formatCurrencyValue } = useAppSettings();
  const targetCurrency = currency && currency.length === 3 ? (currency as CurrencyCode) : appCurrency;
  const convertedAmount = convertCurrency(Number(amount || 0), sourceCurrency, targetCurrency);
  const value = formatCurrencyValue(convertedAmount, targetCurrency);

  return (
    <Text
      {...props}
      style={[
        styles.base,
        size === "sm" && styles.sm,
        size === "md" && styles.md,
        size === "lg" && styles.lg,
        tone === "success" && styles.success,
        tone === "danger" && styles.danger,
        tone === "primary" && styles.primary,
        style,
      ]}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
    fontWeight: "600",
  },
  sm: {
    fontSize: 14,
    lineHeight: 20,
  },
  md: {
    fontSize: 20,
    lineHeight: 26,
  },
  lg: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "400",
  },
  success: {
    color: colors.success,
  },
  danger: {
    color: colors.danger,
  },
  primary: {
    color: colors.primary,
  },
});
