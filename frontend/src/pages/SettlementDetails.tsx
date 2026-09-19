import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Calculator,
  CheckCircle2,
  History,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import DashboardLayout from "./dashboard/DashboardLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAppSettings } from "../context/useAppSettings";
import {
  collectNetSettlement,
  getNetSettlements,
  remindNetSettlement,
  type NetSettlement,
} from "../lib/api";
import "../styles/SettlementDetails.css";

type SettlementDirection = "payable" | "receivable";

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export default function SettlementDetails() {
  const navigate = useNavigate();
  const params = useParams<{ direction: string }>();
  const [searchParams] = useSearchParams();
  const direction: SettlementDirection =
    params.direction === "receivable" ? "receivable" : "payable";
  const roomId = searchParams.get("roomId") || "";
  const { formatCurrency } = useAppSettings();
  const [settlements, setSettlements] = useState<NetSettlement[]>([]);
  const [loadedDirection, setLoadedDirection] = useState<SettlementDirection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remindingUserId, setRemindingUserId] = useState("");
  const [collectingUserId, setCollectingUserId] = useState("");
  const requestIdRef = useRef(0);

  const loadSettlements = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError("");
      setSettlements([]);
      setLoadedDirection(null);
      const response = await getNetSettlements();

      if (requestId !== requestIdRef.current) return;

      setSettlements(
        response.settlements.filter((settlement) =>
          direction === "payable" ? settlement.isOutgoing : settlement.isIncoming,
        ),
      );
      setLoadedDirection(direction);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load adjusted settlements.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const visibleSettlements = useMemo(
    () => (loadedDirection === direction ? settlements : []),
    [direction, loadedDirection, settlements],
  );

  const finalTotal = useMemo(
    () => roundMoney(visibleSettlements.reduce((sum, settlement) => sum + settlement.amount, 0)),
    [visibleSettlements],
  );

  function emitSettlementUpdate() {
    window.dispatchEvent(
      new CustomEvent("splitverse:data-updated", {
        detail: { source: "settlement-details" },
      }),
    );
    window.dispatchEvent(new Event("splitverse:pending-dues-updated"));
  }

  async function handleRemind(settlement: NetSettlement) {
    if (!settlement.isIncoming) return;

    try {
      setMessage("");
      setError("");
      setRemindingUserId(settlement.fromUserId);
      const response = await remindNetSettlement(settlement.fromUserId);
      setMessage(response.message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not send reminder.");
    } finally {
      setRemindingUserId("");
    }
  }

  async function handleManualCollect(settlement: NetSettlement) {
    if (!settlement.isIncoming) return;

    const person = settlement.fromName || settlement.fromEmail;
    if (!window.confirm(`Mark ${formatCurrency(settlement.amount)} from ${person} as collected?`)) {
      return;
    }

    try {
      setMessage("");
      setError("");
      setCollectingUserId(settlement.fromUserId);
      const response = await collectNetSettlement(settlement.fromUserId);
      setMessage(response.message);
      emitSettlementUpdate();
      await loadSettlements();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not mark this settlement as collected.",
      );
    } finally {
      setCollectingUserId("");
    }
  }

  function goBackToRoom() {
    navigate(roomId ? `/split-rooms?roomId=${encodeURIComponent(roomId)}` : "/split-rooms");
  }

  return (
    <DashboardLayout eyebrow="Adjusted settlements">
      <section className="settlement-details-page">
        <header className="settlement-details-heading">
          <button type="button" onClick={goBackToRoom}>
            <ArrowLeft size={18} />
            Rooms
          </button>
          <div>
            <span>{direction === "payable" ? "You pay" : "You receive"}</span>
            <h2>{direction === "payable" ? "Payable details" : "Receivable details"}</h2>
            <p>
              Every room item, deduction, and remaining amount used to calculate
              your final {direction} total.
            </p>
          </div>
          <button type="button" onClick={() => void loadSettlements()} disabled={loading}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </header>

        {message && <article className="bento-card page-alert">{message}</article>}
        {error && !loading && <article className="bento-card page-alert error">{error}</article>}

        <article className={`settlement-total-card ${direction}`}>
          <div>
            <span>Final {direction}</span>
            <strong>{loading || loadedDirection !== direction ? "—" : formatCurrency(finalTotal)}</strong>
            <small>After opposite dues and completed payments are deducted</small>
          </div>
          <WalletCards size={28} />
        </article>

        {loading && (
          <article className="bento-card settlement-state-card">
            <LoadingSkeleton wide />
            <LoadingSkeleton wide />
          </article>
        )}

        {!loading && !error && visibleSettlements.length === 0 && (
          <article className="bento-card settlement-state-card">
            <Calculator size={24} />
            <h3>No {direction} settlements</h3>
            <p>There is no final {direction} amount after adjustment.</p>
          </article>
        )}

        {!loading && (
          <div className="settlement-person-list">
            {visibleSettlements.map((settlement) => {
              const currentUserId = settlement.isOutgoing
                ? settlement.fromUserId
                : settlement.toUserId;
              const otherUserId = settlement.isOutgoing
                ? settlement.toUserId
                : settlement.fromUserId;
              const counterparty = settlement.isOutgoing
                ? settlement.toName || settlement.toEmail
                : settlement.fromName || settlement.fromEmail;
              const youOwe = roundMoney(
                settlement.breakdown.reduce(
                  (sum, line) => sum + (line.debtorUserId === currentUserId ? line.amount : 0),
                  0,
                ),
              );
              const theyOwe = roundMoney(
                settlement.breakdown.reduce(
                  (sum, line) => sum + (line.creditorUserId === currentUserId ? line.amount : 0),
                  0,
                ),
              );
              const historyQuery = new URLSearchParams({ direction });
              if (roomId) historyQuery.set("roomId", roomId);

              return (
                <article
                  className="bento-card settlement-person-card"
                  key={`${settlement.fromUserId}-${settlement.toUserId}`}
                >
                  <div className="settlement-person-head">
                    <div>
                      <span>{settlement.isOutgoing ? "You pay" : "Pays you"}</span>
                      <h3>{counterparty}</h3>
                      <small>
                        {settlement.breakdown.length} room item
                        {settlement.breakdown.length === 1 ? "" : "s"} included
                      </small>
                    </div>
                    <strong>{formatCurrency(settlement.amount)}</strong>
                  </div>

                  <div className="settlement-formula" aria-label="Settlement calculation">
                    <div><span>You owe</span><strong>{formatCurrency(youOwe)}</strong></div>
                    <b>−</b>
                    <div><span>They owe you</span><strong>{formatCurrency(theyOwe)}</strong></div>
                    <b>=</b>
                    <div className="final"><span>Final amount</span><strong>{formatCurrency(settlement.amount)}</strong></div>
                  </div>

                  <div className="settlement-breakdown-list">
                    {settlement.breakdown.map((line) => (
                      <div className="settlement-breakdown-row" key={`${line.itemId}-${line.direction}`}>
                        <div>
                          <strong>{line.title}</strong>
                          <span>{line.roomName}</span>
                          <small>{line.direction}</small>
                          {line.offsetAdjustments?.map((adjustment, index) => (
                            <small className="settlement-offset-detail" key={`${line.itemId}-offset-${index}`}>
                              {adjustment.title
                                ? `Deducted against ${adjustment.title}`
                                : "Deducted against opposite due"}
                              {adjustment.amount > 0 ? ` · ${formatCurrency(adjustment.amount)}` : ""}
                            </small>
                          ))}
                        </div>
                        <dl>
                          <div><dt>Original</dt><dd>{formatCurrency(line.originalAmount)}</dd></div>
                          <div><dt>Deducted / settled</dt><dd>− {formatCurrency(line.settledAmount)}</dd></div>
                          <div><dt>Remaining</dt><dd>{formatCurrency(line.amount)}</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>

                  <div className="settlement-person-actions">
                    <button
                      className="dashboard-secondary-button"
                      type="button"
                      onClick={() => navigate(`/settlements/history/${otherUserId}?${historyQuery.toString()}`)}
                    >
                      <History size={15} />
                      See full settlement
                    </button>

                    {settlement.isIncoming && (
                      <>
                        <button
                          className="dashboard-secondary-button"
                          type="button"
                          onClick={() => void handleRemind(settlement)}
                          disabled={remindingUserId === settlement.fromUserId || collectingUserId === settlement.fromUserId}
                        >
                          <Bell size={15} />
                          {remindingUserId === settlement.fromUserId ? "Sending" : "Remind"}
                        </button>
                        <button
                          className="dashboard-primary-button"
                          type="button"
                          onClick={() => void handleManualCollect(settlement)}
                          disabled={collectingUserId === settlement.fromUserId || remindingUserId === settlement.fromUserId}
                        >
                          <CheckCircle2 size={15} />
                          {collectingUserId === settlement.fromUserId ? "Collecting" : "Manual collect"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
