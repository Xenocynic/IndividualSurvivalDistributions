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
 * Notes (11 OCT):
 * - login() now expects (username, password) to match Django SimpleJWT defaults.
 * - signup() now expects { username, email, password, password2 }.
 * - These call services/auth.ts (real API wiring); if you haven't added that file yet,
 *   create it as discussed (login/register/logout using /api/auth/* endpoints).
 *
 * TO DO
 * - This is a UI-only thing. Replace each action with real API calls later
 *   (set / clear tokens, fetch profile, handle errors, etc.).
 *
 * UPDATE (mock mode):
 * - Added a MOCK AUTH switch controlled by VITE_AUTH_MODE=mock for local testing
 *   without a backend. Clearly marked sections show what to remove later.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// ---- REAL API HELPERS (keep) ----
import { loadTokensFromStorage, setTokens } from "../lib/apiClient";
import * as Auth from "../services/auth";

// ---- MOCK AUTH HELPERS (TEMPORARY) ----
// REMOVE THIS IMPORT WHEN REAL API IS FULLY WIRED
import { mockLogin, mockRegister, mockLogout } from "./mock";

// Toggle between 'mock' and 'real' via .env: VITE_AUTH_MODE=mock
const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || "real").toLowerCase();

// Shape of a logged-in user - extend this as the backend grows
export type User = { id: string; username: string; email?: string; displayName: string };

// What the context exposes to the app
type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (payload: { username: string; email: string; password: string; password2: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, "displayName" | "email">>) => void;
  updatePassword: (current: string, next: string) => void;
};

// Internal context instance. Undefined means "not wrapped by <AuthProvider>"
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Wrap the app with this provider to make auth state/actions available
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // On mount, load any saved tokens so a refresh can succeed later.
    // NOTE: harmless in mock mode; only used by real API calls.
    loadTokensFromStorage();

    // OPTIONAL (for real mode later): call /api/auth/me here if tokens exist
    // to hydrate a persisted session with the actual profile.
  }, []);

  // Memoize the context value so consumers don’t rerender unnecessarily
  const value = useMemo<AuthContextType>(() => ({
    user,

    async login(username: string, password: string) {
      if (AUTH_MODE === "mock") {
        // ---- MOCK LOGIN (TEMPORARY) ----
        // REMOVE THIS BLOCK when the real API is working end-to-end.
        const { user: u } = await mockLogin(username, password);
        setUser({ id: u.id, username: u.username, displayName: u.displayName, email: u.email });
        navigate("/dashboard", { replace: true });
        return;
      }

      // ---- REAL LOGIN (KEEP) ----
      await Auth.login(username, password); // sets tokens via apiClient
      // TODO (real): fetch /api/auth/me and set real profile instead of synthesizing
      setUser({ id: "self", username, displayName: username });
      navigate("/dashboard", { replace: true });
    },

    async signup({ username, email, password, password2 }) {
      if (AUTH_MODE === "mock") {
        // ---- MOCK SIGNUP (TEMPORARY) ----
        // REMOVE THIS BLOCK when the real API is working end-to-end.
        const { user: u } = await mockRegister(username, email, password, password2);
        setUser({ id: u.id, username: u.username, displayName: u.displayName, email: u.email });
        navigate("/dashboard", { replace: true });
        return;
      }

      // ---- REAL SIGNUP (KEEP) ----
      await Auth.register({ username, email, password, password2 });
      await Auth.login(username, password);
      // TODO (real): fetch /api/auth/me and set real profile
      setUser({ id: "self", username, displayName: username, email });
      navigate("/dashboard", { replace: true });
    },

    async logout() {
      if (AUTH_MODE === "mock") {
        // ---- MOCK LOGOUT (TEMPORARY) ----
        // REMOVE THIS BLOCK when the real API is working end-to-end.
        await mockLogout();
        setUser(null);
        navigate("/", { replace: true });
        return;
      }

      // ---- REAL LOGOUT (KEEP) ----
      try {
        await Auth.logout(); // if backend expects refresh token, handle inside services/auth.ts
      } finally {
        setUser(null);
        setTokens(null);
        navigate("/", { replace: true });
      }
    },

    // DEMO profile update: patch local state (replace with API later)
    updateProfile: (patch) => {
      setUser((u) => (u ? { ...u, ...patch } : u));
      alert("(demo) Profile updated");
    },

    // DEMO password update: no-op + toast (replace with API later)
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
