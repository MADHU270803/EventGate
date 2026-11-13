import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../utils.js";
import { PageLoader } from "./ui.jsx";

// Only for logged-in users. If "role" is given, only for that role.
// (This only hides pages. The real protection is on the server.)
export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

// Login and register pages: logged-in users are sent to their own home.
export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

// The "/" address: send people where they belong.
export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}