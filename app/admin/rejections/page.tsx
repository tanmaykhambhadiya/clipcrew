import { redirect } from "next/navigation";
import { PageTitle } from "@/components/portal/ui";
import { can, getMe, isStaff } from "@/lib/portal/session";
import { NoticesManager } from "./NoticesManager";
import { canUseNoticesPage, loadFormData } from "./server";

export const dynamic = "force-dynamic";

export default async function RejectionsPage() {
  const me = await getMe();
  if (!me || !isStaff(me) || !canUseNoticesPage(me)) redirect("/admin");

  const { campaigns, members, clippers } = await loadFormData(me);

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Rejections & fines" line1="Keep the crew" line2="on brief." />
      <p className="-mt-6 max-w-2xl text-sm text-muted-dark">
        Reject a reel that breaks the rules, add a fine, or share news with a campaign&apos;s clippers. Everything lands in their
        inbox right away. Rejected reels aren&apos;t counted — leave their views out when you enter weekly numbers.
      </p>
      <NoticesManager
        modes={{
          reject: can(me, "rejections.send"),
          fine: can(me, "fines.create"),
          announce: can(me, "campaigns.manage"),
        }}
        isSuper={me.role === "super_admin"}
        campaigns={campaigns}
        members={members}
        clippers={clippers}
      />
    </div>
  );
}
