const BASE = import.meta.env.VITE_API_BASE_URL || "";

// single source of truth for access token
let accessToken: string | null = null;

// Get current access token (called from AuthContext)
export function getAccessToken() {
  return accessToken;
}

// Set access token in memory only
export function setAccessToken(token: string | null) {
  accessToken = token;

}

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error); // Token refresh failed - reject all waiting requests
    } else {
      prom.resolve();     // Token refresh succeeded - allow all requests to retry
    }
  });
  
  failedQueue = [];       // Clear the queue
};

// Extends RequestInit and prevents infinite retry loops (we only retry once after 401)
type RetryableRequestInit = RequestInit & { _isRetry?: boolean };


async function raw<T>(path: string, init: RetryableRequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Add authorization header if we have a token
  const currentToken = getAccessToken();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);


  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", //Required to send HttpOnly cookies
  });

  // Auto-refresh on 401 once (prevents infinite loops)
  if (res.status === 401 && !init._isRetry) {
    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => raw<T>(path, { ...init, _isRetry: true }));
    }

    // Sets flag so other 401s will queue instead of refreshing again
    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${BASE}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Send refresh token cookie
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json(); // { access: "new_token_here" }
        setAccessToken(data.access);          // Store new token in memory
        processQueue();                       // Tell queued requests to retry
        isRefreshing = false;                 // Clear the flag
        return raw<T>(path, { ...init, _isRetry: true });  // Retry original request with new token
      } else {
        // Refresh failed - clear token and refresh queue
        const error = new Error("Token refresh failed");
        setAccessToken(null);     // Clear the token
        processQueue(error);      // Reject all queued requests
        isRefreshing = false;     // Clear the flag
        throw error;              // Throw error to caller
      }
    } catch (error) {
      setAccessToken(null);
      processQueue(error);
      isRefreshing = false;
      throw error;
    }
  }

  if (!res.ok) {
    let details: unknown = null;
    try {
      details = await res.json();
    } catch {}
    throw { status: res.status, statusText: res.statusText, details };
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// Public API function that doesn't send auth headers
async function publicRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  // Explicitly don't add Authorization header for public endpoints

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let details: unknown = null;
    try {
      details = await res.json();
    } catch {}
    throw { status: res.status, statusText: res.statusText, details };
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(p: string) => raw<T>(p),
  post: <T>(p: string, body?: unknown) =>
    raw<T>(p, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T>(p: string, body?: unknown) =>
    raw<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown) =>
    raw<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(p: string) => raw<T>(p, { method: "DELETE" }),
};

// Public API that doesn't send authentication headers
export const publicApi = {
  get: <T>(p: string) => publicRaw<T>(p),
  post: <T>(p: string) => 
    publicRaw<T>(p, {
      method: "POST",
      credentials: "include"
    })
};
