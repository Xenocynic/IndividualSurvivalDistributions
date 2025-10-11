/**
 * AUTH CONTEXT
 *
 * Purpose:
 * - Central source of truth for authentication state.
 * - Exposes the current 'user' and simple actions: login, signup, logout,
 *   updateProfile, updatePassword.
 *
 * Notes:
 * - AuthProvider stores 'user' in local React state.
 * - Public methods update that state and optionally navigate to routes
 *   (like: go to /dashboard after login / signup; go to / after logout).
 * - useAuth() reads / updates auth from any component! Pretty neat
 *
 * TO DO
 * - This is a UI-only thing. Replace each action with real API calls later
 *   (set / clear tokens, fetch profile, handle errors, etc.).
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Shape of a logged-in user - extend this as the backend grows
export type User = { id: string; email: string; displayName: string };

// What the context exposes to the app
type AuthContextType = {
  user: User | null;
  login: (email: string) => void;
  signup: (email: string) => void;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, "displayName" | "email">>) => void;
  updatePassword: (current: string, next: string) => void;
};

// Internal context instance. Undefined means "not wrapped by <AuthProvider>"
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Wrap the app with this provider to make auth state/actions available
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  // Memoize the context value so consumers don’t rerender unnecessarily
  const value = useMemo<AuthContextType>(() => ({
    user,

    // DEMO login: create a user from email and go to /dashboard
    login: (email: string) => {
      setUser({ id: "demo", email, displayName: email.split("@")[0] || "User" });
      navigate("/dashboard", { replace: true });
    },

    // DEMO signup: same as login for now
    signup: (email: string) => {
      setUser({ id: "demo", email, displayName: email.split("@")[0] || "User" });
      navigate("/dashboard", { replace: true });
    },

    // DEMO logout: clear user and go “home”
    logout: () => {
      setUser(null);
      navigate("/", { replace: true });
    },

    // DEMO profile update: patch local state
    updateProfile: (patch) => {
      setUser((u) => (u ? { ...u, ...patch } : u));
      alert("(demo) Profile updated");
    },

    // DEMO password update: no-op + toast
    updatePassword: (_current, _next) => {
      // Replace with API call and proper error handling
      alert("(demo) Password changed");
    },
  }), [user, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Consumer hook — throws if used outside <AuthProvider>
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
