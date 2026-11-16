import { redirect } from "next/navigation";
import { getMe } from "@/lib/portal/session";
import { PageTitle } from "@/components/portal/ui";
import { InvitesManager } from "./InvitesManager";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const me = await getMe();
  if (me?.role !== "super_admin") redirect("/admin");
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Invite links" line1="One link," line2="a whole crew onboarded." />
      <p className="max-w-2xl text-sm text-muted-dark">
        Share a link on WhatsApp or Instagram. Clippers who open it enter their name and number, get a login instantly and
        land in their portal, already added to the campaigns you pick. You can see each one&apos;s password under Users or on
        their profile.
      </p>
      <InvitesManager />
    </div>
  );
}
