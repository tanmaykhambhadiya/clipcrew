import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/portal/session";
import { formatINR, formatViews } from "@/lib/portal/money";
import { Card, EmptyState, ErrorNote, Label, PageTitle } from "@/components/portal/ui";
import { loadClipperCampaigns } from "./data";
import { CampaignCard } from "./CampaignCard";

export const dynamic = "force-dynamic";

export default async function PortalCampaignsPage() {
  const me = await getMe();
  if (!me || me.role !== "clipper") redirect("/login");

  const { campaigns, accounts, error } = await loadClipperCampaigns(me.id);
  const verified = accounts.filter((a) => a.status === "verified");
  const totalViews = campaigns.reduce((s, c) => s + c.views, 0);
  const totalEarned = campaigns.reduce((s, c) => s + c.earned_paise, 0);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Campaigns" line1="Your campaigns" line2="clip it, count it, cash it." />

      <ErrorNote>{error}</ErrorNote>

      {!error && campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet">
          Your admin adds you to campaigns. Meanwhile, make sure your accounts are added and verified on the{" "}
          <Link href="/portal/accounts" className="text-lime underline-offset-4 hover:underline">
            Accounts
          </Link>{" "}
          page so you&apos;re ready to go.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 md:p-6">
              <Label>Active campaigns</Label>
              <p className="mt-2 font-display text-4xl font-bold">{activeCount}</p>
            </Card>
            <Card className="p-5 md:p-6">
              <Label>Views counted</Label>
              <p className="mt-2 font-display text-4xl font-bold">{formatViews(totalViews)}</p>
            </Card>
            <Card className="p-5 md:p-6">
              <Label>Earned across campaigns</Label>
              <p className="mt-2 font-display text-4xl font-bold text-lime">{formatINR(totalEarned)}</p>
            </Card>
          </div>

          {verified.length === 0 && (
            <p className="rounded-2xl border border-[#f5c451]/40 bg-[#f5c451]/10 p-4 text-sm text-[#f5c451]">
              You don&apos;t have a verified account yet, so nothing counts toward these campaigns.{" "}
              <Link href="/portal/accounts" className="underline underline-offset-4">
                Add or check your accounts
              </Link>
              .
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} accounts={accounts} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
