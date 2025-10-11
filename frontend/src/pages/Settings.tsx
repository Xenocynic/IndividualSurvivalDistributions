/**
 * SETTINGS (Profile + Password)
 *
 * Purpose:
 * - Protected page for editing the current user's profile and password.
 *
 * Notes:
 * - Reads 'user' from AuthContext to prefill fields.
 * - Calls 'updateProfile({ displayName, email })' and 'updatePassword(current, next)'.
 *   (Both are demo stubs in the current AuthContext; replace with real API calls.)
 * - Two separate forms, so saving profile doesn't affect password flow and vice versa.
 * - Basic inline validation (matching new passwords) before calling updatePassword.
 */

import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export default function Settings() {
  const { user, updateProfile, updatePassword } = useAuth();

  // Prefill from auth.user; keep local form state
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // Change password form state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Save profile info (name + email)
  function saveProfile(e: FormEvent) {
    e.preventDefault();
    updateProfile({ displayName, email });
  }

  // Update password with light checks
  function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      alert("New passwords do not match");
      return;
    }
    updatePassword(currentPw, newPw);
    // Clear fields after success attempt (demo)
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  return (
    <section className="mx-auto max-w-lg space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600">Manage your account information</p>
      </div>

      {/* Profile form */}
      <form
        onSubmit={saveProfile}
        className="rounded-xl bg-white p-6 shadow-card border border-black/10 space-y-4"
      >
        <h2 className="text-base font-semibold">Profile</h2>

        <label className="block text-xs font-medium text-gray-700">
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Save changes
          </button>
        </div>
      </form>

      {/* Change password form */}
      <form
        onSubmit={changePassword}
        className="rounded-xl bg-white p-6 shadow-card border border-black/10 space-y-4"
      >
        <h2 className="text-base font-semibold">Change password</h2>

        <label className="block text-xs font-medium text-gray-700">
          Current password
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            autoComplete="current-password"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          New password
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            autoComplete="new-password"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Confirm new password
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            autoComplete="new-password"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Update password
          </button>
        </div>
      </form>
    </section>
  );
}
