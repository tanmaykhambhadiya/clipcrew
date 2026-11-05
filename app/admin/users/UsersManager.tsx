"use client";

import { Check, Copy, KeyRound, LoaderCircle, MessageCircle, Plus, ShieldOff, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { PERMISSIONS, type Permission } from "@/lib/portal/permissions";
import { Button } from "@/components/ui/Button";

type User = {
  id: string;
  login_id: string;
  full_name: string;
  role: "super_admin" | "admin" | "clipper";
  status: "active" | "terminated";
  permissions: Permission[];
  phone: string | null;
  created_at: string;
  termination_reason: string | null;
};

const field =
  "w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-sm text-cream placeholder:text-muted-dark/50 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/40";

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { fields: data.fields });
  return data;
}

function Credentials({ loginId, password, onDone }: { loginId: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `ClipCrew login\nLogin ID: ${loginId}\nPassword: ${password}`;
  const shareText = `Your ClipCrew login\nLogin: https://clipcrew.ignitralabs.com/login\nLogin ID: ${loginId}\nPassword: ${password}\nChange your password after signing in (Settings).`;
  return (
    <div className="rounded-2xl border border-lime bg-lime/10 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-lime">Share these now — the password is shown only once</p>
      <p className="mt-3 text-sm">Login ID <span className="ml-2 font-mono text-base font-semibold">{loginId}</span></p>
      <p className="mt-1 text-sm">Password <span className="ml-2 font-mono text-base font-semibold">{password}</span></p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
          className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-lime px-4 py-2 text-sm font-bold text-lime transition hover:bg-lime hover:text-ink"
        >
          <MessageCircle size={15} /> Share on WhatsApp
        </a>
        <button type="button" onClick={onDone} className="rounded-full border border-line px-4 py-2 text-sm text-muted-dark hover:text-cream">
          Done
        </button>
      </div>
    </div>
  );
}

function PermissionChecks({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PERMISSIONS.map((p) => (
        <label key={p.key} className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-dark">
          <input
            type="checkbox"
            checked={value.includes(p.key)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((k) => k !== p.key))}
            className="mt-0.5 h-4 w-4 accent-[#C8F04A]"
          />
          {p.label}
        </label>
      ))}
    </div>
  );
}

