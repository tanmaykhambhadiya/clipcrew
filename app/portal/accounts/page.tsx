import { redirect } from "next/navigation";
import { pageApi } from "@/lib/server-api";
import { getMe } from "@/lib/portal/session";
import { PageTitle } from "@/components/portal/ui";
import { AccountsManager, type ClipperAccount } from "./AccountsManager";

export const dynamic = "force-dynamic";

export default async function PortalAccountsPage() {
  const me = await getMe();
  if (!me || me.role !== "clipper") redirect("/login");

  const { accounts: list } = await pageApi<{ accounts: ClipperAccount[] }>("/api/portal/accounts", { forbiddenTo: "/login" });

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Accounts" line1="Your accounts" line2="verified & ready to earn." />
      <AccountsManager accounts={list} />
    </div>
  );
}
