import { redirect } from "next/navigation";
import { PageTitle } from "@/components/portal/ui";
import { getMe } from "@/lib/portal/session";
import { Inbox } from "./Inbox";
import { loadInbox } from "./load";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const me = await getMe();
  if (!me || me.role !== "clipper") redirect("/login");

  let initial: Awaited<ReturnType<typeof loadInbox>> | null = null;
  try {
    initial = await loadInbox(me.id);
  } catch (e) {
    console.error("[inbox] page load failed", e);
  }

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Inbox" line1="Updates from" line2="the crew." />
      <Inbox initialItems={initial?.items ?? []} initialCursor={initial?.nextCursor ?? null} loadError={!initial} />
    </div>
  );
}
