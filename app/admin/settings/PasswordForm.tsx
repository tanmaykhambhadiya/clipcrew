"use client";

import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { api, type ApiError } from "@/lib/portal/client";
import { ErrorNote, errorText, field, label } from "@/components/portal/ui";
import { Button } from "@/components/ui/Button";

/** 0–4 rough strength score with a hint. */
function strength(pw: string): { score: number; label: string; hint: string } {
  if (!pw) return { score: 0, label: "", hint: "At least 8 characters. Longer is stronger." };
  if (pw.length < 8) return { score: 1, label: "Too short", hint: `${8 - pw.length} more character${pw.length === 7 ? "" : "s"} needed.` };
  let score = 1;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12) score++;
  if (kinds >= 3) score++;
  if (pw.length >= 16 || (kinds === 4 && pw.length >= 10)) score++;
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|qwerty|clipcrew)/i.test(pw)) score = 1;
  score = Math.min(score, 4);
  const labels = ["", "Weak", "Okay", "Good", "Strong"];
  const hint =
    score >= 4
      ? "Nice — that's a strong password."
      : pw.length < 12
        ? "Try 12+ characters — a short phrase works well."
        : "Mix in capitals, numbers or symbols.";
  return { score, label: labels[score], hint };
}

const barTone = ["bg-line", "bg-[#ff8a7a]", "bg-[#f5c451]", "bg-lime/70", "bg-lime"];

export function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const s = strength(form.newPassword);
  const mismatch = form.confirmPassword.length > 0 && form.confirmPassword !== form.newPassword;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setDone(false);
    if (fields[k]) setFields((x) => ({ ...x, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFields({});
    if (form.newPassword.length < 8) return setFields({ newPassword: "At least 8 characters" });
    if (mismatch) return setFields({ confirmPassword: "The two passwords don't match" });
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", json: form });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setDone(true);
    } catch (err) {
      const ae = err as ApiError;
      setFields(ae.fields ?? {});
      setError(ae.message);
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="pw-current" className={label}>
          Current password
        </label>
        <input id="pw-current" type={type} autoComplete="current-password" className={field} value={form.currentPassword} onChange={set("currentPassword")} required />
        {fields.currentPassword && <p className={errorText}>{fields.currentPassword}</p>}
      </div>

      <div>
        <label htmlFor="pw-new" className={label}>
          New password
        </label>
        <input
          id="pw-new"
          type={type}
          autoComplete="new-password"
          className={field}
          value={form.newPassword}
          onChange={set("newPassword")}
          aria-describedby="pw-hint"
          minLength={8}
          required
        />
        <div className="mt-2 flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition", i <= s.score ? barTone[s.score] : "bg-line")} />
          ))}
        </div>
        <p id="pw-hint" className="mt-1.5 text-xs text-muted-dark" aria-live="polite">
          {s.label && <span className="mr-1.5 font-mono uppercase tracking-[0.12em] text-cream">{s.label}</span>}
          {s.hint}
        </p>
        {fields.newPassword && <p className={errorText}>{fields.newPassword}</p>}
      </div>

      <div>
        <label htmlFor="pw-confirm" className={label}>
          Confirm new password
        </label>
        <input id="pw-confirm" type={type} autoComplete="new-password" className={field} value={form.confirmPassword} onChange={set("confirmPassword")} required />
        {(fields.confirmPassword || mismatch) && <p className={errorText}>{fields.confirmPassword || "The two passwords don't match"}</p>}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-dark">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-[#C8F04A]" />
        {show ? <EyeOff size={15} /> : <Eye size={15} />} Show passwords
      </label>

      {error && !Object.values(fields).some(Boolean) && <ErrorNote>{error}</ErrorNote>}
      {done && (
        <p className="flex items-center gap-2 text-sm text-lime" role="status">
          <Check size={16} /> Password changed. Use the new one next time you sign in.
        </p>
      )}

      <Button type="submit" size="sm" disabled={busy || !form.currentPassword || !form.newPassword || !form.confirmPassword}>
        {busy && <LoaderCircle size={16} className="animate-spin" />} Change password
      </Button>
    </form>
  );
}
