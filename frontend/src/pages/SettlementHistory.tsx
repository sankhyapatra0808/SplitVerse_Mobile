import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, ReceiptText } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import DashboardLayout from "./dashboard/DashboardLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAppSettings } from "../context/useAppSettings";
import {
  getNetSettlementHistory,
  type SettlementHistoryResponse,
} from "../lib/api";
import "../styles/SettlementHistory.css";

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function SettlementHistory() {
  const navigate = useNavigate();
  const params = useParams<{ otherUserId: string }>();
  const [searchParams] = useSearchParams();
  const { formatCurrency } = useAppSettings();
  const [data, setData] = useState<SettlementHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const direction = searchParams.get("direction") === "receivable" ? "receivable" : "payable";
  const roomId = searchParams.get("roomId") || "";

  const loadHistory = useCallback(async () => {
    if (!params.otherUserId) {
      setError("Settlement user is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setData(await getNetSettlementHistory(params.otherUserId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load settlement history.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.otherUserId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const groupedEntries = useMemo(() => {
    if (!data) return [];

    const groups = new Map<string, typeof data.entries>();
    for (const entry of data.entries) {
      const existing = groups.get(entry.roomId) ?? [];
      existing.push(entry);
      groups.set(entry.roomId, existing);
    }

    return Array.from(groups.entries()).map(([roomIdValue, entries]) => ({
      roomId: roomIdValue,
      roomName: entries[0]?.roomName || "Split room",
      entries,
    }));
  }, [data]);

  function goBack() {
    const query = roomId ? `?roomId=${encodeURIComponent(roomId)}` : "";
    navigate(`/settlements/${direction}${query}`);
  }

  return (
    <DashboardLayout eyebrow="Settlement history">
      <section className="settlement-history-page">
        <header className="settlement-history-heading">
          <button type="button" onClick={goBack}>
            <ArrowLeft size={18} />
            Settlements
          </button>
          <div>
            <span>Full settlement</span>
            <h2>{data?.person.name || data?.person.email || "Settlement history"}</h2>
            <p>Every shared-room item and settlement between you and this friend.</p>
          </div>
          <button type="button" onClick={() => void loadHistory()} disabled={loading}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </header>

        {loading && (
          <article className="bento-card settlement-history-state">
            <LoadingSkeleton wide />
            <LoadingSkeleton wide />
          </article>
        )}

        {!loading && error && <article className="bento-card page-alert error">{error}</article>}

        {!loading && !error && data && (
          <>
            <article className="settlement-history-summary bento-card">
              <div><span>All-time payable</span><strong>{formatCurrency(data.summary.lifetimePayable)}</strong></div>
              <div><span>All-time receivable</span><strong>{formatCurrency(data.summary.lifetimeReceivable)}</strong></div>
              <div><span>Pending payable</span><strong>{formatCurrency(data.summary.pendingPayable)}</strong></div>
              <div><span>Pending receivable</span><strong>{formatCurrency(data.summary.pendingReceivable)}</strong></div>
            </article>

            {groupedEntries.length === 0 ? (
              <article className="bento-card settlement-history-state">
                <ReceiptText size={24} />
                <h3>No settlement history yet</h3>
              </article>
            ) : (
              <div className="settlement-history-groups">
                {groupedEntries.map((group) => (
                  <article className="bento-card settlement-history-room" key={group.roomId}>
                    <header>
                      <span>Room</span>
                      <h3>{group.roomName}</h3>
                    </header>

                    <div className="settlement-history-entry-list">
                      {group.entries.map((entry) => (
                        <div className="settlement-history-entry" key={entry.itemId}>
                          <div className="settlement-history-entry-head">
                            <div>
                              <span className={`settlement-history-direction ${entry.direction}`}>
                                {entry.direction === "payable" ? "You pay" : "You receive"}
                              </span>
                              <strong>{entry.title}</strong>
                              <span className="settlement-history-paid-by">
                                Paid by {entry.creditorName || entry.creditorEmail}
                              </span>
                              <small>
                                {formatHistoryDate(entry.createdAt)} · {entry.status === "settled" ? "Settled" : "Pending"}
                              </small>
                            </div>
                            <strong>{formatCurrency(entry.originalAmount)}</strong>
                          </div>

                          <dl>
                            <div><dt>Original</dt><dd>{formatCurrency(entry.originalAmount)}</dd></div>
                            <div><dt>Settled</dt><dd>{formatCurrency(entry.settledAmount)}</dd></div>
                            <div><dt>Pending</dt><dd>{formatCurrency(entry.pendingAmount)}</dd></div>
                          </dl>

                          {entry.settlements.length > 0 && (
                            <div className="settlement-history-events">
                              {entry.settlements.map((event) => (
                                <div key={event.id}>
                                  <div>
                                    <strong>
                                      {event.method === "manual"
                                        ? "Manual collection"
                                        : event.method === "wallet"
                                          ? "Wallet settlement"
                                          : event.counterItemTitle
                                            ? `Deducted against ${event.counterItemTitle}`
                                            : "Adjusted against opposite due"}
                                    </strong>
                                    {event.counterRoomName && <span>{event.counterRoomName}</span>}
                                    <small>{formatHistoryDate(event.createdAt)}</small>
                                  </div>
                                  <em>− {formatCurrency(event.amount)}</em>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </DashboardLayout>
  );
}
