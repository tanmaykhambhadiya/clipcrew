"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const field =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-[15px] text-cream placeholder:text-muted-dark/50 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40";

export function LoginForm() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't sign in. Try again.");
      window.location.assign(data.redirect); // full load so the new session cookie is picked up everywhere
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-4">
      <div>
        <label htmlFor="loginId" className="mb-1.5 block text-sm font-medium">Login ID</label>
        <input
          id="loginId"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className={field}
        />
      </div>
      {error && <p className="text-sm text-[#ff8a7a]" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Signing in…</> : "Sign in"}
      </Button>
    </form>
  );
}
