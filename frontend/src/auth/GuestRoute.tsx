import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>; 
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
