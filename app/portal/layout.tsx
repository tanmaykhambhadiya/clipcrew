import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { getMe, getUnreadCount, isStaff } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Your portal — ClipCrew", robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (isStaff(me)) redirect("/admin");

  const unread = await getUnreadCount();

  return (
    <AppShell
      root="/portal"
      items={[
        { href: "/portal", label: "Overview", icon: "overview" },
        { href: "/portal/campaigns", label: "Campaigns", icon: "campaigns" },
        { href: "/portal/submissions", label: "Submissions", icon: "submissions" },
        { href: "/portal/accounts", label: "Accounts", icon: "accounts" },
        { href: "/portal/wallet", label: "Wallet", icon: "wallet" },
        { href: "/portal/inbox", label: "Inbox", icon: "inbox", badge: unread },
        { href: "/portal/settings", label: "Settings", icon: "settings" },
      ]}
      userName={me.fullName}
      userRole="clipper"
      initialCollapsed={cookies().get(SIDEBAR_COOKIE)?.value === "collapsed"}
      mobileExtra={
        <Link
          href="/portal/inbox"
          aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted-dark transition hover:border-lime hover:text-lime"
        >
          <Bell size={18} />
          {!!unread && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-lime" aria-hidden />}
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
