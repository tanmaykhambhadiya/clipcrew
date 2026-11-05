"use client";

import { Check, LoaderCircle, ShieldOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/portal/client";
import { errorText, field, smallBtn } from "@/components/portal/ui";

type Status = "pending" | "verified" | "rejected";

export function AccountActions({ id, handle, status, isSuper }: { id: string; handle: string; status: Status; isSuper: boolean }) {
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
            disabled={busy}
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
