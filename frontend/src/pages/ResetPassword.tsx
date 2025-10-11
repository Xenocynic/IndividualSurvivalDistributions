/**
 * RESET PASSWORD (REQUEST)
 *
 * Purpose:
 * - Public page to request a password reset link by email.
 * - On submit, shows a demo alert. Replace with backend call eventually.
 *
 * TO DO:
 * - Add a second page to handle the emailed token (e.g., /reset/confirm?token=...),
 *   with "New Password" + "Confirm" inputs to complete the reset.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

export default function ResetPassword() {
  const [email, setEmail] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: call backend to send reset link
    alert(`Reset link sent to ${email}`);
  }

  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md rounded-xl bg-black/5 p-1">
        <div className="rounded-xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-center text-sm font-semibold">Reset password</h2>
          <form onSubmit={onSubmit} className="space-y-3">
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

            <div className="flex items-center justify-between pt-1">
              <Link to="/login" className="text-xs text-gray-600 hover:underline">
                Back to sign in
              </Link>
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
              >
                Send link
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
