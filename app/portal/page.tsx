import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { getMe } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Your portal — ClipCrew", robots: { index: false, follow: false } };

export default async function PortalHome() {
  const me = await getMe();
  if (!me) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-[1200px] px-5 py-10 md:px-8">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-bold uppercase tracking-wide">ClipCrew</span>
        <LogoutButton />
      </div>
      <p className="eyebrow mt-14 text-lime">{"//"} Your portal</p>
      <h1 className="mt-3 text-[40px] leading-[1.02] md:text-[56px]">
        <span className="block font-display font-bold uppercase">Hi, {me.fullName.split(" ")[0]}</span>
        <span className="block font-serif italic text-lime">your earnings land here.</span>
      </h1>
      <p className="mt-6 max-w-xl text-muted-dark md:text-lg">
        Your views, earnings and notifications will appear here once your campaigns start.
      </p>
    </main>
  );
}
