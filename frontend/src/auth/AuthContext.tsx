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
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// small helpers and service calls for real API wiring
import { loadTokensFromStorage, setTokens } from "../lib/apiClient";
import * as Auth from "../services/auth";

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

  // On mount, load any saved tokens (so a refresh can succeed later if you add /me fetching)
  useEffect(() => {
    loadTokensFromStorage();
    // Optional future: call /api/auth/me to hydrate real profile if tokens exist.
  }, []);

  // Memoize the context value so consumers don’t rerender unnecessarily
  const value = useMemo<AuthContextType>(() => ({
    user,

    // REAL login: calls /api/auth/login/ with username/password (SimpleJWT default)
    async login(username: string, password: string) {
      await Auth.login(username, password);
      // fetch here and set the real user
      setUser({ id: "self", username, displayName: username });
      navigate("/dashboard", { replace: true });
    },

    // REAL signup: calls /api/auth/register/, then logs in and redirects
    async signup({ username, email, password, password2 }) {
      await Auth.register({ username, email, password, password2 });
      await Auth.login(username, password);
      setUser({ id: "self", username, displayName: username, email });
      navigate("/dashboard", { replace: true });
    },

    // REAL logout: clears tokens and user, then returns to home
    async logout() {
      try {
        await Auth.logout(); // if your backend expects refresh token, implement inside services/auth.ts
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
