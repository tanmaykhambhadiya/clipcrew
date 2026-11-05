import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, staffCampaignIds } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { istToday } from "@/lib/portal/weeks";
import { balanceOf, clipperIdsForCampaigns, fetchAll, fetchBalances, fetchByIds, indexBy } from "./data";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["views", "payouts", "fines", "clippers"]),
  campaignId: z.uuid().optional(),
});

type Cell = string | number | null | undefined;

/** One CSV cell: numbers stay numbers; text is quoted when needed and defused against spreadsheet formulas. */
function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: Cell[][]): string {
  // BOM so Excel opens it as UTF-8 and shows ₹ correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const rupees = (paise: unknown) => Number(paise ?? 0) / 100;

type Profile = { id: string; full_name: string; login_id: string; phone: string | null; upi_id: string | null; status: string };
type Campaign = { id: string; name: string };

// GET /api/admin/export?type=views|payouts|fines|clippers&campaignId=optional — CSV download (export.data).
export async function GET(req: Request) {
  const g = await guard({ permission: "export.data" });
  if ("error" in g) return g.error;
  const { me } = g;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    campaignId: url.searchParams.get("campaignId") || undefined,
  });
  if (!parsed.success) return fail(400, "Pick what to export: views, payouts, fines or clippers.");
  const { type, campaignId } = parsed.data;

  // Campaigns this export may cover: null = everything (super admin, no filter).
  let scope: string[] | null;
  if (campaignId) {
    if (!(await canAccessCampaign(me, campaignId))) return fail(403, "You don't have access to that campaign.");
    scope = [campaignId];
  } else {
    scope = await staffCampaignIds(me);
  }

  const db = getSupabaseAdmin();
  let header: string[] = [];
  let rows: Cell[][] = [];

  try {
    if (type === "views") {
      header = ["Week", "Campaign", "Clipper", "Login ID", "Platform", "Username", "Views", "Rate (₹ per 1M views)", "Amount (₹)"];
      type V = { campaign_id: string; account_id: string; week_start: string; views: number; rate_per_million_paise: number; amount_paise: number };
      const views =
        scope?.length === 0
          ? []
          : await fetchAll<V>((from, to) => {
              let q = db
                .from("weekly_views")
                .select("campaign_id, account_id, week_start, views, rate_per_million_paise, amount_paise")
                .order("week_start", { ascending: false })
                .order("campaign_id")
                .order("account_id");
              if (scope) q = q.in("campaign_id", scope);
              return q.range(from, to);
            });
      const accounts = indexBy(
        await fetchByIds<{ id: string; clipper_id: string; platform: string; username: string }>(
          "social_accounts",
          "id, clipper_id, platform, username",
          views.map((v) => v.account_id),
        ),
      );
      const campaigns = indexBy(await fetchByIds<Campaign>("campaigns", "id, name", views.map((v) => v.campaign_id)));
      const people = indexBy(
        await fetchByIds<Profile>("profiles", "id, full_name, login_id", Array.from(accounts.values()).map((a) => a.clipper_id)),
      );
      rows = views.map((v) => {
        const a = accounts.get(v.account_id);
        const p = a ? people.get(a.clipper_id) : undefined;
        return [
          v.week_start,
          campaigns.get(v.campaign_id)?.name ?? "",
          p?.full_name ?? "",
          p?.login_id ?? "",
          a?.platform ?? "",
          a?.username ?? "",
          Number(v.views),
          rupees(v.rate_per_million_paise),
          rupees(v.amount_paise),
        ];
      });
    }

    if (type === "payouts") {
      header = ["Paid on", "Clipper", "Login ID", "UPI ID", "Amount (₹)", "Reference", "Note"];
      // Payouts aren't tied to a campaign: staff see payouts of the clippers in their campaigns.
      const clipperIds = await clipperIdsForCampaigns(scope);
      type P = { clipper_id: string; amount_paise: number; paid_on: string; reference: string | null; note: string | null };
      const cols = "clipper_id, amount_paise, paid_on, reference, note";
      const payouts =
        clipperIds === null
          ? await fetchAll<P>((from, to) => db.from("payouts").select(cols).order("paid_on", { ascending: false }).range(from, to))
          : await fetchByIds<P>("payouts", cols, clipperIds, "clipper_id");
      payouts.sort((a, b) => (a.paid_on < b.paid_on ? 1 : a.paid_on > b.paid_on ? -1 : 0));
      const people = indexBy(await fetchByIds<Profile>("profiles", "id, full_name, login_id, upi_id", payouts.map((p) => p.clipper_id)));
      rows = payouts.map((y) => {
        const p = people.get(y.clipper_id);
        return [y.paid_on, p?.full_name ?? "", p?.login_id ?? "", p?.upi_id ?? "", rupees(y.amount_paise), y.reference, y.note];
      });
    }

    if (type === "fines") {
      header = ["Date", "Clipper", "Login ID", "Campaign", "Amount (₹)", "Reason", "Reel link", "Status"];
      type F = { clipper_id: string; campaign_id: string | null; amount_paise: number; reason: string; reel_ref: string | null; created_at: string; waived_at: string | null };
      const fines =
        scope?.length === 0
          ? []
          : await fetchAll<F>((from, to) => {
              let q = db
                .from("fines")
                .select("clipper_id, campaign_id, amount_paise, reason, reel_ref, created_at, waived_at")
                .order("created_at", { ascending: false });
              if (scope) q = q.in("campaign_id", scope);
              return q.range(from, to);
            });
      const people = indexBy(await fetchByIds<Profile>("profiles", "id, full_name, login_id", fines.map((f) => f.clipper_id)));
      const campaigns = indexBy(await fetchByIds<Campaign>("campaigns", "id, name", fines.map((f) => f.campaign_id ?? "")));
      rows = fines.map((f) => {
        const p = people.get(f.clipper_id);
        return [
          istToday(new Date(f.created_at)),
          p?.full_name ?? "",
          p?.login_id ?? "",
          f.campaign_id ? campaigns.get(f.campaign_id)?.name ?? "" : "",
          rupees(f.amount_paise),
          f.reason,
          f.reel_ref,
          f.waived_at ? "Waived" : "Active",
        ];
      });
    }

    if (type === "clippers") {
      header = ["Name", "Login ID", "Phone", "UPI ID", "Status", "Earned (₹)", "Fines (₹)", "Paid (₹)", "Balance (₹)"];
      const clipperIds = await clipperIdsForCampaigns(scope);
      const cols = "id, full_name, login_id, phone, upi_id, status";
      const people =
        clipperIds === null
          ? await fetchAll<Profile>((from, to) => db.from("profiles").select(cols).eq("role", "clipper").order("full_name").range(from, to))
          : (await fetchByIds<Profile & { role: string }>("profiles", `${cols}, role`, clipperIds))
              .filter((p) => p.role === "clipper")
              .sort((a, b) => a.full_name.localeCompare(b.full_name));
      const balances = indexBy(await fetchBalances(clipperIds === null ? null : people.map((p) => p.id)), "clipper_id");
      rows = people.map((p) => {
        const b = balances.get(p.id);
        return [
          p.full_name,
          p.login_id,
          p.phone,
          p.upi_id,
          p.status,
          rupees(b?.earned_paise),
          rupees(b?.fines_paise),
          rupees(b?.paid_paise),
          rupees(balanceOf(b)),
        ];
      });
    }
  } catch (e) {
    console.error("[export] failed", e);
    return fail(500, "Couldn't build the export. Please try again.");
  }

  await audit(me.id, "DATA_EXPORTED", "export", campaignId ?? null, null, { type, campaignId: campaignId ?? null, rows: rows.length });

  const filename = `clipcrew-${type}${campaignId ? "-campaign" : ""}-${istToday()}.csv`;
  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
