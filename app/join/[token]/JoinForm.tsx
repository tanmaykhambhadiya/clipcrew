"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiUrl } from "@/lib/apiUrl";

const field =
  "w-full rounded-xl border border-line bg-ink px-4 py-3 text-[15px] text-cream placeholder:text-muted-dark/50 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40";
const errorText = "mt-1 text-xs text-[#ff8a7a]";

/** A login ID suggestion from the name: "Riya Sharma" → "riya.sharma". */
const suggestLogin = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".")
    .slice(0, 30);

export function JoinForm({ token }: { token: string }) {
  const [f, setF] = useState({ fullName: "", loginId: "", phone: "", upiId: "", website: "" });
  const [loginTouched, setLoginTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ loginId: string; password: string; redirect: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/join/${encodeURIComponent(token)}`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrors(data.fields ?? {});
        setError(data.error || "Couldn't create your account. Try again.");
        return;
      }
      setDone({ loginId: data.loginId, password: data.password, redirect: data.redirect });
    } catch {
      setError("Couldn't reach ClipCrew. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const text = `ClipCrew login\nLogin ID: ${done.loginId}\nPassword: ${done.password}`;
    return (
      <div className="mt-7 space-y-4">
        <div className="rounded-2xl border border-lime bg-lime/10 p-5" role="status">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-lime">You&apos;re in. Save your login</p>
          <p className="mt-3 text-sm">
            Login ID <span className="ml-2 font-mono text-base font-semibold">{done.loginId}</span>
          </p>
          <p className="mt-1 text-sm">
            Password <span className="ml-2 font-mono text-base font-semibold">{done.password}</span>
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-lime/60 px-3.5 py-1.5 text-xs text-lime"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy login"}
          </button>
        </div>
        <p className="text-sm text-muted-dark">Take a screenshot or copy it. You can change the password later in Settings.</p>
        <Button type="button" className="w-full" onClick={() => window.location.assign(done.redirect)}>
          Open my portal
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
      <div>
        <label htmlFor="j-name" className="mb-1.5 block text-sm font-medium">
          Full name
        </label>
        <input
          id="j-name"
          className={field}
          autoComplete="name"
          required
          maxLength={80}
          value={f.fullName}
          onChange={(e) => {
            const fullName = e.target.value;
            setF((cur) => ({ ...cur, fullName, loginId: loginTouched ? cur.loginId : suggestLogin(fullName) }));
          }}
        />
        {errors.fullName && <p className={errorText}>{errors.fullName}</p>}
      </div>
      <div>
        <label htmlFor="j-login" className="mb-1.5 block text-sm font-medium">
          Login ID
        </label>
        <input
          id="j-login"
          className={field}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
          maxLength={30}
          value={f.loginId}
          onChange={(e) => {
            setLoginTouched(true);
            setF({ ...f, loginId: e.target.value.toLowerCase() });
          }}
        />
        {errors.loginId ? <p className={errorText}>{errors.loginId}</p> : <p className="mt-1 text-xs text-muted-dark">You sign in with this. Letters, numbers, . _ -</p>}
      </div>
      <div>
        <label htmlFor="j-phone" className="mb-1.5 block text-sm font-medium">
          WhatsApp number
        </label>
        <input
          id="j-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={field}
          placeholder="+91 98765 43210"
          required
          maxLength={20}
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
        {errors.phone && <p className={errorText}>{errors.phone}</p>}
      </div>
      <div>
        <label htmlFor="j-upi" className="mb-1.5 block text-sm font-medium">
          UPI ID for payouts (optional)
        </label>
        <input
          id="j-upi"
          className={field}
          autoCapitalize="none"
          placeholder="name@okbank"
          maxLength={80}
          value={f.upiId}
          onChange={(e) => setF({ ...f, upiId: e.target.value })}
        />
        {errors.upiId && <p className={errorText}>{errors.upiId}</p>}
      </div>
      {/* honeypot: hidden from people, bots fill it in */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="j-website">Website</label>
        <input id="j-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </div>
      {error && !Object.keys(errors).length && (
        <p role="alert" className="text-sm text-[#ff8a7a]">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : null} Create my account
      </Button>
    </form>
  );
}
