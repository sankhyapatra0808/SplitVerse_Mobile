import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, RefreshCw, WalletCards } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "./dashboard/DashboardLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAppSettings } from "../context/useAppSettings";
import { getNetSettlements, type NetSettlement } from "../lib/api";
import "../styles/SettlementDetails.css";

type SettlementDirection = "payable" | "receivable";

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export default function SettlementDetails() {
  const navigate = useNavigate();
  const params = useParams<{ direction: string }>();
  const direction: SettlementDirection =
    params.direction === "receivable" ? "receivable" : "payable";
  const { formatCurrency } = useAppSettings();
  const [settlements, setSettlements] = useState<NetSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSettlements = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getNetSettlements();
      setSettlements(
        response.settlements.filter((settlement) =>
          direction ? (direction === "payable" ? settlement.isOutgoing : settlement.isIncoming) : false,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load adjusted settlements.",
      );
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettlements(), 0);

    return () => window.clearTimeout(timer);
  }, [loadSettlements]);

  const finalTotal = useMemo(
    () => roundMoney(settlements.reduce((sum, settlement) => sum + settlement.amount, 0)),
    [settlements],
  );

  return (
    <DashboardLayout eyebrow="Adjusted settlements">
      <section className="settlement-details-page">
        <header className="settlement-details-heading">
          <button type="button" onClick={() => navigate("/split-rooms")}>
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

        <article className={`settlement-total-card ${direction}`}>
          <div>
            <span>Final {direction}</span>
            <strong>{formatCurrency(finalTotal)}</strong>
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

        {!loading && error && (
          <article className="bento-card page-alert error">{error}</article>
        )}

        {!loading && !error && settlements.length === 0 && (
          <article className="bento-card settlement-state-card">
            <Calculator size={24} />
            <h3>No {direction} settlements</h3>
            <p>There is no final {direction} amount after adjustment.</p>
          </article>
        )}

        <div className="settlement-person-list">
          {settlements.map((settlement) => {
            const currentUserId = settlement.isOutgoing
              ? settlement.fromUserId
              : settlement.toUserId;
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
                      </div>
                      <dl>
                        <div><dt>Original</dt><dd>{formatCurrency(line.originalAmount)}</dd></div>
                        <div><dt>Deducted / settled</dt><dd>− {formatCurrency(line.settledAmount)}</dd></div>
                        <div><dt>Remaining</dt><dd>{formatCurrency(line.amount)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </DashboardLayout>
  );
}
