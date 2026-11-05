import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { NavLinks } from "@/components/portal/NavLinks";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMe, isStaff } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Your portal — ClipCrew", robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (isStaff(me)) redirect("/admin");

  const { count: unread } = await getSupabaseAdmin()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("clipper_id", me.id)
    .is("read_at", null);

  const nav = [
    { href: "/portal", label: "Overview" },
    { href: "/portal/campaigns", label: "Campaigns" },
    { href: "/portal/accounts", label: "Accounts" },
    { href: "/portal/wallet", label: "Wallet" },
    { href: "/portal/inbox", label: "Inbox", badge: unread ?? 0 },
    { href: "/portal/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/portal" className="font-display text-xl font-bold uppercase tracking-wide">
              ClipCrew
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/portal/inbox"
                aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
                className="relative grid h-10 w-10 place-items-center rounded-full border border-line text-muted-dark transition hover:border-lime hover:text-lime"
              >
                <Bell size={18} />
                {!!unread && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-lime" aria-hidden />}
              </Link>
              <span className="hidden text-sm text-muted-dark sm:block">{me.fullName}</span>
              <LogoutButton />
            </div>
          </div>
          <div className="pb-3">
            <NavLinks items={nav} root="/portal" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-10 md:px-8">{children}</main>
    </div>
  );
}
