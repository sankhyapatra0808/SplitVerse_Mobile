import { memo } from "react";
import { StyleSheet, type TextProps } from "react-native";
import Text from "./LocalizedText";
import { useAppSettings, type CurrencyCode } from "../context/useAppSettings";

type AmountTextProps = TextProps & {
  amount?: number | null;
  currency?: string | CurrencyCode;
  sourceCurrency?: CurrencyCode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "success" | "danger" | "primary";
};

function AmountText({
  amount = 0,
  currency,
  sourceCurrency = "INR",
  size = "md",
  tone = "default",
  style,
  ...props
}: AmountTextProps) {
  const { appCurrency, convertCurrency, formatCurrencyValue, theme } =
    useAppSettings();
  const targetCurrency =
    currency && currency.length === 3
      ? (currency as CurrencyCode)
      : appCurrency;
  const convertedAmount = convertCurrency(
    Number(amount || 0),
    sourceCurrency,
    targetCurrency,
  );
  const value = formatCurrencyValue(convertedAmount, targetCurrency);
  const toneColor =
    tone === "success"
      ? theme.success
      : tone === "danger"
        ? theme.danger
        : tone === "primary"
          ? theme.primary
          : theme.text;

  return (
    <Text
      {...props}
      style={[
        styles.base,
        size === "sm" && styles.sm,
        size === "md" && styles.md,
        size === "lg" && styles.lg,
        { color: toneColor },
        style,
      ]}
    >
      {value}
    </Text>
  );
}

export default memo(AmountText);

const styles = StyleSheet.create({
  base: {
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
});