export function UsersManager({ isSuper, meId }: { isSuper: boolean; meId: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [creds, setCreds] = useState<{ loginId: string; password: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const [editPerms, setEditPerms] = useState<{ id: string; value: Permission[] } | null>(null);

  // create form
  const [form, setForm] = useState({ loginId: "", fullName: "", role: "clipper" as "clipper" | "admin", password: "", phone: "", upiId: "" });
  const [perms, setPerms] = useState<Permission[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/admin/users");
      setUsers(data.users);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load users.");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      const data = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          loginId: form.loginId,
          fullName: form.fullName,
          role: form.role,
          password: form.password || undefined,
          phone: form.phone || undefined,
          upiId: form.upiId || undefined,
          permissions: form.role === "admin" ? perms : undefined,
        }),
      });
      setCreds({ loginId: data.user.loginId, password: data.password });
      setForm({ loginId: "", fullName: "", role: "clipper", password: "", phone: "", upiId: "" });
      setPerms([]);
      setShowForm(false);
      load();
    } catch (err) {
      const fields = (err as { fields?: Record<string, string> }).fields;
      setFormErrors({ ...(fields ?? {}), form: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function act(user: User, body: Record<string, unknown>, after?: (data: { password?: string }) => void) {
    setBusyId(user.id);
    setRowError("");
    try {
      const data = await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      after?.(data);
      await load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const btn = "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted-dark transition hover:border-lime hover:text-lime disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-lime">{"//"} Users</p>
          <h1 className="mt-3 text-[40px] leading-[1.02] md:text-[56px]">
            <span className="block font-display font-bold uppercase">Logins</span>
            <span className="block font-serif italic text-lime">for your crew.</span>
          </h1>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus size={18} aria-hidden /> {showForm ? "Close" : "Add user"}
        </Button>
      </div>

      {creds && <div className="mt-8"><Credentials {...creds} onDone={() => setCreds(null)} /></div>}

      {showForm && (
        <form onSubmit={create} className="mt-8 space-y-4 rounded-3xl border border-line bg-ink-2 p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="u-login" className="mb-1.5 block text-sm font-medium">Login ID</label>
              <input id="u-login" className={field} value={form.loginId} autoCapitalize="none" spellCheck={false}
                onChange={(e) => setForm({ ...form, loginId: e.target.value.toLowerCase() })} placeholder="e.g. rahul.k" required />
              {formErrors.loginId && <p className="mt-1 text-xs text-[#ff8a7a]">{formErrors.loginId}</p>}
            </div>
            <div>
              <label htmlFor="u-name" className="mb-1.5 block text-sm font-medium">Full name</label>
              <input id="u-name" className={field} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              {formErrors.fullName && <p className="mt-1 text-xs text-[#ff8a7a]">{formErrors.fullName}</p>}
            </div>
            <div>
              <label htmlFor="u-pass" className="mb-1.5 block text-sm font-medium">Password <span className="text-muted-dark">(blank = generate one)</span></label>
              <input id="u-pass" className={field} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" />
              {formErrors.password && <p className="mt-1 text-xs text-[#ff8a7a]">{formErrors.password}</p>}
            </div>
            <div>
              <label htmlFor="u-role" className="mb-1.5 block text-sm font-medium">Role</label>
              <select id="u-role" className={field} value={form.role} disabled={!isSuper}
                onChange={(e) => setForm({ ...form, role: e.target.value as "clipper" | "admin" })}>
                <option value="clipper">Clipper</option>
                {isSuper && <option value="admin">Staff (admin)</option>}
              </select>
            </div>
            <div>
              <label htmlFor="u-phone" className="mb-1.5 block text-sm font-medium">Phone <span className="text-muted-dark">(optional)</span></label>
              <input id="u-phone" className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label htmlFor="u-upi" className="mb-1.5 block text-sm font-medium">UPI ID <span className="text-muted-dark">(optional)</span></label>
              <input id="u-upi" className={field} value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
            </div>
          </div>
          {form.role === "admin" && (
            <div>
              <p className="mb-2 text-sm font-medium">Staff permissions</p>
              <PermissionChecks value={perms} onChange={setPerms} />
            </div>
          )}
          {formErrors.form && <p className="text-sm text-[#ff8a7a]" role="alert">{formErrors.form}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Creating…</> : "Create user"}
          </Button>
        </form>
      )}

      {rowError && <p className="mt-6 text-sm text-[#ff8a7a]" role="alert">{rowError}</p>}
      {loadError && <p className="mt-6 text-sm text-[#ff8a7a]" role="alert">{loadError}</p>}

      <div className="mt-10 overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">
              <th className="px-5 py-4">User</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users === null && !loadError && (
              <tr><td colSpan={4} className="px-5 py-8 text-muted-dark">Loading…</td></tr>
            )}
            {users?.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-muted-dark">No users yet.</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-line/60 align-top last:border-0">
                <td className="px-5 py-4">
                  <p className="font-semibold">{u.full_name}</p>
                  <p className="font-mono text-xs text-muted-dark">{u.login_id}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-lime">{u.role.replace("_", " ")}</span>
                  {u.role === "admin" && (
                    <p className="mt-1 max-w-[260px] text-xs text-muted-dark">
                      {u.permissions.length ? `${u.permissions.length} permission${u.permissions.length > 1 ? "s" : ""}` : "No permissions"}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className={cn("rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
                    u.status === "active" ? "bg-lime/15 text-lime" : "bg-[#ff8a7a]/15 text-[#ff8a7a]")}>
                    {u.status}
                  </span>
                  {u.termination_reason && <p className="mt-1 max-w-[220px] text-xs text-muted-dark">{u.termination_reason}</p>}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    {u.role !== "super_admin" && u.status === "active" && (
                      <button type="button" className={btn} disabled={busyId === u.id}
                        onClick={() => {
                          if (!confirm(`Reset the password for ${u.login_id}?`)) return;
                          act(u, { action: "reset_password" }, (d) => d.password && setCreds({ loginId: u.login_id, password: d.password }));
                        }}>
                        <KeyRound size={13} /> Reset password
                      </button>
                    )}
                    {isSuper && u.role === "admin" && (
                      <button type="button" className={btn} onClick={() => setEditPerms({ id: u.id, value: u.permissions })}>
                        Permissions
                      </button>
                    )}
                    {isSuper && u.role !== "super_admin" && u.id !== meId && (u.status === "active" ? (
                      <button type="button" className={cn(btn, "hover:border-[#ff8a7a] hover:text-[#ff8a7a]")} disabled={busyId === u.id}
                        onClick={() => {
                          const reason = prompt(`Terminate ${u.login_id}? They are signed out and can't log in.\nReason:`);
                          if (reason?.trim()) act(u, { action: "terminate", reason });
                        }}>
                        <ShieldOff size={13} /> Terminate
                      </button>
                    ) : (
                      <button type="button" className={btn} disabled={busyId === u.id} onClick={() => act(u, { action: "reactivate" })}>
                        <UserCheck size={13} /> Reactivate
                      </button>
                    ))}
                  </div>
                  {editPerms?.id === u.id && (
                    <div className="mt-4 rounded-2xl border border-line bg-ink p-4 text-left">
                      <PermissionChecks value={editPerms.value} onChange={(v) => setEditPerms({ id: u.id, value: v })} />
                      <div className="mt-4 flex gap-2">
                        <button type="button" className="rounded-full bg-lime px-4 py-1.5 text-xs font-bold text-ink"
                          onClick={() => act(u, { action: "set_permissions", permissions: editPerms.value }, () => setEditPerms(null))}>
                          Save
                        </button>
                        <button type="button" className={btn} onClick={() => setEditPerms(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
