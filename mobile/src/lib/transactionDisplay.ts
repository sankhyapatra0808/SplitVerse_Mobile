import type { TransactionItem } from "./api";

export type DisplayTransactionItem = TransactionItem & {
  displayAmount?: number;
  groupedIds?: string[];
};

function normalizeText(value?: string | null) {
  return String(value ?? "").toLowerCase();
}

function transactionText(transaction: TransactionItem) {
  return [
    transaction.type,
    transaction.status,
    transaction.displayStatus,
    transaction.title,
    transaction.description,
    transaction.roomName,
    transaction.counterpartyName,
    transaction.counterpartyEmail,
  ]
    .map((value) => normalizeText(value))
    .join(" ");
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(" ", "T");
  const hasTimezone = /z$|[+-]\d{2}:?\d{2}$/i.test(normalized);
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getTransactionTime(transaction: TransactionItem) {
  return parseDate(transaction.createdAt || transaction.displayDate)?.getTime() ?? 0;
}

function getDateBucket(transaction: TransactionItem) {
  const date = parseDate(transaction.createdAt || transaction.displayDate);
  if (!date) return "unknown-date";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}-${minute}`;
}

export function isWalletDebitTransaction(transaction: TransactionItem) {
  const text = transactionText(transaction);
  return (
    Number(transaction.amount || 0) < 0 &&
    (text.includes("wallet") ||
      text.includes("debit") ||
      text.includes("paid from wallet") ||
      text.includes("wallet payment"))
  );
}

export function isExpenseTransaction(transaction: TransactionItem) {
  const text = transactionText(transaction);
  return (
    Number(transaction.amount || 0) < 0 &&
    (text.includes("expense") ||
      text.includes("spent") ||
      text.includes("today") ||
      normalizeText(transaction.type) === "expense")
  );
}

export function isCreditLikeTransaction(transaction: TransactionItem) {
  const text = transactionText(transaction);
  return (
    Number(transaction.amount || 0) > 0 ||
    text.includes("top-up") ||
    text.includes("top up") ||
    text.includes("added") ||
    text.includes("credit") ||
    text.includes("received")
  );
}

function duplicateSpendKey(transaction: TransactionItem) {
  return `${Math.abs(Number(transaction.amount || 0)).toFixed(2)}-${getDateBucket(transaction)}`;
}

function combineExpenseWithWalletDebit(expense: TransactionItem, walletDebit: TransactionItem): DisplayTransactionItem {
  const expenseTitle = expense.title || expense.description || "Expense";
  const walletTitle = walletDebit.title || walletDebit.description;
  return {
    ...expense,
    title: expenseTitle,
    description: walletTitle && !normalizeText(expenseTitle).includes("wallet")
      ? `${expenseTitle} · paid from wallet`
      : expense.description || expenseTitle,
    displayAmount: -Math.abs(Number(expense.amount || walletDebit.amount || 0)),
    groupedIds: [expense.id, walletDebit.id],
  };
}

export function normalizeTransactionsForDisplay(transactions: TransactionItem[] = []): DisplayTransactionItem[] {
  const sorted = [...transactions].sort((left, right) => getTransactionTime(right) - getTransactionTime(left));
  const expensesByKey = new Map<string, TransactionItem[]>();

  sorted.forEach((transaction) => {
    if (!isExpenseTransaction(transaction)) return;
    const key = duplicateSpendKey(transaction);
    const existing = expensesByKey.get(key) ?? [];
    existing.push(transaction);
    expensesByKey.set(key, existing);
  });

  const skippedWalletIds = new Set<string>();
  const combinedExpenseById = new Map<string, DisplayTransactionItem>();

  sorted.forEach((transaction) => {
    if (!isWalletDebitTransaction(transaction)) return;
    const key = duplicateSpendKey(transaction);
    const expense = expensesByKey.get(key)?.find((item) => !combinedExpenseById.has(item.id));
    if (!expense) return;
    skippedWalletIds.add(transaction.id);
    combinedExpenseById.set(expense.id, combineExpenseWithWalletDebit(expense, transaction));
  });

  return sorted
    .filter((transaction) => !skippedWalletIds.has(transaction.id))
    .map((transaction) => combinedExpenseById.get(transaction.id) ?? transaction);
}

export function getTransactionDisplayAmount(transaction: DisplayTransactionItem | TransactionItem) {
  return Number((transaction as DisplayTransactionItem).displayAmount ?? transaction.amount ?? 0);
}

export function getSpendTransactions(transactions: TransactionItem[] = []) {
  return normalizeTransactionsForDisplay(transactions).filter((transaction) => {
    if (isCreditLikeTransaction(transaction)) return false;
    return getTransactionDisplayAmount(transaction) < 0;
  });
}
