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
 * - Make sure API calls work and add more as needed
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, publicApi, setAccessToken } from "../lib/apiClient";

type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
  groups: string[];
};

type SignupBody = {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (body: SignupBody) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, "first_name" | "last_name" | "email">>) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH = "/api/auth";
const ACCOUNTS = "/api/accounts"; 


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Attempt to restore session on mount using refresh token cookie
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Use publicApi.post since token refresh endpoint doesn't require Authorization header
        // The refresh token is sent via HttpOnly cookie (credentials: "include" in publicApi)
        const data = await publicApi.post<{ access: string }>(`${AUTH}/token/refresh`);
        setAccessToken(data.access)
        // Now we have a token, fetch user profile with authenticated api.get()
        await refreshProfile();
      } catch (e) {
        // No valid session - user needs to log in
        console.log("No valid session found");
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    try{
      const res = await api.post<{ access: string; refresh?: string }>(`${AUTH}/login/`, {
      username,
      password,
    });
    // Store access token in memory (refresh token is in HttpOnly cookie) from apiClient
    setAccessToken(res.access); 
    await refreshProfile();
    } catch (e: any){
      const errorMsg = e?.details?.detail || e?.details?.non_field_errors?.[0] || "Login failed";
      setError(errorMsg);
      throw e;
    }
  };

  const signup = async (body: SignupBody) => {
    setError(null);
    try{
      // create account
      await api.post(`${AUTH}/register/`, body);
      // then login automatically
      await login(body.username, body.password);
    } catch (e: any) {
      const errorMsg =  e?.details?.username?.[0] || 
                        e?.details?.email?.[0] || 
                        e?.details?.password?.[0] ||
                        e?.details?.detail || 
                        "Signup failed";
      setError(errorMsg);
      throw e;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      // Backend will read refresh token from the HttpOnly cookie and blacklist it
      await api.post(`${AUTH}/logout/`, {}).catch(() => {});
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
        setAccessToken(null); //from apiClient
        setUser(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const me = await api.get<User>(`${ACCOUNTS}/users/me/`);
      setUser(me);
      setError(null);
    } catch (e: any) {
      setUser(null);
      throw e;
    }
  };

  const updateProfile = async (patch: Partial<Pick<User, "first_name" | "last_name" | "email">>) => {
    setError(null);
    const cleaned: Record<string, unknown> = {};
    if (typeof patch.first_name === "string") cleaned.first_name = patch.first_name;
    if (typeof patch.last_name === "string") cleaned.last_name = patch.last_name;
    if (typeof patch.email === "string") cleaned.email = patch.email;

    const updated = await api.patch<User>(`${ACCOUNTS}/users/me/`, cleaned);
    setUser(updated);
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);
    // Your UserSerializer.update supports changing password via PATCH "password"
    await api.patch(`${ACCOUNTS}/users/me/`, { password: newPassword });
    // Optional: force re-login if desired
    // await logout();
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    refreshProfile,
    updateProfile,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
