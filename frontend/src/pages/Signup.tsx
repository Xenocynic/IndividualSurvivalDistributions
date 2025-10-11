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
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState("");       // kept for future profile stuff
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw1 !== pw2) return alert("Passwords do not match");
    // TODO: real API call (include name + email + password)
    signup(email);
  }

  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md rounded-xl bg-black/5 p-1">
        <div className="rounded-xl bg-white p-6 shadow-card">
          {/* Segmented toggle (Sign up active) */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <Link to="/login" className="h-8 rounded-md border border-black/10 px-3 text-xs hover:bg-gray-50">
              Sign in
            </Link>
            <button className="h-8 rounded-md bg-black px-3 text-xs font-medium text-white">
              Sign up
            </button>
          </div>

          {/* Sign-up form */}
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">
              Display Name
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
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
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Password
              <input
                type="password"
                required
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Confirm password
              <input
                type="password"
                required
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>

            <div className="flex items-center justify-end pt-1">
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
