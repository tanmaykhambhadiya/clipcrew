"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { api, type ApiError } from "@/lib/portal/client";
import { ErrorNote, errorText, field, label } from "@/components/portal/ui";
import { Button } from "@/components/ui/Button";

export function ProfileForm({ upiId, phone }: { upiId: string; phone: string }) {
  const [saved, setSaved] = useState({ upiId, phone });
  const [form, setForm] = useState({ upiId, phone });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const dirty = form.upiId.trim() !== saved.upiId || form.phone.trim() !== saved.phone;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setDone(false);
    if (fields[k]) setFields((x) => ({ ...x, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const next = { upiId: form.upiId.trim(), phone: form.phone.trim() };
      await api("/api/account/profile", { method: "PATCH", json: next });
      setSaved(next);
      setForm(next);
      setDone(true);
    } catch (err) {
      const ae = err as ApiError;
      setFields(ae.fields ?? {});
      setError(ae.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="pf-upi" className={label}>
          UPI ID
        </label>
        <input id="pf-upi" className={field} value={form.upiId} onChange={set("upiId")} placeholder="yourname@okaxis" autoComplete="off" spellCheck={false} />
        {fields.upiId ? <p className={errorText}>{fields.upiId}</p> : <p className="mt-1 text-xs text-muted-dark">Payouts are sent here. Double-check it.</p>}
      </div>
      <div>
        <label htmlFor="pf-phone" className={label}>
          Phone (WhatsApp)
        </label>
        <input id="pf-phone" type="tel" inputMode="tel" className={field} value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" autoComplete="tel" />
        {fields.phone && <p className={errorText}>{fields.phone}</p>}
      </div>

      {error && !Object.values(fields).some(Boolean) && <ErrorNote>{error}</ErrorNote>}
      {done && (
        <p className="flex items-center gap-2 text-sm text-lime" role="status">
          <Check size={16} /> Saved.
        </p>
      )}

      <Button type="submit" size="sm" disabled={busy || !dirty}>
        {busy && <LoaderCircle size={16} className="animate-spin" />} Save details
      </Button>
    </form>
  );
}
