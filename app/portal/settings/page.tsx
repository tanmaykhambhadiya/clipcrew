import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMe } from "@/lib/portal/session";
import { Card, Label, PageTitle } from "@/components/portal/ui";
import { PasswordForm } from "@/app/admin/settings/PasswordForm";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "clipper") redirect("/admin/settings");

  const { data: profile } = await getSupabaseAdmin().from("profiles").select("upi_id, phone").eq("id", me.id).maybeSingle();

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Settings" line1="Your details," line2="kept current." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <Label>Your login</Label>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-dark">Name</dt>
                <dd className="mt-1 font-medium text-cream">{me.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-dark">Login ID</dt>
                <dd className="mt-1 font-mono text-cream">{me.loginId}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-dark">Need your name or login ID changed? Ask your ClipCrew admin.</p>
          </Card>

          <Card>
            <Label>Payout details</Label>
            <p className="mb-6 mt-2 text-sm text-muted-dark">Where we send your money and how we reach you.</p>
            <ProfileForm upiId={profile?.upi_id ?? ""} phone={profile?.phone ?? ""} />
          </Card>
        </div>

        <Card>
          <Label>Change password</Label>
          <p className="mb-6 mt-2 text-sm text-muted-dark">Got a password from your admin? Swap it for one only you know.</p>
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
