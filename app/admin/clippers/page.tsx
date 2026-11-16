import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { formatINR } from "@/lib/portal/money";
import { can, getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import { formatDate } from "@/lib/portal/weeks";
import { EmptyState, PageTitle, Pill, TableWrap, field, smallBtn, td, th, tr } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

type ClipperRow = {
  id: string;
  full_name: string;
  login_id: string;
  status: "active" | "terminated";
  phone: string | null;
  upi_id: string | null;
  accounts_verified: number;
  accounts_pending: number;
  campaigns: number;
  submissions_pending: number;
  balance_paise: number;
  last_login: string | null;
};

export default async function ClippersPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const me = await getMe();
  if (!me || !can(me, "users.create")) redirect("/admin");

  const q = (searchParams.q ?? "").slice(0, 60);
  const status = searchParams.status === "active" || searchParams.status === "terminated" ? searchParams.status : "";
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  const data = await pageApi<{ clippers: ClipperRow[]; truncated: boolean; scoped: boolean }>(`/api/pages/admin/clippers?${qs}`);
  const filtered = !!(q || status);

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Clippers" line1="Your crew," line2="one profile each." />
      {data.scoped && <p className="text-sm text-muted-dark">You see clippers who are in campaigns you work on.</p>}

      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <div className="relative flex-1">
          <label htmlFor="cq" className="sr-only">Search clippers</label>
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-dark" aria-hidden />
          <input id="cq" name="q" defaultValue={q} className={`${field} pl-9`} placeholder="Name, login ID, phone or UPI" />
        </div>
        <label htmlFor="cs" className="sr-only">Status</label>
        <select id="cs" name="status" defaultValue={status} className={`${field} sm:w-44`}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="terminated">Terminated</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className={smallBtn}>Filter</button>
          {filtered && <Link href="/admin/clippers" className={smallBtn}>Clear</Link>}
        </div>
      </form>

      {data.clippers.length === 0 ? (
        <EmptyState title={filtered ? "Nothing matches." : "No clippers yet."}>
          {filtered ? "Try another search." : "Create clipper logins on the Users page — they show up here."}
        </EmptyState>
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-dark">{data.clippers.length} clipper{data.clippers.length === 1 ? "" : "s"}</p>
          <TableWrap minWidth={980}>
            <thead>
              <tr className={tr}>
                <th className={th}>Clipper</th>
                <th className={th}>Status</th>
                <th className={th}>Accounts</th>
                <th className={`${th} text-right`}>Campaigns</th>
                <th className={`${th} text-right`}>To review</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={th}>Last login</th>
              </tr>
            </thead>
            <tbody>
              {data.clippers.map((c) => (
                <tr key={c.id} className={`${tr} transition hover:bg-ink-2/60`}>
                  <td className={td}>
                    <Link href={`/admin/clippers/${c.id}`} className="font-semibold text-cream underline-offset-4 hover:text-lime hover:underline">{c.full_name}</Link>
                    <p className="font-mono text-xs text-muted-dark">{c.login_id}</p>
                  </td>
                  <td className={td}><Pill tone={c.status === "active" ? "lime" : "red"}>{c.status}</Pill></td>
                  <td className={`${td} text-xs`}>
                    <span className="text-cream">{c.accounts_verified} verified</span>
                    {c.accounts_pending > 0 && <span className="ml-2 text-[#f5c451]">{c.accounts_pending} pending</span>}
                    {!c.upi_id && <p className="mt-1 text-muted-dark">No UPI ID</p>}
                  </td>
                  <td className={`${td} text-right font-mono`}>{c.campaigns}</td>
                  <td className={`${td} text-right font-mono`}>{c.submissions_pending > 0 ? <span className="text-[#f5c451]">{c.submissions_pending}</span> : "—"}</td>
                  <td className={`${td} whitespace-nowrap text-right font-mono ${Number(c.balance_paise) > 0 ? "text-lime" : ""}`}>{formatINR(c.balance_paise)}</td>
                  <td className={`${td} whitespace-nowrap text-xs text-muted-dark`}>{c.last_login ? formatDate(c.last_login) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {data.truncated && <p className="text-xs text-muted-dark">Showing the first 300. Use search to narrow it down.</p>}
        </>
      )}
    </div>
  );
}
