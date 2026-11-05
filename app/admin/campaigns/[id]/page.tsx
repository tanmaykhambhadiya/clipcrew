import { ArrowLeft, Lock, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, EmptyState, Label, PLATFORM_LABELS, PageTitle, Pill, TableWrap, td, th, tr } from "@/components/portal/ui";
import { canAccessCampaign } from "@/lib/portal/guard";
import { compactViews, formatINR, formatViews } from "@/lib/portal/money";
import { can, getMe, isStaff } from "@/lib/portal/session";
import { addDays, currentWeekStart, formatDate, formatWeek } from "@/lib/portal/weeks";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ClipperAdder, DeleteCampaign, RemoveClipperButton, StaffManager } from "../_components/Actions";
import { CampaignForm } from "../_components/CampaignForm";
import { ShareButton } from "../_components/ShareButton";
import { CAMPAIGN_COLUMNS, fetchAll, fetchIn, weeklyViewsFor, type CampaignRow } from "../_lib/data";
import { inviteMessage } from "../_lib/invite";
import { statusTone } from "../_lib/status";

export const dynamic = "force-dynamic";

type Account = { id: string; clipper_id: string; platform: string; username: string; status: "pending" | "verified" | "rejected" };
type Person = { id: string; login_id: string; full_name: string; status?: string };

