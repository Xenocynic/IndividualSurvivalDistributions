/**
 * SIGN UP PAGE
 *
 * Purpose:
 * - Public page to create a new account.
 * - On submit, calls 'auth.signup(email)' (demo stub) and redirects to /dashboard.
 *
 * Notes:
 * - Segmented toggle (Sign in / Sign up) with Sign up active.
 * - Display Name + Email + Password + Confirm.
 *
 * TO DO:
 * - Send all these fields to backend; show inline validation messages.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (pw1 !== pw2) {
      setErrorMsg("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await signup({
        username,
        email,
        password: pw1,
        password2: pw2,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const d = err?.details;
      // DRF often returns field dict: { username: ["…"], email: ["…"], password: ["…"] }
      const firstFieldError =
        (Array.isArray(d?.username) && d.username[0]) ||
        (Array.isArray(d?.email) && d.email[0]) ||
        (Array.isArray(d?.password) && d.password[0]) ||
        (Array.isArray(d?.password2) && d.password2[0]) ||
        d?.detail ||
        "Registration failed";
      setErrorMsg(String(firstFieldError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid min-h-[60vh] place-items-center py-12">
      <div className="w-full max-w-md rounded-xl bg-black/5 p-1">
        <div className="rounded-xl bg-white p-6 shadow-card">
          {/* Segmented toggle */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center rounded-md border border-black/10 bg-white p-0.5">
              <Link
                to="/login"
                className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign in
              </Link>
              <div className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[6px] px-4 text-xs font-medium bg-black text-white">
                Sign up
              </div>
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="username"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              First name
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="given-name"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Last name
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="family-name"
              />
            </label>

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
                id="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="new-password"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Confirm password
              <input
                type="password"
                required
                id="confirm-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                autoComplete="new-password"
              />
            </label>

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-70"
              >
                {submitting ? "Creating account..." : "Submit"}
              </button>
            </div>
          </form>

          {errorMsg && <div className="text-red-500">{errorMsg}</div>}
        </div>
      </div>
    </section>
  );
}
