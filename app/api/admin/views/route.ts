import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canAccessCampaign, fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { amountForViews } from "@/lib/portal/money";
import { audit, type Me } from "@/lib/portal/session";
import { currentWeekStart, isMonday } from "@/lib/portal/weeks";
import { loadCampaign, loadGrid } from "@/app/admin/views/data";

// Weekly views entry. Earnings are always calculated here from views × rate — never typed.

const MAX_VIEWS = 1_000_000_000_000;

const weekSchema = z
  .string()
  .refine(isMonday, "The week must start on a Monday.")
  .refine((w) => w <= currentWeekStart(), "You can't enter views for a future week.");

const saveSchema = z.object({
  campaignId: z.uuid("Pick a campaign."),
  weekStart: weekSchema,
  rows: z
    .array(
      z.object({
        accountId: z.uuid(),
        views: z
          .number("Views must be a number.")
          .int("Views must be a whole number.")
          .min(0, "Views can't be negative.")
          .max(MAX_VIEWS, "That's more than 1 trillion views — please check the number."),
      }),
    )
    .min(1, "Nothing to save.")
    .max(2000, "Too many rows in one save."),
});

const clearSchema = z.object({
  campaignId: z.uuid(),
  weekStart: weekSchema,
  accountId: z.uuid(),
});

async function checkCampaign(me: Me, campaignId: string) {
  if (!(await canAccessCampaign(me, campaignId))) return { error: fail(403, "You're not assigned to this campaign.") };
  const campaign = await loadCampaign(campaignId);
  if (!campaign) return { error: fail(404, "That campaign no longer exists.") };
  return { campaign };
}

// GET /api/admin/views?campaign=<id>&week=<YYYY-MM-DD> — the grid for one campaign + week.
export async function GET(req: Request) {
  const g = await guard({ permission: "views.enter" });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign") ?? "";
  const week = weekSchema.safeParse(url.searchParams.get("week") ?? "");
  if (!z.uuid().safeParse(campaignId).success) return fail(400, "Pick a campaign.");
  if (!week.success) return fail(400, week.error.issues[0]?.message ?? "Pick a valid week.");

  const c = await checkCampaign(g.me, campaignId);
  if ("error" in c) return c.error;
  try {
    return ok({ grid: await loadGrid(c.campaign, week.data) });
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Couldn't load the views.");
  }
}

// POST /api/admin/views — upsert changed rows for one campaign + week.
export async function POST(req: Request) {
  const g = await guard({ permission: "views.enter" });
  if ("error" in g) return g.error;
  const { me } = g;
  const body = await parseBody(req, saveSchema);
  if ("error" in body) return body.error;
  const { campaignId, weekStart, rows } = body.data;

  const ids = rows.map((r) => r.accountId);
  if (new Set(ids).size !== ids.length) return fail(400, "The same account appears twice in this save.");

  const c = await checkCampaign(me, campaignId);
  if ("error" in c) return c.error;
  const { campaign } = c;

  const db = getSupabaseAdmin();

  // Every account must be linked to this campaign right now.
  const { data: links, error: linkErr } = await db
    .from("campaign_accounts")
    .select("account_id")
    .eq("campaign_id", campaignId)
    .in("account_id", ids);
  if (linkErr) return fail(500, "Couldn't check the linked accounts.");
  const linked = new Set((links ?? []).map((l) => l.account_id as string));
  const unlinked = ids.filter((id) => !linked.has(id));
  if (unlinked.length) {
    return fail(400, `${unlinked.length} account${unlinked.length === 1 ? " is" : "s are"} not linked to this campaign any more. Reload and try again.`);
  }

  const { data: existing, error: exErr } = await db
    .from("weekly_views")
    .select("account_id, views, rate_per_million_paise, amount_paise")
    .eq("campaign_id", campaignId)
    .eq("week_start", weekStart)
    .in("account_id", ids);
  if (exErr) return fail(500, "Couldn't load the saved views.");
  const before = new Map((existing ?? []).map((e) => [e.account_id as string, e]));

  // A new entry needs a verified account; saved rows on a since-revoked account can still be corrected.
  const fresh = ids.filter((id) => !before.has(id));
  if (fresh.length) {
    const { data: accs, error: accErr } = await db.from("social_accounts").select("id, status").in("id", fresh);
    if (accErr) return fail(500, "Couldn't check the accounts.");
    const notVerified = fresh.filter((id) => (accs ?? []).find((a) => a.id === id)?.status !== "verified");
    if (notVerified.length) {
      return fail(400, `${notVerified.length} account${notVerified.length === 1 ? " isn't" : "s aren't"} verified, so views can't be added. Reload and try again.`);
    }
  }

  const now = new Date().toISOString();
  const changes: { accountId: string; before: number | null; after: number; amountPaise: number }[] = [];
  const upserts = [];
  for (const r of rows) {
    const prev = before.get(r.accountId);
    if (prev && Number(prev.views) === r.views) continue; // unchanged
    // Existing rows keep the rate they were first saved with; new rows use the campaign's current rate.
    const rate = prev ? Number(prev.rate_per_million_paise) : campaign.ratePerMillionPaise;
    const amount = amountForViews(r.views, rate);
    upserts.push({
      campaign_id: campaignId,
      account_id: r.accountId,
      week_start: weekStart,
      views: r.views,
      rate_per_million_paise: rate,
      amount_paise: amount,
      entered_by: me.id,
      updated_at: now,
    });
    changes.push({ accountId: r.accountId, before: prev ? Number(prev.views) : null, after: r.views, amountPaise: amount });
  }

  if (upserts.length) {
    const { error } = await db.from("weekly_views").upsert(upserts, { onConflict: "campaign_id,account_id,week_start" });
    if (error) {
      console.error("[views] upsert failed", error);
      return fail(500, "Couldn't save the views. Nothing was changed — please try again.");
    }
    await audit(me.id, "VIEWS_SET", "campaign", campaignId, null, { weekStart, changes });
  }

  try {
    return ok({ saved: upserts.length, grid: await loadGrid(campaign, weekStart) });
  } catch {
    return ok({ saved: upserts.length });
  }
}

// DELETE /api/admin/views — super admin only: remove one saved row.
export async function DELETE(req: Request) {
  const g = await guard({ superAdmin: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const body = await parseBody(req, clearSchema);
  if ("error" in body) return body.error;
  const { campaignId, weekStart, accountId } = body.data;

  const campaign = await loadCampaign(campaignId);
  if (!campaign) return fail(404, "That campaign no longer exists.");

  const db = getSupabaseAdmin();
  const { data: row } = await db
    .from("weekly_views")
    .select("id, views, rate_per_million_paise, amount_paise, entered_by, updated_at")
    .eq("campaign_id", campaignId)
    .eq("account_id", accountId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!row) return fail(404, "There's no saved entry for that account this week.");

  const { error } = await db.from("weekly_views").delete().eq("id", row.id);
  if (error) return fail(500, "Couldn't clear the entry.");
  await audit(me.id, "VIEWS_CLEARED", "weekly_views", row.id, { campaignId, accountId, weekStart, ...row }, null);

  try {
    return ok({ grid: await loadGrid(campaign, weekStart) });
  } catch {
    return ok({});
  }
}
