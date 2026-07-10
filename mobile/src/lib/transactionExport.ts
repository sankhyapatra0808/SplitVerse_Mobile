import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { TransactionItem } from "./api";
import { getTransactionDisplayAmount } from "./transactionDisplay";

export type TransactionExportFormat = "csv" | "pdf";

type ExportTransactionOptions = {
  transactions: TransactionItem[];
  format: TransactionExportFormat;
  formatCurrency: (value: number, options?: { signed?: boolean; compact?: boolean }) => string;
  formatDate: (value?: string | null) => string;
  title?: string;
};

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function getTransactionTitle(transaction: TransactionItem) {
  return (
    transaction.description ||
    transaction.title ||
    transaction.roomName ||
    transaction.counterpartyName ||
    transaction.counterpartyEmail ||
    transaction.type ||
    "Transaction"
  );
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDateValue(transaction: TransactionItem) {
  return transaction.createdAt || transaction.displayDate || "";
}

function buildCsv(options: ExportTransactionOptions) {
  const headers = ["Date", "Title", "Type", "Status", "Amount", "Room", "Counterparty"];
  const rows = options.transactions.map((transaction) => {
    const amount = getTransactionDisplayAmount(transaction);
    return [
      options.formatDate(getDateValue(transaction)),
      getTransactionTitle(transaction),
      transaction.type || "",
      transaction.displayStatus || transaction.status || "completed",
      options.formatCurrency(amount, { signed: true }),
      transaction.roomName || "",
      transaction.counterpartyName || transaction.counterpartyEmail || "",
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildPdfHtml(options: ExportTransactionOptions) {
  const exportedAt = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const rows = options.transactions
    .map((transaction) => {
      const amount = getTransactionDisplayAmount(transaction);
      return `
        <tr>
          <td>${htmlEscape(options.formatDate(getDateValue(transaction)))}</td>
          <td>${htmlEscape(getTransactionTitle(transaction))}</td>
          <td>${htmlEscape(transaction.type || "")}</td>
          <td>${htmlEscape(transaction.displayStatus || transaction.status || "completed")}</td>
          <td class="amount">${htmlEscape(options.formatCurrency(amount, { signed: true }))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 28px; color: #111827; }
          h1 { margin: 0; font-size: 24px; }
          p { margin: 6px 0 18px; color: #6b7280; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; background: #f3f4f6; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
          .amount { text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${htmlEscape(options.title || "SplitVerse transaction export")}</h1>
        <p>Exported ${htmlEscape(exportedAt)} · ${options.transactions.length} record${options.transactions.length === 1 ? "" : "s"}</p>
        <table>
          <thead>
            <tr><th>Date</th><th>Title</th><th>Type</th><th>Status</th><th>Amount</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5">No transactions found.</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `;
}

export async function exportTransactionsFile(options: ExportTransactionOptions) {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error("Sharing is not available on this device.");
  }

  const datePart = safeFilePart(new Date().toISOString().slice(0, 19));
  const titlePart = safeFilePart(options.title || "splitverse-transactions");

  if (options.format === "pdf") {
    const html = buildPdfHtml(options);
    const file = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Export SplitVerse transactions",
      UTI: "com.adobe.pdf",
    });
    return file.uri;
  }

  const csv = buildCsv(options);
  const uri = `${FileSystem.cacheDirectory}${titlePart}-${datePart}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: "Export SplitVerse transactions",
    UTI: "public.comma-separated-values-text",
  });
  return uri;
}
