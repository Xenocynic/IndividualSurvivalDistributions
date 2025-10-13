import { api, setTokens } from "../lib/apiClient";

export type TokenPair = { access: string; refresh: string };

export async function login(username: string, password: string) {
  const data = await api.post<TokenPair>("/api/auth/login/", { username, password });
  setTokens(data);
  return data;
}

export async function refresh(refreshToken: string) {
  return api.post<{ access: string }>("/api/auth/token/refresh/", { refresh: refreshToken });
}

export async function logout(refresh?: string) {
  // If your logout endpoint expects the refresh token in body:
  if (refresh) {
    try { await api.post("/api/auth/logout/", { refresh }); } catch {}
  }
  setTokens(null);
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}) {
  return api.post("/api/auth/register/", payload);
}
