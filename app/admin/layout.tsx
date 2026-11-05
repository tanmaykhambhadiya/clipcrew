import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { NavLinks } from "@/components/portal/NavLinks";
import { can, getMe, isStaff } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Admin — ClipCrew", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!isStaff(me)) redirect("/portal");

  const nav = [
    { href: "/admin", label: "Overview", show: true },
    { href: "/admin/campaigns", label: "Campaigns", show: true }, // staff see the campaigns assigned to them
    { href: "/admin/views", label: "Weekly views", show: can(me, "views.enter") },
    { href: "/admin/accounts", label: "Accounts", show: can(me, "accounts.verify") },
    { href: "/admin/rejections", label: "Notices & fines", show: can(me, "rejections.send") || can(me, "fines.create") || can(me, "campaigns.manage") },
    { href: "/admin/payouts", label: "Payouts", show: can(me, "payouts.manage") },
    { href: "/admin/users", label: "Users", show: can(me, "users.create") },
    { href: "/admin/activity", label: "Activity", show: can(me, "audit.view") },
    { href: "/admin/settings", label: "Settings", show: true },
  ]
    .filter((n) => n.show)
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-5 md:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/admin" className="font-display text-xl font-bold uppercase tracking-wide">
              ClipCrew <span className="font-mono text-[10px] tracking-[0.2em] text-lime">ADMIN</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-muted-dark sm:block">
                {me.fullName} ·{" "}
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-lime">
                  {me.role === "super_admin" ? "super admin" : "staff"}
                </span>
              </span>
              <LogoutButton />
            </div>
          </div>
          <div className="pb-3">
            <NavLinks items={nav} root="/admin" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-10 md:px-8">{children}</main>
    </div>
  );
}
