/**
 * PROTECTED ROUTE
 *
 * Purpose:
 * - Guard a group of routes so they only render when a user is authenticated.
 *
 * Notes:
 * - If 'user' = null, redirect to /login (and store the current location in
 *   state so you could optionally navigate back after login).
 * - If 'user' EXISTS, render nested routes via <Outlet/>.
 *
 * Usage: (just copy-paste this around in App.tsx)
 * <Route element={<ProtectedRoute />}>
 *   <Route path="dashboard" element={<Dashboard />} />
 * </Route>
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute() {
  const { user } = useAuth();
  const loc = useLocation();

  // Not authenticated: bounce to login, keeping where we came from
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  // Authenticated: render the nested routes or route
  return <Outlet />;
}
