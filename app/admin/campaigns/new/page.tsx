import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/portal/ui";
import { can, getMe } from "@/lib/portal/session";
import { CampaignForm } from "../_components/CampaignForm";

export default async function NewCampaignPage() {
  const me = await getMe();
  if (!me || !can(me, "campaigns.manage")) redirect("/admin/campaigns");

  return (
    <div className="space-y-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-lime">
        <ArrowLeft size={15} aria-hidden /> All campaigns
      </Link>
      <PageTitle eyebrow="New campaign" line1="Set it up," line2="then send it out." />
      <Card>
        <CampaignForm canEditRate />
      </Card>
      {me.role !== "super_admin" && (
        <p className="text-sm text-muted-dark">
          You&apos;ll be assigned to the campaign you create. After it&apos;s created, only the super admin can change its rate.
        </p>
      )}
    </div>
  );
}
