"use client";

import { Check, Copy, KeyRound, LoaderCircle, MessageCircle, Pencil, Send, ShieldOff, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type ApiError } from "@/lib/portal/client";
import { Card, ErrorNote, Label, errorText, field, label, smallBtn } from "@/components/portal/ui";

type Props = {
  id: string;
  loginId: string;
  fullName: string;
  phone: string;
  upiId: string;
  status: "active" | "terminated";
  can: { terminate: boolean; editProfile: boolean; notices: boolean };
};

const PORTAL = "https://clipcrew.ignitralabs.com/login";

/** Quick actions on one clipper: edit details, reset password, message, terminate/reactivate. */
export function ClipperActions({ id, loginId, fullName, phone, upiId, status, can }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "edit" | "message">("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [creds, setCreds] = useState<{ password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState("");
  const [form, setForm] = useState({ fullName, phone, upiId });
  const [msg, setMsg] = useState({ title: "", body: "" });

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    setFields({});
    setDone("");
    try {
      await fn();
    } catch (e) {
      const err = e as ApiError;
      setFields(err.fields ?? {});
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const credText = (password: string) => `Your ClipCrew login\nLogin: ${PORTAL}\nLogin ID: ${loginId}\nPassword: ${password}\nChange your password after signing in (Settings).`;

  return (
    <Card>
      <Label>Quick actions</Label>
      <div className="mt-4 flex flex-wrap gap-2">
        {can.editProfile && (
          <button type="button" className={smallBtn} onClick={() => setMode(mode === "edit" ? "" : "edit")}>
            <Pencil size={13} /> Edit details
          </button>
        )}
        {status === "active" && (
          <button
            type="button"
            className={smallBtn}
            disabled={busy === "reset"}
            onClick={() => {
              if (!window.confirm(`Reset the password for ${loginId}? Their current sessions are signed out.`)) return;
              run("reset", async () => {
                const r = await api<{ password: string }>(`/api/admin/users/${id}`, { method: "PATCH", json: { action: "reset_password" } });
                setCreds({ password: r.password });
              });
            }}
          >
            {busy === "reset" ? <LoaderCircle size={13} className="animate-spin" /> : <KeyRound size={13} />} Reset password
          </button>
        )}
        {can.notices && status === "active" && (
          <button type="button" className={smallBtn} onClick={() => setMode(mode === "message" ? "" : "message")}>
            <Send size={13} /> Send message
          </button>
        )}
        {can.terminate &&
          (status === "active" ? (
            <button
              type="button"
              className={`${smallBtn} hover:border-[#ff8a7a] hover:text-[#ff8a7a]`}
              disabled={busy === "terminate"}
              onClick={() => {
                const reason = window.prompt(`Terminate ${loginId}? They are signed out and can't log in.\nReason:`);
                if (!reason?.trim()) return;
                run("terminate", async () => {
                  await api(`/api/admin/users/${id}`, { method: "PATCH", json: { action: "terminate", reason } });
                  router.refresh();
                });
              }}
            >
              {busy === "terminate" ? <LoaderCircle size={13} className="animate-spin" /> : <ShieldOff size={13} />} Terminate
            </button>
          ) : (
            <button
              type="button"
              className={smallBtn}
              disabled={busy === "reactivate"}
              onClick={() =>
                run("reactivate", async () => {
                  await api(`/api/admin/users/${id}`, { method: "PATCH", json: { action: "reactivate" } });
                  router.refresh();
                })
              }
            >
              {busy === "reactivate" ? <LoaderCircle size={13} className="animate-spin" /> : <UserCheck size={13} />} Reactivate
            </button>
          ))}
      </div>

      <ErrorNote>{!Object.keys(fields).length ? error : ""}</ErrorNote>
      {done && <p className="mt-3 text-sm text-lime" role="status">{done}</p>}

      {creds && (
        <div className="mt-4 rounded-2xl border border-lime bg-lime/10 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-lime">New password — shown only once</p>
          <p className="mt-2 text-sm">Login ID <span className="ml-2 font-mono font-semibold">{loginId}</span></p>
          <p className="mt-1 text-sm">Password <span className="ml-2 font-mono font-semibold">{creds.password}</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`${smallBtn} border-lime/60 text-lime`}
              onClick={() => navigator.clipboard.writeText(credText(creds.password)).then(() => setCopied(true))}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <a className={smallBtn} href={`https://wa.me/?text=${encodeURIComponent(credText(creds.password))}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={13} /> Share on WhatsApp
            </a>
            <button type="button" className={smallBtn} onClick={() => setCreds(null)}>Done</button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("edit", async () => {
              await api(`/api/admin/users/${id}`, { method: "PATCH", json: { action: "update_profile", fullName: form.fullName, phone: form.phone, upiId: form.upiId } });
              setMode("");
              setDone("Details saved.");
              router.refresh();
            });
          }}
        >
          <div>
            <label htmlFor="e-name" className={label}>Name</label>
            <input id="e-name" className={field} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            {fields.fullName && <p className={errorText}>{fields.fullName}</p>}
          </div>
          <div>
            <label htmlFor="e-phone" className={label}>Phone</label>
            <input id="e-phone" className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="e-upi" className={label}>UPI ID</label>
            <input id="e-upi" className={field} value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className={`${smallBtn} border-lime/60 text-lime`} disabled={busy === "edit"}>
              {busy === "edit" && <LoaderCircle size={13} className="animate-spin" />} Save
            </button>
            <button type="button" className={smallBtn} onClick={() => setMode("")}>Cancel</button>
          </div>
        </form>
      )}

      {mode === "message" && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("message", async () => {
              await api("/api/admin/notices", { method: "POST", json: { audience: { type: "clippers", clipperIds: [id] }, title: msg.title, body: msg.body, link: "" } });
              setMsg({ title: "", body: "" });
              setMode("");
              setDone("Message sent to their inbox.");
            });
          }}
        >
          <div>
            <label htmlFor="m-title" className={label}>Title</label>
            <input id="m-title" className={field} value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} maxLength={120} />
            {fields.title && <p className={errorText}>{fields.title}</p>}
          </div>
          <div>
            <label htmlFor="m-body" className={label}>Message to {fullName}</label>
            <textarea id="m-body" className={field} rows={3} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} maxLength={2000} />
            {fields.body && <p className={errorText}>{fields.body}</p>}
          </div>
          <div className="flex gap-2">
            <button type="submit" className={`${smallBtn} border-lime/60 text-lime`} disabled={busy === "message" || !msg.title.trim() || !msg.body.trim()}>
              {busy === "message" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />} Send
            </button>
            <button type="button" className={smallBtn} onClick={() => setMode("")}>Cancel</button>
          </div>
        </form>
      )}
    </Card>
  );
}
