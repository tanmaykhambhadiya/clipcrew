import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell, type ShellItem } from "@/components/portal/AppShell";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { can, getMe, isStaff } from "@/lib/portal/session";
import { getNavCounts } from "@/lib/portal/navCounts";

export const metadata: Metadata = { title: "Admin — ClipCrew", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!isStaff(me)) redirect("/portal");

  const counts = await getNavCounts(); // menu badges; shows none if the numbers can't load

  const nav: (ShellItem & { show: boolean })[] = [
    { href: "/admin", label: "Overview", icon: "overview", show: true },
    { href: "/admin/campaigns", label: "Campaigns", icon: "campaigns", show: true }, // staff see the campaigns assigned to them
    { href: "/admin/views", label: "Weekly views", icon: "views", show: can(me, "views.enter") },
    { href: "/admin/submissions", label: "Submissions", icon: "submissions", show: can(me, "submissions.review"), badge: counts.pendingSubmissions },
    { href: "/admin/accounts", label: "Accounts", icon: "accounts", show: can(me, "accounts.verify"), badge: counts.pendingAccounts },
    { href: "/admin/clippers", label: "Clippers", icon: "clippers", show: can(me, "users.create") },
    { href: "/admin/notices", label: "Notices", icon: "notices", show: can(me, "campaigns.manage") },
    { href: "/admin/rejections", label: "Rejections & fines", icon: "rejections", show: can(me, "rejections.send") || can(me, "fines.create") },
    { href: "/admin/payouts", label: "Payouts", icon: "payouts", show: can(me, "payouts.manage") },
    { href: "/admin/users", label: "Users", icon: "users", show: can(me, "users.create") },
    { href: "/admin/invites", label: "Invite links", icon: "invites", show: me.role === "super_admin" },
    { href: "/admin/activity", label: "Activity", icon: "activity", show: can(me, "audit.view") },
    { href: "/admin/settings", label: "Settings", icon: "settings", show: true },
  ];

  return (
    <AppShell
      root="/admin"
      brandTag="ADMIN"
      items={nav.filter((n) => n.show).map((n) => ({ href: n.href, label: n.label, icon: n.icon, badge: n.badge }))}
      userName={me.fullName}
      userRole={me.role === "super_admin" ? "super admin" : "staff"}
      initialCollapsed={cookies().get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}
