import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  DoorOpen,
  Flag,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Undo2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import DashboardLayout from "../dashboard/DashboardLayout";
import Dropdown from "../../components/Dropdown";
import {
  getAdminAnalytics,
  getAdminAudit,
  getAdminAuditLogs,
  getAdminConfig,
  getAdminFeatureFlags,
  getAdminFinancialActivity,
  getAdminOverview,
  getAdminRoom,
  getAdminRooms,
  getAdminSecurity,
  getAdminSettlementDebugger,
  getAdminUser,
  getAdminUsers,
  reverseAdminSettlement,
  updateAdminConfig,
  updateAdminFeatureFlag,
  updateAdminUserSecurityStatus,
} from "../../lib/api";
import "../../styles/AdminPortal.css";

const PAGE_SIZE = 25;
const FEED_PAGE_SIZE = 30;

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function shortDate(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function AdminFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <DashboardLayout eyebrow="Admin Portal">
      <section className="admin-page">
        <header className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-eyebrow">SplitVerse Admin</span>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </header>
        {children}
      </section>
    </DashboardLayout>
  );
}

function Loading({ label = "Loading live SplitVerse data…" }: { label?: string }) {
  return (
    <div className="admin-state admin-loading" role="status">
      <span className="admin-loading-dot" />
      {label}
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return (
    <div className="admin-state error" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Couldn’t load this admin view</strong>
        <span>{error}</span>
      </div>
    </div>
  );
}

function Empty({ text = "No records found." }: { text?: string }) {
  return (
    <div className="admin-state admin-empty">
      <Database size={19} />
      <span>{text}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-top">
        <span>{label}</span>
        {icon ? <i>{icon}</i> : null}
      </div>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-section-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function AdminActionDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmTone = "primary",
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "primary" | "danger" | "warning";
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <div className="admin-dialog-head">
          <div>
            <span className="admin-eyebrow">Confirmation required</span>
            <h3 id="admin-dialog-title">{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        {children ? <div className="admin-dialog-context">{children}</div> : null}
        <label className="admin-dialog-reason">
          <span>Reason</span>
          <textarea
            autoFocus
            rows={4}
            maxLength={500}
            placeholder="Explain why this administrative action is necessary"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <small>{reason.trim().length}/500 · stored in the audit log</small>
        </label>
        <div className="admin-dialog-actions">
          <button className="admin-button secondary" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className={`admin-button ${confirmTone}`} disabled={busy || reason.trim().length < 3} onClick={onConfirm}>{busy ? "Applying…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="admin-search-wrap">
      <Search size={17} aria-hidden="true" />
      <input
        className="admin-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warning" | "danger" | "primary" }) {
  return <span className={`admin-status-pill ${tone}`}>{children}</span>;
}

function Pager({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}) {
  const max = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pager">
      <span>
        Page <strong>{page}</strong> of <strong>{max}</strong>
      </span>
      <div>
        <button className="admin-button secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="admin-button secondary" disabled={page >= max} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load overview"));
  }, []);

  if (error) return <AdminFrame title="Overview"><ErrorBox error={error} /></AdminFrame>;
  if (!data) return <AdminFrame title="Overview"><Loading /></AdminFrame>;

  return (
    <AdminFrame
      title="Overview"
      subtitle="A live operational view of SplitVerse users, rooms, tracked expenses, and recorded settlements."
    >
      <div className="admin-metric-grid">
        <MetricCard label="Total users" value={valueText(data.users?.total)} note={`${valueText(data.users?.today)} joined today`} icon={<Users size={17} />} />
        <MetricCard label="Rooms" value={valueText(data.rooms?.total)} note={`${valueText(data.rooms?.active)} currently active`} icon={<DoorOpen size={17} />} />
        <MetricCard label="Tracked expenses" value={valueText(data.expenses?.count)} note={`${money(data.expenses?.value)} tracked`} icon={<CircleDollarSign size={17} />} />
        <MetricCard label="Settlement records" value={valueText(data.settlements?.count)} note={`${money(data.settlements?.recorded_amount)} recorded`} icon={<CheckCircle2 size={17} />} />
      </div>

      <Section title="Admin workspace guide" description="What each part of the control center is designed to answer.">
        <div className="admin-guide-grid">
          {[
            ["Users", "Investigate an account, review security state, restrict or block access, and inspect recent rooms and settlements."],
            ["Rooms", "See who is in a room, what was tracked, who paid, and which settlement records changed the outstanding balance."],
            ["Settlement Debugger", "Explain why a user currently owes or receives an exact amount using the canonical SplitVerse settlement logic."],
            ["Financial Activity", "Review recorded expenses, settlement entries, wallet activity, and administrator-created reversals."],
            ["Audit & Integrity", "Trace recorded administrative and financial integrity events without reconstructing history that was never logged."],
            ["Analytics", "Inspect real 30-day account, room, expense, and settlement aggregates."],
            ["Feature Flags", "Control server-backed product switches without exposing or weakening security secrets."],
            ["App Versions", "Manage Android latest/minimum versions, force-update behavior, release notes, and update URLs."],
            ["Configuration", "Change approved runtime configuration with an audit reason; secrets remain environment-only."],
            ["Security", "Review blocked/restricted accounts, installation-based ban-evasion signals, and recent security actions."],
            ["Admin Audit Logs", "See the append-only record of meaningful administrator mutations and the reasons behind them."],
          ].map(([name, description]) => (
            <article className="admin-guide-card" key={name}><strong>{name}</strong><p>{description}</p></article>
          ))}
        </div>
      </Section>

      <Section title="Recent activity" description="Newest events already represented by the current SplitVerse data model.">
        {data.recentActivity?.length ? (
          <div className="admin-timeline">
            {data.recentActivity.map((item: any) => (
              <div className="admin-timeline-row" key={`${item.type}-${item.id}`}>
                <span className="admin-timeline-dot" />
                <div>
                  <strong>{item.label}</strong>
                  <span>{humanize(item.type)} · {date(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </Section>
    </AdminFrame>
  );
}

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    const timeout = setTimeout(() => {
      getAdminUsers(search, page)
        .then(setData)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load users"));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, page]);

  return (
    <AdminFrame title="Users" subtitle="Search real SplitVerse accounts. Passwords, wallet PIN values, hashes, and tokens are never returned.">
      <div className="admin-toolbar">
        <SearchBox
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search name, username, email, or account ID"
        />
        {data ? <StatusPill>{data.total} accounts</StatusPill> : null}
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : data.users.length === 0 ? (
        <Empty text="No users found matching these filters." />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Username</th><th>Status</th><th>Joined</th><th>Rooms</th><th>Friends</th><th>Wallet PIN</th><th /></tr></thead>
              <tbody>
                {data.users.map((user: any) => (
                  <tr key={user.id}>
                    <td><strong>{user.name || user.email}</strong><small>{user.email}</small></td>
                    <td>{user.username ? `@${user.username}` : "—"}</td>
                    <td><StatusPill tone={user.account_status === "blocked" ? "danger" : user.account_status === "restricted" ? "warning" : "good"}>{humanize(user.account_status || "active")}</StatusPill></td>
                    <td>{date(user.created_at)}</td>
                    <td>{user.room_count}</td>
                    <td>{user.friend_count}</td>
                    <td><StatusPill tone={user.has_wallet_pin ? "good" : "neutral"}>{user.has_wallet_pin ? "Configured" : "Not configured"}</StatusPill></td>
                    <td className="admin-table-action"><Link to={`/admin/users/${user.id}`} aria-label={`Open ${user.name || user.email}`}><ArrowRight size={17} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={data.total} onPage={setPage} />
        </>
      )}
    </AdminFrame>
  );
}

export function AdminUserDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [securityAction, setSecurityAction] = useState<"active" | "restricted" | "blocked" | null>(null);
  const [settlementAction, setSettlementAction] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await getAdminUser(id);
    setData(next);
  };

  useEffect(() => {
    load().catch((reasonValue) => setError(reasonValue instanceof Error ? reasonValue.message : "Failed to load user"));
  }, [id]);

  async function applySecurityStatus() {
    if (!securityAction || reason.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      await updateAdminUserSecurityStatus(id, securityAction, reason.trim());
      setSecurityAction(null);
      setReason("");
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Could not update account security status");
    } finally {
      setBusy(false);
    }
  }

  async function reverseSettlement() {
    if (!settlementAction || reason.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      const refundMode = settlementAction.method === "wallet" ? "wallet_refund" : "external_refund";
      await reverseAdminSettlement(settlementAction.id, refundMode, reason.trim());
      setSettlementAction(null);
      setReason("");
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Could not reverse settlement");
    } finally {
      setBusy(false);
    }
  }

  const status = data?.user?.account_status || "active";
  const statusTone = status === "blocked" ? "danger" : status === "restricted" ? "warning" : "good";

  return (
    <AdminFrame title="User Details" subtitle="Account activity, security state, known installations, and auditable financial corrections.">
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : (
        <>
          <Section
            title={data.user.name || data.user.email}
            description={data.user.email}
            action={<StatusPill tone={statusTone}>{humanize(status)}</StatusPill>}
          >
            <div className="admin-detail-grid">
              {Object.entries({
                Name: data.user.name,
                Username: data.user.username ? `@${data.user.username}` : "—",
                Email: data.user.email,
                "Account ID": data.user.id,
                Provider: data.user.provider,
                Created: date(data.user.created_at),
                "Wallet PIN configured": data.user.has_wallet_pin ? "Yes" : "No",
                "Wallet PIN last changed": date(data.user.wallet_pin_updated_at),
              }).map(([key, value]) => (
                <div className="admin-field" key={key}><span>{key}</span><strong>{valueText(value)}</strong></div>
              ))}
            </div>
          </Section>

          <Section
            title="Account control"
            description="Restrictions are enforced by the backend. Blocking also restricts known SplitVerse installations so a new account from the same installation is placed into admin review."
            action={<StatusPill tone={statusTone}>{humanize(status)}</StatusPill>}
          >
            <div className="admin-security-control">
              <div>
                <strong>Current security state</strong>
                <p>{data.user.security_reason || "No administrative restriction is currently recorded."}</p>
                {data.user.security_updated_at ? <small>Updated {date(data.user.security_updated_at)}{data.user.security_updated_by_email ? ` by ${data.user.security_updated_by_email}` : ""}</small> : null}
              </div>
              <div className="admin-action-row">
                {status === "active" ? <button className="admin-button warning" onClick={() => { setReason(""); setSecurityAction("restricted"); }}><ShieldAlert size={16} /> Restrict account</button> : null}
                {status !== "blocked" ? <button className="admin-button danger" onClick={() => { setReason(""); setSecurityAction("blocked"); }}><Ban size={16} /> Block account</button> : null}
                {status !== "active" ? <button className="admin-button secondary" onClick={() => { setReason(""); setSecurityAction("active"); }}><UserRoundCheck size={16} /> Restore account</button> : null}
              </div>
            </div>
          </Section>

          <div className="admin-metric-grid compact">
            {Object.entries(data.stats || {}).map(([key, value]) => (
              <MetricCard key={key} label={humanize(key)} value={String(value)} />
            ))}
            <MetricCard label="Known installations" value={String(data.installations?.length || 0)} note={`${data.installations?.filter((item: any) => item.restricted).length || 0} restricted`} />
          </div>

          <Section title="Known installations" description="Random SplitVerse installation identifiers are hashed server-side. They are a fraud signal, not proof that two accounts belong to the same human.">
            {data.installations?.length ? (
              <div className="admin-list">
                {data.installations.map((installation: any, index: number) => (
                  <div className="admin-list-row" key={`${installation.platform}-${installation.first_seen_at}-${index}`}>
                    <span className="admin-feed-icon"><Smartphone size={17} /></span>
                    <div><strong>{humanize(installation.platform || "unknown")}</strong><span>First seen {date(installation.first_seen_at)} · Last seen {date(installation.last_seen_at)}</span></div>
                    <StatusPill tone={installation.restricted ? "danger" : "good"}>{installation.restricted ? "Restricted" : "Normal"}</StatusPill>
                  </div>
                ))}
              </div>
            ) : <Empty text="No installation signal has been recorded for this account yet." />}
          </Section>

          <Section title="Recent rooms" description="Most recent rooms this account created or joined.">
            {data.rooms?.length ? (
              <div className="admin-list">
                {data.rooms.map((room: any) => (
                  <Link className="admin-list-row linked" to={`/admin/rooms/${room.id}`} key={room.id}>
                    <div><strong>{room.name}</strong><span>{humanize(room.role)} · {date(room.created_at)}</span></div>
                    <ArrowRight size={17} />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No rooms found for this user." />}
          </Section>

          <Section title="Recent settlement records" description="Wallet and manually recorded settlement entries involving this account. A reversal never deletes the original record.">
            {data.settlements?.length ? (
              <div className="admin-list">
                {data.settlements.map((settlement: any) => (
                  <div className="admin-list-row admin-settlement-row" key={settlement.id}>
                    <span className="admin-feed-icon"><CircleDollarSign size={17} /></span>
                    <div>
                      <strong>{settlement.payer_name || settlement.payer_email} → {settlement.receiver_name || settlement.receiver_email} · {money(settlement.amount)}</strong>
                      <span>{settlement.room_name} · {settlement.item_title} · {humanize(settlement.method)} · {date(settlement.created_at)}</span>
                      {settlement.reversal_id ? <small>Reversed {date(settlement.reversed_at)} · {humanize(settlement.reversal_refund_mode || "refund")}</small> : null}
                    </div>
                    {settlement.reversal_id ? (
                      <StatusPill tone="neutral">Reversed</StatusPill>
                    ) : (
                      <button className="admin-button secondary compact" onClick={() => { setReason(""); setSettlementAction(settlement); }}><Undo2 size={15} /> Reverse / refund</button>
                    )}
                  </div>
                ))}
              </div>
            ) : <Empty text="No reversible wallet or manual settlement records were found for this account." />}
          </Section>

          {data.securityEvents?.length ? (
            <Section title="Security signals" description="Recent account-security events and installation-based review signals.">
              <div className="admin-list">
                {data.securityEvents.map((event: any, index: number) => (
                  <div className="admin-list-row" key={`${event.event_type}-${event.created_at}-${index}`}>
                    <span className="admin-feed-icon"><ShieldAlert size={17} /></span>
                    <div><strong>{humanize(event.event_type)}</strong><span>{date(event.created_at)}</span></div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}

      <AdminActionDialog
        open={Boolean(securityAction)}
        title={securityAction === "blocked" ? "Block this account" : securityAction === "restricted" ? "Restrict this account" : "Restore this account"}
        description={securityAction === "blocked"
          ? "The user will lose normal API access immediately. Known installations will be marked restricted, and new accounts seen on those installations will be placed into review."
          : securityAction === "restricted"
            ? "The account remains readable but protected write actions are denied while it is under review."
            : "Normal account access will be restored. An installation remains restricted if it is still linked to another blocked account."}
        confirmLabel={securityAction === "blocked" ? "Block account" : securityAction === "restricted" ? "Restrict account" : "Restore account"}
        confirmTone={securityAction === "blocked" ? "danger" : securityAction === "restricted" ? "warning" : "primary"}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => { if (!busy) { setSecurityAction(null); setReason(""); } }}
        onConfirm={applySecurityStatus}
        busy={busy}
      >
        <div><strong>{data?.user?.email}</strong><span> · current state: {humanize(status)}</span></div>
      </AdminActionDialog>

      <AdminActionDialog
        open={Boolean(settlementAction)}
        title={settlementAction?.method === "wallet" ? "Refund and reverse settlement" : "Record external refund and reverse settlement"}
        description={settlementAction?.method === "wallet"
          ? "SplitVerse will debit the receiver's wallet, credit the original payer, and create a negative reversal entry so the canonical outstanding balance is restored."
          : "Use this only after the receiver has actually returned the money outside SplitVerse. The original manual settlement remains visible and an audited reversal restores the outstanding balance."}
        confirmLabel={settlementAction?.method === "wallet" ? "Refund & reverse" : "Record refund & reverse"}
        confirmTone="warning"
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => { if (!busy) { setSettlementAction(null); setReason(""); } }}
        onConfirm={reverseSettlement}
        busy={busy}
      >
        {settlementAction ? <div><strong>{settlementAction.payer_name || settlementAction.payer_email} → {settlementAction.receiver_name || settlementAction.receiver_email}</strong><span> · {money(settlementAction.amount)} · {settlementAction.room_name}</span></div> : null}
      </AdminActionDialog>
    </AdminFrame>
  );
}

export function AdminRooms() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    const timeout = setTimeout(() => {
      getAdminRooms(search, page)
        .then(setData)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load rooms"));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, page]);

  return (
    <AdminFrame title="Rooms" subtitle="Inspect membership, tracked items, outstanding amounts, and settlement records without changing room logic.">
      <div className="admin-toolbar">
        <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search room, member, owner, or room ID" />
        {data ? <StatusPill>{data.total} rooms</StatusPill> : null}
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : data.rooms.length === 0 ? <Empty text="No rooms found." /> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Room</th><th>Creator</th><th>Members</th><th>Items</th><th>Tracked</th><th>Outstanding</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.rooms.map((room: any) => (
                  <tr key={room.id}>
                    <td><strong>{room.name}</strong><small>{date(room.created_at)}</small></td>
                    <td>{room.owner_name || room.owner_email}</td>
                    <td>{room.member_count}</td>
                    <td>{room.item_count}</td>
                    <td>{money(room.tracked_amount)}</td>
                    <td>{money(room.outstanding_amount)}</td>
                    <td><StatusPill tone={room.archived_at ? "neutral" : room.payment_status === "settled" ? "good" : "warning"}>{room.archived_at ? "Archived" : humanize(room.payment_status || "Active")}</StatusPill></td>
                    <td className="admin-table-action"><Link to={`/admin/rooms/${room.id}`}><ArrowRight size={17} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={data.total} onPage={setPage} />
        </>
      )}
    </AdminFrame>
  );
}

export function AdminRoomDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminRoom(id).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load room"));
  }, [id]);

  if (error) return <AdminFrame title="Room detail"><ErrorBox error={error} /></AdminFrame>;
  if (!data) return <AdminFrame title="Room detail"><Loading /></AdminFrame>;

  const tracked = data.items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const pending = data.items.reduce((sum: number, item: any) => sum + Number(item.pending_amount || 0), 0);

  return (
    <AdminFrame title={data.room.name} subtitle={`Room ID: ${data.room.id}`}>
      <div className="admin-metric-grid compact">
        <MetricCard label="Members" value={data.members.length} />
        <MetricCard label="Tracked items" value={data.items.length} />
        <MetricCard label="Tracked value" value={money(tracked)} />
        <MetricCard label="Outstanding" value={money(pending)} />
      </div>

      <Section title="Members" description="People represented in the room membership table.">
        <div className="admin-list">
          {data.members.map((member: any) => (
            <div className="admin-list-row" key={member.id}>
              <div><strong>{member.name || member.display_name || member.email}</strong><span>{member.email} · {humanize(member.role)} · {humanize(member.status)}</span></div>
              <StatusPill>{humanize(member.role)}</StatusPill>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Expense and split items" description="Canonical room items and the amounts already settled against them.">
        {data.items.length ? (
          <div className="admin-table-wrap nested">
            <table className="admin-table">
              <thead><tr><th>Item</th><th>Amount</th><th>Paid by</th><th>Assigned to</th><th>Settled</th><th>Pending</th></tr></thead>
              <tbody>{data.items.map((item: any) => <tr key={item.id}><td><strong>{item.title}</strong><small>{date(item.created_at)}</small></td><td>{money(item.amount)}</td><td>{item.paid_by_name || item.paid_by_email}</td><td>{item.assigned_to || item.assigned_email}</td><td>{money(item.settled_amount)}</td><td>{money(item.pending_amount)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <Empty text="No expense items exist in this room." />}
      </Section>

      <Section title="Settlement records" description="Recorded settlement events linked to items in this room.">
        {data.settlements.length ? (
          <div className="admin-list">
            {data.settlements.map((settlement: any) => (
              <div className="admin-list-row" key={settlement.id}>
                <div><strong>{humanize(settlement.method)} · {money(settlement.amount)}</strong><span>{date(settlement.created_at)} · Item {settlement.item_id}</span></div>
                <StatusPill tone="good">Recorded</StatusPill>
              </div>
            ))}
          </div>
        ) : <Empty text="No settlement records for this room." />}
      </Section>
    </AdminFrame>
  );
}

export function AdminSettlementDebugger() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([getAdminRooms("", 1), getAdminUsers("", 1)])
      .then(([roomData, userData]) => { setRooms(roomData.rooms); setUsers(userData.users); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load debugger options"));
  }, []);

  async function run() {
    if (!roomId || !userId) return;
    setError("");
    setRunning(true);
    try {
      setData(await getAdminSettlementDebugger(roomId, userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to trace settlement");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AdminFrame title="Settlement Debugger" subtitle="Trace a payable or receivable using the same canonical debt-line and net-settlement service used by SplitVerse.">
      <Section title="Build a trace" description="Choose a room and user. This diagnostic view does not modify financial records.">
        <div className="admin-controls">
          <Dropdown value={roomId} onChange={setRoomId} placeholder="Select room" ariaLabel="Select room" options={rooms.map((room) => ({ value: room.id, label: room.name }))} />
          <Dropdown value={userId} onChange={setUserId} placeholder="Select user" ariaLabel="Select user" options={users.map((user) => ({ value: user.id, label: user.name || user.email }))} />
          <button className="admin-button primary" disabled={!roomId || !userId || running} onClick={run}>{running ? "Tracing…" : "Trace calculation"}</button>
        </div>
      </Section>

      {error ? <ErrorBox error={error} /> : null}
      {data ? (
        <>
          <div className="admin-metric-grid compact">
            <MetricCard label="Room net position" value={<>{data.roomNet >= 0 ? "Receivable " : "Payable "}{money(Math.abs(data.roomNet))}</>} note={`${data.user?.name || data.user?.email} · ${data.room?.name}`} />
            <MetricCard label="Calculation source" value="Canonical service" note={data.source} />
          </div>

          <Section title="Room calculation trace" description="Every currently pending debt line involving the selected user in this room.">
            {data.roomDebtLines.length ? (
              <div className="admin-trace-list">
                {data.roomDebtLines.map((line: any, index: number) => (
                  <div className="admin-trace-row" key={`${line.item_id}-${index}`}>
                    <span className="admin-trace-index">{index + 1}</span>
                    <div><strong>{line.item_title}</strong><p>{line.debtor_name || line.debtor_email} owes {line.creditor_name || line.creditor_email}</p><small>Original {money(line.original_amount)} · Settled {money(line.settled_amount)} · Remaining {money(line.pending_amount)}</small></div>
                    <strong className="admin-trace-amount">{money(line.pending_amount)}</strong>
                  </div>
                ))}
              </div>
            ) : <Empty text="No pending canonical debt lines for this user in this room." />}
          </Section>

          <Section title="Canonical net settlements" description="Net positions across the rooms visible to the same settlement service.">
            {data.canonicalNetSettlements.length ? (
              <div className="admin-list">
                {data.canonicalNetSettlements.map((settlement: any) => (
                  <div className="admin-list-row" key={`${settlement.fromUserId}-${settlement.toUserId}`}>
                    <div><strong>{settlement.fromName || settlement.fromEmail} → {settlement.toName || settlement.toEmail}</strong><span>{settlement.breakdown.length} contributing item(s)</span></div>
                    <strong>{money(settlement.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : <Empty text="No net settlements remain for this user." />}
          </Section>
        </>
      ) : null}
    </AdminFrame>
  );
}

type FeedKind = "financial" | "audit" | "logs";

function GenericFeed({ kind }: { kind: FeedKind }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = kind === "financial" ? getAdminFinancialActivity : kind === "audit" ? getAdminAudit : getAdminAuditLogs;
    setError("");
    const timeout = setTimeout(() => {
      load(search, page)
        .then(setData)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load records"));
    }, 250);
    return () => clearTimeout(timeout);
  }, [kind, page, search]);

  const rows = data?.activity || data?.events || data?.logs || [];
  return (
    <>
      <div className="admin-toolbar">
        <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search records" />
        {data ? <StatusPill>{data.total ?? rows.length} records</StatusPill> : null}
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="admin-list admin-feed">
            {rows.map((row: any, index: number) => (
              <div className="admin-list-row" key={row.id || `${row.action}-${row.created_at}-${index}`}>
                <span className="admin-feed-icon">{kind === "financial" ? <CircleDollarSign size={17} /> : kind === "audit" ? <ShieldCheck size={17} /> : <Clock3 size={17} />}</span>
                <div>
                  <strong>{row.label || humanize(row.action || row.type || "Activity")}</strong>
                  <span>{row.user_email || row.admin_email || row.room_name || humanize(row.target_type || "System")}{row.amount != null ? ` · ${money(row.amount)}` : ""}</span>
                  {row.reason ? <small>Reason: {row.reason}</small> : null}
                </div>
                <time>{date(row.created_at)}</time>
              </div>
            ))}
          </div>
          {Number(data.total || 0) > FEED_PAGE_SIZE ? <Pager page={page} total={Number(data.total || 0)} pageSize={FEED_PAGE_SIZE} onPage={setPage} /> : null}
        </>
      )}
    </>
  );
}

export function AdminFinancialActivity() {
  return <AdminFrame title="Financial Activity" subtitle="Real expense, settlement, and wallet records. SplitVerse records activity; it does not imply bank processing."><GenericFeed kind="financial" /></AdminFrame>;
}
export function AdminAudit() {
  return <AdminFrame title="Audit & Integrity" subtitle="Traceable administrative actions and integrity events that SplitVerse actually recorded."><GenericFeed kind="audit" /></AdminFrame>;
}
export function AdminAuditLogs() {
  return <AdminFrame title="Admin Audit Logs" subtitle="Append-only record of meaningful administrator mutations."><GenericFeed kind="logs" /></AdminFrame>;
}

function SeriesCard({
  title,
  subtitle,
  rows,
  valueKey = "value",
  labelKey = "day",
  formatter = (value: number) => String(value),
}: {
  title: string;
  subtitle: string;
  rows: any[];
  valueKey?: string;
  labelKey?: string;
  formatter?: (value: number) => string;
}) {
  const normalized = rows.map((row) => Number(row[valueKey] || 0));
  const max = Math.max(1, ...normalized);
  const total = normalized.reduce((sum, value) => sum + value, 0);
  return (
    <article className="admin-chart-card">
      <div className="admin-chart-head"><div><strong>{title}</strong><span>{subtitle}</span></div><b>{formatter(total)}</b></div>
      {rows.length ? (
        <div className="admin-bars" aria-label={`${title} chart`}>
          {rows.map((row, index) => {
            const value = Number(row[valueKey] || 0);
            return <div className="admin-bar-column" key={`${row[labelKey]}-${index}`} title={`${shortDate(row[labelKey])}: ${formatter(value)}`}><span style={{ height: `${Math.max(5, (value / max) * 100)}%` }} /><small>{index === 0 || index === rows.length - 1 ? shortDate(row[labelKey]) : ""}</small></div>;
          })}
        </div>
      ) : <Empty text="No activity in this period." />}
    </article>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { getAdminAnalytics().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load analytics")); }, []);

  if (error) return <AdminFrame title="Analytics"><ErrorBox error={error} /></AdminFrame>;
  if (!data) return <AdminFrame title="Analytics"><Loading /></AdminFrame>;

  return (
    <AdminFrame title="Analytics" subtitle="Actual 30-day database aggregates with no synthetic growth percentages.">
      <div className="admin-analysis-grid">
        <SeriesCard title="New users" subtitle="Accounts created" rows={data.userGrowth || []} />
        <SeriesCard title="New rooms" subtitle="Rooms created" rows={data.roomGrowth || []} />
        <SeriesCard title="Expense activity" subtitle="Tracked value" rows={data.expenseActivity || []} formatter={money} />
        <article className="admin-chart-card">
          <div className="admin-chart-head"><div><strong>Settlements by method</strong><span>Recorded settlement activity</span></div><BarChart3 size={19} /></div>
          {data.settlementsByMethod?.length ? <div className="admin-method-list">{data.settlementsByMethod.map((row: any) => <div key={row.method}><span><strong>{humanize(row.method)}</strong><small>{row.count} records</small></span><b>{money(row.amount)}</b></div>)}</div> : <Empty text="No settlement records yet." />}
        </article>
      </div>
    </AdminFrame>
  );
}

export function AdminFeatureFlags() {
  const [data, setData] = useState<any>(null);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () => getAdminFeatureFlags().then(setData);

  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load feature flags")); }, []);

  async function save() {
    if (!key || reason.trim().length < 3) { setError("Enter a flag key and a reason of at least 3 characters."); return; }
    setSaving(true); setError("");
    try {
      await updateAdminFeatureFlag(key, { description, enabled, rolloutPercent: 100, reason });
      setKey(""); setDescription(""); setReason(""); setEnabled(false);
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Could not save feature flag");
    } finally { setSaving(false); }
  }

  return (
    <AdminFrame title="Feature Flags" subtitle="Server-controlled product flags. Security protections are deliberately excluded.">
      <Section title="Create or update a flag" description="Use stable snake_case keys and document why the state is changing.">
        <div className="admin-form-grid">
          <label><span>Flag key</span><input placeholder="new_room_flow" value={key} onChange={(event) => setKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} /></label>
          <label className="wide"><span>Description</span><input placeholder="What this flag controls" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="wide"><span>Reason for change</span><input placeholder="Required for the audit log" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button type="button" className={`admin-toggle ${enabled ? "on" : ""}`} aria-pressed={enabled} onClick={() => setEnabled((value) => !value)}><span /><b>{enabled ? "Enabled" : "Disabled"}</b></button>
          <button className="admin-button primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save flag"}</button>
        </div>
        {error ? <ErrorBox error={error} /> : null}
      </Section>
      {!data ? <Loading /> : data.flags.length ? (
        <div className="admin-card-grid">
          {data.flags.map((flag: any) => (
            <article className="admin-config-card" key={flag.key}>
              <div className="admin-config-title"><span className="admin-config-icon"><Flag size={17} /></span><div><strong>{flag.key}</strong><small>{flag.description || "No description"}</small></div><StatusPill tone={flag.enabled ? "good" : "neutral"}>{flag.enabled ? "Enabled" : "Disabled"}</StatusPill></div>
              <footer><span>Rollout {flag.rollout_percent}%</span><span>Updated {date(flag.updated_at)}</span></footer>
            </article>
          ))}
        </div>
      ) : <Empty text="No feature flags have been created." />}
    </AdminFrame>
  );
}

const configLabels: Record<string, string> = {
  android_latest_version: "Latest Android Version",
  android_minimum_version: "Minimum Supported Version",
  android_force_update: "Force Update",
  android_update_url: "Update URL",
  android_release_notes: "Release Notes",
  maintenance_enabled: "Maintenance Mode",
  maintenance_message: "Maintenance Message",
};

export function AdminConfiguration({ versionsOnly = false }: { versionsOnly?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const next = await getAdminConfig();
    setData(next);
    setDrafts(Object.fromEntries(Object.entries(next.config || {}).map(([key, config]: any) => [key, config.value])));
  };

  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load configuration")); }, []);

  const entries = useMemo(
    () => Object.entries(data?.config || {}).filter(([key]) => versionsOnly ? key.startsWith("android_") : !key.startsWith("android_")),
    [data, versionsOnly],
  );

  async function save(key: string, current: any) {
    const reason = reasons[key]?.trim();
    if (!reason) { setError("Enter a reason before saving a configuration change."); return; }
    setSavingKey(key); setError("");
    try {
      await updateAdminConfig(key, drafts[key], reason);
      setReasons((state) => ({ ...state, [key]: "" }));
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Could not update configuration");
      setDrafts((state) => ({ ...state, [key]: current.value }));
    } finally { setSavingKey(""); }
  }

  return (
    <AdminFrame
      title={versionsOnly ? "App Versions" : "Configuration"}
      subtitle={versionsOnly ? "Controls the existing Android self-update flow using audited server configuration." : "Runtime-safe product settings. Secrets remain in server-side environment variables."}
    >
      {error ? <ErrorBox error={error} /> : null}
      {!data ? <Loading /> : entries.length ? (
        <div className="admin-config-stack">
          {entries.map(([key, config]: any) => {
            const boolean = typeof config.value === "boolean";
            const dirty = drafts[key] !== config.value;
            return (
              <article className="admin-config-card editable" key={key}>
                <div className="admin-config-title">
                  <span className="admin-config-icon">{key.startsWith("android_") ? <Smartphone size={17} /> : <ShieldCheck size={17} />}</span>
                  <div><strong>{configLabels[key] || humanize(key)}</strong><small>{config.description || "Server-controlled configuration"}</small></div>
                  <StatusPill tone={boolean && drafts[key] ? "warning" : "neutral"}>{valueText(config.value)}</StatusPill>
                </div>
                <div className="admin-config-edit">
                  {boolean ? (
                    <button type="button" className={`admin-toggle ${drafts[key] ? "on" : ""}`} aria-pressed={Boolean(drafts[key])} onClick={() => setDrafts((state) => ({ ...state, [key]: !Boolean(state[key]) }))}><span /><b>{drafts[key] ? "Enabled" : "Disabled"}</b></button>
                  ) : (
                    <input value={String(drafts[key] ?? "")} onChange={(event) => setDrafts((state) => ({ ...state, [key]: event.target.value }))} aria-label={`New ${configLabels[key] || key}`} />
                  )}
                  <input className="admin-reason" placeholder="Reason required for audit log" value={reasons[key] || ""} onChange={(event) => setReasons((state) => ({ ...state, [key]: event.target.value }))} />
                  <button className="admin-button primary" disabled={!dirty || savingKey === key} onClick={() => save(key, config)}>{savingKey === key ? "Saving…" : "Save change"}</button>
                </div>
                <footer><span>Last updated {date(config.updatedAt)}</span><span>{dirty ? "Unsaved change" : "No pending changes"}</span></footer>
              </article>
            );
          })}
        </div>
      ) : <Empty text="No configuration is available for this section." />}
    </AdminFrame>
  );
}

export function AdminSecurity() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { getAdminSecurity().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load security view")); }, []);

  return (
    <AdminFrame title="Security" subtitle="Server-enforced account restrictions, installation-risk signals, and auditable anti-abuse actions.">
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : (
        <>
          <div className="admin-metric-grid compact">
            <MetricCard label="Blocked accounts" value={String(data.counts?.blocked ?? 0)} icon={<Ban size={17} />} />
            <MetricCard label="Restricted / review" value={String(data.counts?.restricted ?? 0)} icon={<ShieldAlert size={17} />} />
            <MetricCard label="Restricted installations" value={String(data.counts?.restricted_installations ?? 0)} icon={<Smartphone size={17} />} />
            <MetricCard label="Ban-evasion signals · 30d" value={String(data.counts?.evasion_signals_30d ?? 0)} icon={<ShieldCheck size={17} />} />
          </div>

          <div className="admin-security-note"><ShieldCheck size={21} /><div><strong>How account protection works</strong><p>{data.note}</p></div></div>

          <Section title="Accounts requiring attention" description="Blocked accounts are denied normal API access. Restricted accounts can read their data but cannot perform protected mutations until reviewed.">
            {data.accounts?.length ? (
              <div className="admin-list">
                {data.accounts.map((account: any) => (
                  <Link className="admin-list-row linked" to={`/admin/users/${account.id}`} key={account.id}>
                    <span className="admin-feed-icon">{account.status === "blocked" ? <Ban size={17} /> : <ShieldAlert size={17} />}</span>
                    <div>
                      <strong>{account.name || account.email}</strong>
                      <span>{account.email} · {account.installation_count} known installation(s) · {account.restricted_installation_count} restricted</span>
                      <small>{account.reason || "No reason recorded"} · {date(account.updated_at)}</small>
                    </div>
                    <StatusPill tone={account.status === "blocked" ? "danger" : "warning"}>{humanize(account.status)}</StatusPill>
                  </Link>
                ))}
              </div>
            ) : <Empty text="No blocked or restricted accounts." />}
          </Section>

          <Section title="Risk signals" description="Installation matches are intentionally treated as review signals rather than proof of identity, reducing false positives on shared devices.">
            {data.riskEvents?.length ? (
              <div className="admin-list">
                {data.riskEvents.map((event: any) => (
                  <div className="admin-list-row" key={event.id}>
                    <span className="admin-feed-icon"><ShieldAlert size={17} /></span>
                    <div>
                      <strong>{humanize(event.event_type)}</strong>
                      <span>{event.user_email || "Unknown account"}{event.related_user_email ? ` · related blocked account ${event.related_user_email}` : ""}</span>
                    </div>
                    <time>{date(event.created_at)}</time>
                  </div>
                ))}
              </div>
            ) : <Empty text="No installation-based risk signals have been recorded." />}
          </Section>

          <Section title="Recent security actions" description="Administrator security and financial-correction actions already written to the append-only audit log.">
            {data.events?.length ? <div className="admin-list">{data.events.map((event: any, index: number) => <div className="admin-list-row" key={`${event.created_at}-${index}`}><span className="admin-feed-icon"><ShieldCheck size={17} /></span><div><strong>{humanize(event.action)}</strong><span>{event.admin_email}{event.reason ? ` · ${event.reason}` : ""}</span></div><time>{date(event.created_at)}</time></div>)}</div> : <Empty text="No recorded security admin actions." />}
          </Section>
        </>
      )}
    </AdminFrame>
  );
}
