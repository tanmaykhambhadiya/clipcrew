import { redirect } from "next/navigation";
import { PageTitle } from "@/components/portal/ui";
import { can, getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import type { CampaignOpt, ClipperOpt } from "../rejections/types";
import { NoticeCenter, type NoticeRow } from "./NoticeCenter";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const me = await getMe();
  if (!me || !can(me, "campaigns.manage")) redirect("/admin");

  const [form, history] = await Promise.all([
    pageApi<{ campaigns: CampaignOpt[]; members: Record<string, string[]>; clippers: ClipperOpt[] }>("/api/pages/admin/rejections"),
    pageApi<{ notices: NoticeRow[] }>("/api/admin/notices"),
  ]);

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Notices" line1="Tell the crew" line2="and see who read it." />
      <NoticeCenter campaigns={form.campaigns} members={form.members} clippers={form.clippers} history={history.notices} isSuper={me.role === "super_admin"} />
    </div>
  );
}
