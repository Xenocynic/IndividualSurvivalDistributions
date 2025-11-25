/**
 * LOGIN PAGE
 *
 * Purpose:
 * - Public page to authenticate a user.
 * - On submit, calls 'auth.login(email)' (demo stub) and redirects to /dashboard.
 *
 * Notes:
 * - Segmented toggle (Sign in / Sign up) to switch auth pages.
 * - Email + Password form with basic accessibility + autocompletes.
 * - Background color is handled by AppLayout when logged out (full-page gray) (this is just a note for @Xenocynic)
 *
 * TO DO:
 * - Real apps: replace the stubbed `login()` with an API call + error handling.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err: any) {
      const d = err?.details;
      const message =
        d?.detail ??
        (Array.isArray(d?.username) && d.username[0]) ??
        (Array.isArray(d?.password) && d.password[0]) ??
        "Login failed";
      setErrorMsg(String(message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Scoped styles (smaller text, centered label, arrow absolute right) */}
      <style>{`
        .login-cta {
          position: relative;
          border: none;
          background: #000;
          color: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 48px 5px 16px;
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .login-cta:hover { background: #111; }
        .login-cta:active { transform: scale(0.98); }
        .login-cta:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.45);
        }
        .login-cta:disabled { opacity: 0.6; cursor: not-allowed; }

        .login-cta span.label {
          padding-bottom: 6px;
          letter-spacing: 3px;
          font-size: 11px;
          text-transform: uppercase;
          padding-right: 0;
        }

        .login-cta svg.arrow {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%) translateX(-8px);
          transition: transform 0.3s ease;
        }
        .login-cta:hover svg.arrow { transform: translateY(-50%) translateX(0); }
        .login-cta:active svg.arrow { transform: translateY(-50%) scale(0.9); }

        .login-cta .hover-underline-animation {
          position: relative;
          color: inherit;
          padding-bottom: 20px;
        }
        .login-cta .hover-underline-animation:after {
          content: "";
          position: absolute;
          width: 100%;
          transform: scaleX(0);
          height: 2px;
          bottom: 0;
          left: 0;
          background-color: currentColor;
          transform-origin: bottom right;
          transition: transform 0.25s ease-out;
        }
        .login-cta:hover .hover-underline-animation:after {
          transform: scaleX(1);
          transform-origin: bottom left;
        }

        .login-cta .loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 1px;
          font-size: 12px;          /* match smaller size */
        }
        .login-cta .spinner {
          width: 16px;
          height: 16px;
          animation: login-spin 1s linear infinite;
          color: currentColor;
        }
        @keyframes login-spin { to { transform: rotate(360deg); } }

        @media (prefers-reduced-motion: reduce) {
          .login-cta, .login-cta * { transition: none !important; }
          .login-cta:hover svg.arrow { transform: translateY(-50%); }
          .login-cta .spinner { animation: none; }
        }
      `}</style>

      <section className="grid min-h-[60vh] place-items-center py-12">
        <div className="w-full max-w-md rounded-xl bg-black/5 p-1">
          <div className="rounded-xl bg-white p-6 shadow-card">
            {/* Segmented toggle */}
            <div className="mb-5 flex justify-center">
              <div className="inline-flex items-center rounded-md border border-black/10 bg-white p-0.5">
                <div className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium bg-black text-white">
                  Sign in
                </div>
                <Link
                  to="/signup"
                  className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  Sign up
                </Link>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block text-xs font-medium text-gray-700">
                Username
                <input
                  type="text"
                  required
                  id="current-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                  autoComplete="username"
                />
              </label>

              <label className="block text-xs font-medium text-gray-700">
                Password
                <input
                  type="password"
                  required
                  id="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                  autoComplete="current-password"
                />
              </label>

              <div className="flex items-center justify-between pt-1">
                <Link to="/reset" className="text-xs text-gray-600 hover:underline">
                  Forgot password?
                </Link>

                {/* Submit button (centered label, smaller text) */}
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting || undefined}
                  className="login-cta"
                >
                  {submitting ? (
                    <span className="loading">
                      <svg className="spinner" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v3A5 5 0 007 12H4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span className="label hover-underline-animation">Submit</span>
                      <svg
                        className="arrow"
                        width="15"
                        height="15"
                        viewBox="0 0 15 15"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                          fill="currentColor"
                          fillRule="evenodd"
                          clipRule="evenodd"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}