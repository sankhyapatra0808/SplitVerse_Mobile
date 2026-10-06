import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import TopProgressBar from "./components/TopProgressBar";
import DashboardPageLoader from "./pageloaders/DashboardPageLoader";
import type { DashboardLoaderVariant } from "./pageloaders/DashboardPageLoader";
import { useAuth } from "./context/useAuth";

const Home = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SharedSplitRooms = lazy(() => import("./pages/SharedSplitRooms"));
const SettlementDetails = lazy(() => import("./pages/SettlementDetails"));
const SettlementHistory = lazy(() => import("./pages/SettlementHistory"));
const WalletBalance = lazy(() => import("./pages/WalletBalance"));
const WalletTopUp = lazy(() => import("./pages/WalletTopUp"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const AppSettings = lazy(() => import("./pages/AppSettings"));
const Friends = lazy(() => import("./pages/Friends"));
const AboutCompany = lazy(() => import("./pages/AboutCompany"));
const Contact = lazy(() => import("./pages/Contact"));
const Support = lazy(() => import("./pages/Support"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Security = lazy(() => import("./pages/Security"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminOverview = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminOverview })));
const AdminUsers = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminUsers })));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminUserDetail })));
const AdminRooms = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminRooms })));
const AdminRoomDetail = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminRoomDetail })));
const AdminSettlementDebugger = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminSettlementDebugger })));
const AdminFinancialActivity = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminFinancialActivity })));
const AdminAudit = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminAudit })));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminAnalytics })));
const AdminFeatureFlags = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminFeatureFlags })));
const AdminConfiguration = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminConfiguration })));
const AdminSecurity = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminSecurity })));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminPortal").then((m) => ({ default: m.AdminAuditLogs })));


function publicPage(page: ReactNode) {
  return <Suspense fallback={null}>{page}</Suspense>;
}

function homePage(page: ReactNode) {
  return (
    <Suspense fallback={null}>
      <HomeRoute>{page}</HomeRoute>
    </Suspense>
  );
}

function HomeRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <DashboardPageLoader variant="dashboard" />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function dashboardPage(page: ReactNode, loaderVariant: DashboardLoaderVariant) {
  return (
    <ProtectedRoute loaderVariant={loaderVariant}>
      <Suspense fallback={<DashboardPageLoader variant={loaderVariant} />}>
        {page}
      </Suspense>
    </ProtectedRoute>
  );
}


function adminPage(page: ReactNode) {
  return (
    <AdminProtectedRoute>
      <Suspense fallback={<DashboardPageLoader variant="dashboard" />}>
        {page}
      </Suspense>
    </AdminProtectedRoute>
  );
}

function App() {
  return (
    <>
      <TopProgressBar />
      <Routes>
        <Route path="/" element={homePage(<Home />)} />
        <Route path="/login" element={publicPage(<Login />)} />
        <Route path="/signup" element={publicPage(<Signup />)} />
        <Route path="/forgot-password" element={publicPage(<ForgotPassword />)} />
        <Route path="/reset-password" element={publicPage(<ResetPassword />)} />
        <Route path="/about" element={publicPage(<AboutCompany />)} />
        <Route path="/contact" element={publicPage(<Contact />)} />
        <Route path="/support" element={publicPage(<Support />)} />
        <Route path="/privacy" element={publicPage(<Privacy />)} />
        <Route path="/terms" element={publicPage(<Terms />)} />
        <Route path="/security" element={publicPage(<Security />)} />

        <Route path="/dashboard" element={dashboardPage(<Dashboard />, "dashboard")} />
        <Route path="/split-rooms" element={dashboardPage(<SharedSplitRooms />, "splitRooms")} />
        <Route path="/settlements/:direction" element={dashboardPage(<SettlementDetails />, "splitRooms")} />
        <Route path="/settlements/history/:otherUserId" element={dashboardPage(<SettlementHistory />, "splitRooms")} />
        <Route path="/wallet" element={dashboardPage(<WalletBalance />, "wallet")} />
        <Route path="/wallet-top-up" element={dashboardPage(<WalletTopUp />, "walletTopUp")} />
        <Route path="/transactions" element={dashboardPage(<TransactionHistory />, "transactions")} />
        <Route path="/friends" element={dashboardPage(<Friends />, "friends")} />
        <Route path="/settings" element={dashboardPage(<AppSettings />, "settings")} />

        <Route path="/admin" element={adminPage(<AdminOverview />)} />
        <Route path="/admin/users" element={adminPage(<AdminUsers />)} />
        <Route path="/admin/users/:id" element={adminPage(<AdminUserDetail />)} />
        <Route path="/admin/rooms" element={adminPage(<AdminRooms />)} />
        <Route path="/admin/rooms/:id" element={adminPage(<AdminRoomDetail />)} />
        <Route path="/admin/settlements" element={adminPage(<AdminSettlementDebugger />)} />
        <Route path="/admin/financial-activity" element={adminPage(<AdminFinancialActivity />)} />
        <Route path="/admin/audit" element={adminPage(<AdminAudit />)} />
        <Route path="/admin/analytics" element={adminPage(<AdminAnalytics />)} />
        <Route path="/admin/feature-flags" element={adminPage(<AdminFeatureFlags />)} />
        <Route path="/admin/versions" element={adminPage(<AdminConfiguration versionsOnly />)} />
        <Route path="/admin/config" element={adminPage(<AdminConfiguration />)} />
        <Route path="/admin/security" element={adminPage(<AdminSecurity />)} />
        <Route path="/admin/admin-audit-logs" element={adminPage(<AdminAuditLogs />)} />
        <Route path="*" element={publicPage(<NotFound />)} />
      </Routes>
    </>
  );
}

export default App;
