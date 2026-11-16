import type { Metadata } from "next";
import { ApiError, serverApi } from "@/lib/server-api";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join ClipCrew", robots: { index: false, follow: false } };

// Public sign-up page behind an invite link the super admin shares.
export default async function JoinPage({ params }: { params: { token: string } }) {
  let info: { label: string; campaigns: string[] } | null = null;
  let problem = "";
  try {
    info = await serverApi<{ label: string; campaigns: string[] }>(`/api/join/${encodeURIComponent(params.token)}`);
  } catch (e) {
    problem = e instanceof ApiError ? e.message : "This invite link can't be opened right now.";
  }

  return (
    <main className="grid min-h-screen place-items-center bg-glow px-5 py-16">
      <div className="w-full max-w-[460px]">
        <a href="/" className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
          ClipCrew
        </a>
        <div className="mt-8 rounded-3xl border border-line bg-ink-2 p-7 md:p-9">
          <p className="eyebrow text-lime">{"//"} Clipper sign-up</p>
          <h1 className="mt-3 text-[40px] leading-[1.02]">
            <span className="block font-display font-bold uppercase">Join the</span>
            <span className="block font-serif italic text-lime">crew.</span>
          </h1>
          {info ? (
            <>
              {info.campaigns.length > 0 && (
                <p className="mt-4 text-sm text-muted-dark">
                  You&apos;ll be added to <span className="text-cream">{info.campaigns.join(", ")}</span>.
                </p>
              )}
              <JoinForm token={params.token} />
            </>
          ) : (
            <p role="alert" className="mt-6 rounded-2xl border border-[#ff8a7a]/40 bg-[#ff8a7a]/10 px-4 py-3 text-sm text-[#ffb4a8]">
              {problem}
            </p>
          )}
        </div>
        <p className="mt-5 text-center text-sm text-muted-dark">
          Already have a login? <a href="/login" className="text-lime underline-offset-4 hover:underline">Sign in</a>
        </p>
      </div>
    </main>
  );
}
