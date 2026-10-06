import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import DashboardPageLoader from "../pageloaders/DashboardPageLoader";
import { useAdminAccess } from "../hooks/useAdminAccess";

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAdminAccess();
  if (loading) return <DashboardPageLoader variant="dashboard" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
