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

import React, { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function Settings() {
  const { user, loading, updateProfile, updatePassword, refreshProfile, logout } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");

  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setEmail(user.email ?? "");
    } else {
      // attempt to load if not present (e.g., after refresh)
      refreshProfile().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, email });
      setMsg("Profile updated.");
    } catch (err: any) {
      setMsg(err?.details ? JSON.stringify(err.details) : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwd1.length < 8) {
      setPwMsg("Password must be at least 8 characters.");
      return;
    }
    if (pwd1 !== pwd2) {
      setPwMsg("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    try {
      await updatePassword(pwd1);
      setPwMsg("Password updated.");
      setPwd1("");
      setPwd2("");
      // Optional: log out to enforce re-login
      // await logout();
    } catch (err: any) {
      setPwMsg(err?.details ? JSON.stringify(err.details) : "Failed to update password.");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading && !user) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <form onSubmit={onSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-gray-700">
              First name
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Last name
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-4 py-2 bg-gray-500 text-white border border-black/10 shadow-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {msg && <p className="text-sm">{msg}</p>}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Change password</h2>
        <form onSubmit={onChangePassword} className="space-y-4">
          <label className="block text-xs font-medium text-gray-700">
            New password
            <input
              type="password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Confirm new password
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-md px-4 py-2 bg-gray-500 text-white border border-black/10 shadow-sm disabled:opacity-60"
            >
              {pwSaving ? "Updating…" : "Update password"}
            </button>
            {pwMsg && <p className="text-sm">{pwMsg}</p>}
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <button
          onClick={() => logout()}
          className="rounded-md px-4 py-2 bg-black text-white border border-black/10 shadow-sm"
        >
          Log out
        </button>
      </section>
    </div>
  );
}
