import { redirect } from "next/navigation";
import { PageTitle } from "@/components/portal/ui";
import { getMe } from "@/lib/portal/session";
import { pageApi } from "@/lib/server-api";
import { SubmissionsManager, type SubmissionRow, type SubmitOption } from "./SubmissionsManager";

export const dynamic = "force-dynamic";

export default async function PortalSubmissionsPage() {
  const me = await getMe();
  if (!me || me.role !== "clipper") redirect("/login");

  const { submissions, options } = await pageApi<{ submissions: SubmissionRow[]; options: SubmitOption[] }>("/api/portal/submissions", { forbiddenTo: "/login" });

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Submissions" line1="Submit your reels" line2="so every clip is seen." />
      <SubmissionsManager submissions={submissions} options={options} />
    </div>
  );
}
