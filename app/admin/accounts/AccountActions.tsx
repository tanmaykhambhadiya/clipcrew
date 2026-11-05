"use client";

import { Check, LoaderCircle, Send, ShieldOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/portal/client";
import { errorText, field, smallBtn } from "@/components/portal/ui";

type Status = "pending" | "verified" | "rejected";

/** Staff type the verification code here and send it to the clipper's inbox. */
export function CodeCell({ id, code, status }: { id: string; code: string; status: Status }) {
  const router = useRouter();
  const [value, setValue] = useState(code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (status !== "pending") {
    return code ? (
      <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-sm tracking-wider text-cream">{code}</span>
    ) : (
      <span className="text-xs text-muted-dark">—</span>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);
    try {
      await api(`/api/admin/accounts/${id}`, { method: "PATCH", json: { action: "set_code", code: value.trim() } });
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  }

  const changed = value.trim() !== code;
  return (
    <form onSubmit={submit} className="w-[200px] space-y-1.5">
      <label htmlFor={`code-${id}`} className="sr-only">
        Verification code
      </label>
      <input
        id={`code-${id}`}
        className={`${field} font-mono tracking-wider`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSent(false);
        }}
        placeholder="Type a code"
        maxLength={30}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className={`${smallBtn} border-lime/60 text-lime`} disabled={busy || value.trim().length < 3 || !changed}>
        {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />} {code ? "Update & resend" : "Send code"}
      </button>
      {!code && !sent && <p className="text-xs text-[#f5c451]">Waiting for a code</p>}
      {sent && <p className="text-xs text-lime">Sent to the clipper&apos;s inbox.</p>}
      {error && <p className={errorText}>{error}</p>}
    </form>
  );
}

export function AccountActions({ id, handle, status, isSuper, hasCode }: { id: string; handle: string; status: Status; isSuper: boolean; hasCode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reasonFor, setReasonFor] = useState<"reject" | "revoke" | null>(null);
  const [reason, setReason] = useState("");

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/accounts/${id}`, { method: "PATCH", json: body });
      setReasonFor(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function submitReason(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Give the clipper a reason.");
      return;
    }
    if (reasonFor === "revoke" && !window.confirm(`Revoke ${handle}? It stops counting toward campaigns that have no views yet.`)) return;
    send({ action: reasonFor, reason: reason.trim() });
  }

  if (reasonFor) {
    return (
      <form onSubmit={submitReason} className="ml-auto w-full min-w-[220px] max-w-[280px] space-y-2 text-left">
        <label htmlFor={`reason-${id}`} className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
          {reasonFor === "reject" ? "Why reject?" : "Why revoke?"}
        </label>
        <textarea
          id={`reason-${id}`}
          className={field}
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Code not found in bio"
          autoFocus
          onKeyDown={(e) => e.key === "Escape" && setReasonFor(null)}
        />
        {error && <p className={errorText}>{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={smallBtn} onClick={() => setReasonFor(null)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={`${smallBtn} border-[#ff8a7a]/60 text-[#ff8a7a] hover:border-[#ff8a7a] hover:text-[#ff8a7a]`} disabled={busy}>
            {busy && <LoaderCircle size={13} className="animate-spin" />} {reasonFor === "reject" ? "Reject" : "Revoke"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "verified" && (
          <button
            type="button"
            className={`${smallBtn} border-lime/60 text-lime`}
            disabled={busy || !hasCode}
            title={hasCode ? undefined : "Send the clipper a code first"}
            onClick={() => {
              if (status === "rejected" && !window.confirm(`${handle} was rejected before. Verify it now?`)) return;
              send({ action: "verify" });
            }}
          >
            {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Verify
          </button>
        )}
        {status === "pending" && (
          <button type="button" className={smallBtn} disabled={busy} onClick={() => setReasonFor("reject")}>
            <X size={13} /> Reject
          </button>
        )}
        {status === "verified" && isSuper && (
          <button type="button" className={smallBtn} disabled={busy} onClick={() => setReasonFor("revoke")}>
            <ShieldOff size={13} /> Revoke
          </button>
        )}
      </div>
      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
