import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { can, getMe, isStaff } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Admin — ClipCrew", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!isStaff(me)) redirect("/portal");

  const nav = [
    { href: "/admin", label: "Overview", show: true },
    { href: "/admin/users", label: "Users", show: can(me, "users.create") },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="font-display text-xl font-bold uppercase tracking-wide">
              ClipCrew <span className="font-mono text-[10px] tracking-[0.2em] text-lime">ADMIN</span>
            </Link>
            <nav className="flex gap-1" aria-label="Admin">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 text-sm text-muted-dark transition hover:bg-ink-2 hover:text-lime">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-dark sm:block">
              {me.fullName} · <span className="font-mono text-xs uppercase tracking-[0.14em] text-lime">{me.role.replace("_", " ")}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-10 md:px-8">{children}</main>
    </div>
  );
}