const accountTone = { verified: "lime", pending: "amber", rejected: "red" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-ink-2 p-5">
      <Label>{label}</Label>
      <p className="mt-2 font-display text-3xl font-bold uppercase leading-none text-cream">{value}</p>
      {sub && <div className="mt-2 text-xs text-muted-dark">{sub}</div>}
    </div>
  );
}

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me || !isStaff(me)) redirect("/login");
  if (!UUID.test(params.id)) notFound();

  const back = (
    <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-lime">
      <ArrowLeft size={15} aria-hidden /> All campaigns
    </Link>
  );

  if (!(await canAccessCampaign(me, params.id))) {
    return (
      <div className="space-y-8">
        {back}
        <EmptyState title="Not your campaign.">You haven&apos;t been assigned to this campaign. Ask the super admin if you need access.</EmptyState>
      </div>
    );
  }

  const db = getSupabaseAdmin();
  const { data: campaignData } = await db.from("campaigns").select(CAMPAIGN_COLUMNS).eq("id", params.id).maybeSingle();
  if (!campaignData) notFound();
  const c = campaignData as CampaignRow;

  const isSuper = me.role === "super_admin";
  const canManage = can(me, "campaigns.manage");

  const [members, links, views, staffRows] = await Promise.all([
    fetchAll<{ clipper_id: string; joined_at: string }>((from, to) =>
      db.from("campaign_clippers").select("clipper_id, joined_at").eq("campaign_id", c.id).order("joined_at").range(from, to),
    ),
    fetchAll<{ account_id: string }>((from, to) =>
      db.from("campaign_accounts").select("account_id").eq("campaign_id", c.id).order("account_id").range(from, to),
    ),
    weeklyViewsFor([c.id]),
    db.from("campaign_staff").select("staff_id").eq("campaign_id", c.id),
  ]);

  const linkedIds = new Set(links.map((l) => l.account_id));
  const accounts = await fetchIn<Account>(
    [...Array.from(linkedIds), ...views.map((v) => v.account_id)],
    (chunk, from, to) => db.from("social_accounts").select("id, clipper_id, platform, username, status").in("id", chunk).order("id").range(from, to),
  );
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const memberIds = new Set(members.map((m) => m.clipper_id));
  const viewClipperIds = views.map((v) => accountById.get(v.account_id)?.clipper_id).filter((x): x is string => !!x);
  const people = await fetchIn<Person>([...Array.from(memberIds), ...viewClipperIds], (chunk, from, to) =>
    db.from("profiles").select("id, login_id, full_name, status").in("id", chunk).order("id").range(from, to),
  );
  const personById = new Map(people.map((p) => [p.id, p]));

  // ---- stats
  const thisWeek = currentWeekStart();
  const lastWeek = addDays(thisWeek, -7);
  let totalViews = 0;
  let totalEarned = 0;
  let thisWeekViews = 0;
  let lastWeekViews = 0;
  const perClipper = new Map<string, { views: number; earned: number }>();
  for (const v of views) {
    totalViews += Number(v.views);
    totalEarned += Number(v.amount_paise);
    if (v.week_start === thisWeek) thisWeekViews += Number(v.views);
    if (v.week_start === lastWeek) lastWeekViews += Number(v.views);
    const owner = accountById.get(v.account_id)?.clipper_id;
    if (!owner) continue;
    const t = perClipper.get(owner) ?? { views: 0, earned: 0 };
    t.views += Number(v.views);
    t.earned += Number(v.amount_paise);
    perClipper.set(owner, t);
  }
  const delta = lastWeekViews > 0 ? Math.round(((thisWeekViews - lastWeekViews) / lastWeekViews) * 100) : null;

  // ---- clipper rows: current members first, then people removed who still have views here
  const linkedByClipper = new Map<string, Account[]>();
  for (const id of Array.from(linkedIds)) {
    const a = accountById.get(id);
    if (!a) continue;
    linkedByClipper.set(a.clipper_id, [...(linkedByClipper.get(a.clipper_id) ?? []), a]);
  }
  const rows = [
    ...members.map((m) => ({ id: m.clipper_id, joinedAt: m.joined_at as string | null, current: true })),
    ...Array.from(perClipper.keys())
      .filter((id) => !memberIds.has(id))
      .map((id) => ({ id, joinedAt: null, current: false })),
  ].map((r) => ({ ...r, person: personById.get(r.id), accounts: linkedByClipper.get(r.id) ?? [], totals: perClipper.get(r.id) ?? { views: 0, earned: 0 } }));

  // ---- staff
  const assignedStaffIds = (staffRows.data ?? []).map((s) => s.staff_id as string);
  let assignedStaff: Person[] = [];
  let availableStaff: Person[] = [];
  if (isSuper) {
    const { data } = await db.from("profiles").select("id, login_id, full_name, status").eq("role", "admin").order("full_name");
    const all = (data ?? []) as Person[];
    assignedStaff = all.filter((s) => assignedStaffIds.includes(s.id));
    availableStaff = all.filter((s) => s.status === "active");
  } else if (assignedStaffIds.length) {
    const { data } = await db.from("profiles").select("id, login_id, full_name").in("id", assignedStaffIds).order("full_name");
    assignedStaff = (data ?? []) as Person[];
  }

  const platformNames = c.allowed_platforms.map((p) => PLATFORM_LABELS[p] ?? p);
  const share = inviteMessage({ name: c.name, platforms: platformNames, rateLabel: formatINR(c.rate_per_million_paise), maxAccounts: c.max_accounts_per_clipper });

  return (
    <div className="space-y-10">
      {back}

      <PageTitle eyebrow={`Campaign · ${c.status}`} line1={c.name} line2={c.client || "In-house campaign."}>
        <ShareButton message={share} />
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-dark">
        <Pill tone={statusTone[c.status]}>{c.status}</Pill>
        <span className="font-mono text-cream">{formatINR(c.rate_per_million_paise)}</span> per 1M views ·
        <span>{platformNames.join(", ")}</span> ·
        <span>up to {c.max_accounts_per_clipper} account{c.max_accounts_per_clipper === 1 ? "" : "s"} each</span>
        {(c.starts_on || c.ends_on) && <span>· {formatDate(c.starts_on)} → {c.ends_on ? formatDate(c.ends_on) : "open"}</span>}
      </div>

      {/* ---- summary */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total views" value={compactViews(totalViews)} sub={formatViews(totalViews)} />
        <Stat label="Earned" value={<span className="text-lime">{formatINR(totalEarned, { decimals: false })}</span>} sub={formatINR(totalEarned)} />
        <Stat label="Clippers" value={members.length} sub={rows.length > members.length ? `+${rows.length - members.length} removed with past views` : "in this campaign"} />
        <Stat label="Linked accounts" value={linkedIds.size} sub="counting towards this campaign" />
        <div className="col-span-2 lg:col-span-1">
          <Stat
            label="This week"
            value={compactViews(thisWeekViews)}
            sub={
              <>
                <span className="block">{formatWeek(thisWeek)}</span>
                <span className="mt-1 inline-flex items-center gap-1">
                  Last week {compactViews(lastWeekViews)}
                  {delta !== null && (
                    <span className={delta >= 0 ? "inline-flex items-center gap-0.5 text-lime" : "inline-flex items-center gap-0.5 text-[#ff8a7a]"}>
                      {delta >= 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />} {delta > 0 ? "+" : ""}{delta}%
                    </span>
                  )}
                </span>
              </>
            }
          />
        </div>
      </section>

      {/* ---- clippers */}
      <section className="space-y-4" aria-labelledby="clippers-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>Crew</Label>
            <h2 id="clippers-h" className="mt-1 font-display text-2xl font-bold uppercase">Clippers</h2>
          </div>
        </div>
        {canManage && <ClipperAdder campaignId={c.id} />}

        {rows.length === 0 ? (
          <EmptyState title="No clippers yet.">
            {canManage ? "Add clippers above — they get a message in their inbox — then share the campaign on WhatsApp." : "Someone with campaign access needs to add clippers."}
          </EmptyState>
        ) : (
          <TableWrap minWidth={820}>
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Clipper</th>
                <th className={th}>Linked accounts</th>
                <th className={`${th} text-right`}>Views</th>
                <th className={`${th} text-right`}>Earned</th>
                {canManage && <th className={`${th} text-right`}><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={tr}>
                  <td className={td}>
                    <p className="font-semibold">{r.person?.full_name ?? "Unknown clipper"}</p>
                    <p className="font-mono text-xs text-muted-dark">{r.person?.login_id}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {!r.current && <Pill tone="grey">removed</Pill>}
                      {r.person?.status === "terminated" && <Pill tone="red">terminated</Pill>}
                      {r.joinedAt && <span className="text-xs text-muted-dark">Joined {formatDate(r.joinedAt)}</span>}
                    </div>
                  </td>
                  <td className={td}>
                    {r.accounts.length === 0 ? (
                      <span className="text-xs text-muted-dark">{r.current ? "No accounts linked yet" : "—"}</span>
                    ) : (
                      <ul className="space-y-1.5">
                        {r.accounts.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-mono">@{a.username}</span>
                            <span className="text-xs text-muted-dark">{PLATFORM_LABELS[a.platform] ?? a.platform}</span>
                            <Pill tone={accountTone[a.status]}>{a.status}</Pill>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.current && r.accounts.length > c.max_accounts_per_clipper && (
                      <p className="mt-1 text-xs text-[#f5c451]">Over the limit of {c.max_accounts_per_clipper}</p>
                    )}
                  </td>
                  <td className={`${td} text-right font-mono`} title={formatViews(r.totals.views)}>{compactViews(r.totals.views)}</td>
                  <td className={`${td} whitespace-nowrap text-right font-mono text-lime`}>{formatINR(r.totals.earned)}</td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      {r.current && <RemoveClipperButton campaignId={c.id} clipperId={r.id} name={r.person?.full_name ?? "this clipper"} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </section>

      {/* ---- details + staff */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <Label>Details</Label>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase">Campaign settings</h2>
          <div className="mt-6">
            {canManage ? (
              <CampaignForm
                canEditRate={isSuper}
                initial={{
                  id: c.id,
                  name: c.name,
                  client: c.client,
                  ratePerMillionPaise: Number(c.rate_per_million_paise),
                  allowedPlatforms: c.allowed_platforms,
                  maxAccountsPerClipper: c.max_accounts_per_clipper,
                  status: c.status,
                  startsOn: c.starts_on,
                  endsOn: c.ends_on,
                }}
              />
            ) : (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-dark">Rate</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-mono"><Lock size={13} aria-hidden /> {formatINR(c.rate_per_million_paise)} per 1M views</dd></div>
                <div><dt className="text-muted-dark">Status</dt><dd className="mt-1"><Pill tone={statusTone[c.status]}>{c.status}</Pill></dd></div>
                <div><dt className="text-muted-dark">Platforms</dt><dd className="mt-1">{platformNames.join(", ")}</dd></div>
                <div><dt className="text-muted-dark">Max accounts per clipper</dt><dd className="mt-1">{c.max_accounts_per_clipper}</dd></div>
                <div><dt className="text-muted-dark">Starts</dt><dd className="mt-1">{formatDate(c.starts_on)}</dd></div>
                <div><dt className="text-muted-dark">Ends</dt><dd className="mt-1">{formatDate(c.ends_on)}</dd></div>
                <p className="text-xs text-muted-dark sm:col-span-2">You can view this campaign but not edit it. Ask the super admin for the &ldquo;campaigns&rdquo; permission.</p>
              </dl>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <Label>Team</Label>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase">Staff on this campaign</h2>
            <p className="mt-2 text-sm text-muted-dark">Assigned staff can see this campaign and work on it with their own permissions.</p>
            <div className="mt-5">
              {isSuper ? (
                <StaffManager campaignId={c.id} assigned={assignedStaff} available={availableStaff} />
              ) : assignedStaff.length ? (
                <ul className="space-y-1.5 text-sm">
                  {assignedStaff.map((s) => (
                    <li key={s.id}>{s.full_name} <span className="font-mono text-xs text-muted-dark">{s.login_id}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-dark">No staff assigned.</p>
              )}
              {!isSuper && <p className="mt-3 text-xs text-muted-dark">Only the super admin can change who&apos;s on the team.</p>}
            </div>
          </Card>

          {isSuper && (
            <Card className="border-[#ff8a7a]/30">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#ff8a7a]">Danger zone</p>
              <h2 className="mt-1 font-display text-2xl font-bold uppercase">Delete campaign</h2>
              <div className="mt-4">
                <DeleteCampaign campaignId={c.id} name={c.name} hasViews={views.length > 0} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
