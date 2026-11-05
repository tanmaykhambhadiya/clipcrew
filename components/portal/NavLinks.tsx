"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; badge?: number };

/** Horizontal tab nav; scrolls sideways on small screens. Active = exact match for the root, prefix otherwise. */
export function NavLinks({ items, root }: { items: NavItem[]; root: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Sections" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((n) => {
          const active = n.href === root ? path === root : path === n.href || path.startsWith(`${n.href}/`);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                  active ? "bg-lime font-semibold text-ink" : "text-muted-dark hover:bg-ink-2 hover:text-lime",
                )}
              >
                {n.label}
                {!!n.badge && (
                  <span className={cn("rounded-full px-1.5 font-mono text-[10px]", active ? "bg-ink text-lime" : "bg-lime text-ink")}>
                    {n.badge > 99 ? "99+" : n.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
