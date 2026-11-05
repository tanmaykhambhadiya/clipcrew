"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-muted-dark transition hover:border-lime hover:text-lime"
    >
      <LogOut size={16} aria-hidden /> Sign out
    </button>
  );
}
