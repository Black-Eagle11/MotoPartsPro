
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({
  allowedRoles = ["admin", "staff", "member"],
}) {
  const {
    user,
    isLoading,
    isAuthenticated,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <main
        className="loading-state"
        role="status"
        aria-live="polite"
      >
        <p>Memverifikasi sesi pengguna...</p>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0 ||
    !allowedRoles.includes(user.role)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ forbidden: true }}
      />
    );
  }

  return <Outlet />;
}
