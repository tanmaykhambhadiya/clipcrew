import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fail, guard, ok, parseBody } from "@/lib/portal/guard";
import { audit } from "@/lib/portal/session";
import { MAX_ACCOUNTS_PER_CLIPPER, normaliseHandle } from "@/app/portal/accounts/handle";

const PLATFORMS = ["instagram", "youtube", "tiktok", "facebook", "x", "other"] as const;

const createSchema = z.object({
  platform: z.enum(PLATFORMS, { message: "Pick a platform." }),
  handle: z.string().trim().min(1, "Enter your username or profile link.").max(300),
});

// GET /api/portal/accounts — the signed-in clipper's own accounts.
export async function GET() {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { data, error } = await getSupabaseAdmin()
    .from("social_accounts")
    .select("id, platform, username, verify_code, status, verified_at, created_at")
    .eq("clipper_id", g.me.id)
    .order("created_at", { ascending: false });
  if (error) return fail(500, "Couldn't load your accounts.");
  return ok({ accounts: data });
}

// POST /api/portal/accounts — add an account. It waits for staff to type and send a verification code
// (verify_code = "" until then); the clipper puts that code in their bio and staff verify it.
export async function POST(req: Request) {
  const g = await guard({ clipper: true });
  if ("error" in g) return g.error;
  const { me } = g;
  const body = await parseBody(req, createSchema);
  if ("error" in body) return body.error;

  const norm = normaliseHandle(body.data.handle, body.data.platform);
  if ("error" in norm) return fail(400, norm.error, { handle: norm.error });
  const { username } = norm;
  const platform = body.data.platform;

  const supabase = getSupabaseAdmin();
  const { count } = await supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("clipper_id", me.id);
  if ((count ?? 0) >= MAX_ACCOUNTS_PER_CLIPPER) {
    return fail(400, `You can add up to ${MAX_ACCOUNTS_PER_CLIPPER} accounts. Remove one you no longer use first.`);
  }

  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id, clipper_id")
    .eq("platform", platform)
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    const msg =
      existing.clipper_id === me.id
        ? `You've already added @${username}. Check its status in your list.`
        : `@${username} is already registered by someone else. If it's really yours, message your admin.`;
    return fail(409, msg, { handle: msg });
  }

  const { data: created, error } = await supabase
    .from("social_accounts")
    .insert({ clipper_id: me.id, platform, username, verify_code: "" })
    .select("id, platform, username, verify_code, status, verified_at, created_at")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      const msg = `@${username} was just registered by someone else. If it's really yours, message your admin.`;
      return fail(409, msg, { handle: msg });
    }
    console.error("[accounts] insert failed", error);
    return fail(500, "Couldn't add the account. Please try again.");
  }

  await audit(me.id, "ACCOUNT_ADDED", "social_account", created.id, null, { platform, username });
  return ok({ account: created });
}
