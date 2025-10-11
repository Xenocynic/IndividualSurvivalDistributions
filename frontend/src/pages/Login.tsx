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
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // kept for parity with a real form
  const loc = useLocation();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: replace with real API call + error states
    login(email);
  }

  return (
    // Center the auth card; page bg comes from AppLayout when logged out
    <section className="grid min-h-[60vh] place-items-center py-12">
      <div className="w-full max-w-md rounded-xl bg-black/5 p-1">
        <div className="rounded-xl bg-white p-6 shadow-card">
          {/* Segmented toggle (Sign in active) */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center rounded-md border border-black/10 bg-white p-0.5">
              <Link
                to="/login"
                className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium bg-black text-white"
                aria-current="page"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign up
              </Link>
            </div>
          </div>

          {/* Auth form */}
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="email"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                // current-password helps managers autofill on login page
                autoComplete={loc.pathname === "/login" ? "current-password" : "password"}
              />
            </label>

            <div className="flex items-center justify-between pt-1">
              <Link to="/reset" className="text-xs text-gray-600 hover:underline">
                Forgot password?
              </Link>
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
