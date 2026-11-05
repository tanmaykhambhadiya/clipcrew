import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/portal/permissions";
import { can, getMe } from "@/lib/portal/session";
import { Card, Label, PageTitle, Pill } from "@/components/portal/ui";
import { PasswordForm } from "./PasswordForm";
import { SharePortal } from "./ShareCards";

export default async function AdminSettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const isSuper = me.role === "super_admin";

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Settings" line1="Your account," line2="your keys." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <Card>
            <Label>Signed in as</Label>
            <p className="mt-3 font-display text-2xl font-bold uppercase">{me.fullName}</p>
            <p className="mt-1 font-mono text-sm text-muted-dark">Login ID · {me.loginId}</p>
            <div className="mt-4">
              <Pill tone="lime">{isSuper ? "Super admin" : "Staff"}</Pill>
            </div>

            <Label className="mt-6">What you can do</Label>
            {isSuper ? (
              <p className="mt-2 text-sm text-muted-dark">Everything — including rates, staff, terminations and waiving fines.</p>
            ) : me.permissions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-dark">No extra permissions yet. Ask the super admin if you need access to something.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm text-muted-dark">
                {PERMISSIONS.filter((p) => can(me, p.key)).map((p) => (
                  <li key={p.key} className="flex gap-2">
                    <span className="text-lime">✓</span> {p.label}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <Label>Share the portal</Label>
            <p className="mb-4 mt-2 text-sm text-muted-dark">Send clippers the sign-in link. Their login ID and password come from the Users page.</p>
            <SharePortal />
          </Card>
        </div>

        <Card>
          <Label>Change password</Label>
          <p className="mb-6 mt-2 text-sm text-muted-dark">You&apos;ll stay signed in here. Use the new password the next time you sign in.</p>
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
