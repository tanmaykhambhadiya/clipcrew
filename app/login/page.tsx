import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe, isStaff } from "@/lib/portal/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — ClipCrew", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect(isStaff(me) ? "/admin" : "/portal");

  return (
    <main className="grid min-h-screen place-items-center bg-glow px-5 py-16">
      <div className="w-full max-w-[420px]">
        <a href="/" className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
          ClipCrew
        </a>
        <div className="mt-8 rounded-3xl border border-line bg-ink-2 p-7 md:p-9">
          <p className="eyebrow text-lime">{"//"} Clipper portal</p>
          <h1 className="mt-3 text-[40px] leading-[1.02]">
            <span className="block font-display font-bold uppercase">Sign in</span>
            <span className="block font-serif italic text-lime">to your crew.</span>
          </h1>
          <LoginForm />
        </div>
        <p className="mt-5 text-center text-sm text-muted-dark">No account? Your ClipCrew admin creates logins for you.</p>
      </div>
    </main>
  );
}
