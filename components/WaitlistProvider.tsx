"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isRole, type Role } from "@/lib/roles";
import { WaitlistModal } from "./WaitlistModal";

type WaitlistContextValue = { openWaitlist: (role?: Role) => void };

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function useWaitlist() {
  const ctx = useContext(WaitlistContext);
  if (!ctx) throw new Error("useWaitlist must be used inside <WaitlistProvider>");
  return ctx;
}

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Bumped on every open so the modal remounts with fresh state + timer.
  const [session, setSession] = useState(0);

  const openWaitlist = useCallback((r?: Role) => {
    setRole(r ?? null);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // ?waitlist=clipper|creator|promoter opens the modal pre-selected; utm_source is kept as the source.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wl = params.get("waitlist");
    const utm = params.get("utm_source");
    const src = [utm && `utm:${utm}`, wl && `waitlist:${wl}`].filter(Boolean).join(" ");
    if (src) setSource(src.slice(0, 120));
    if (wl !== null) openWaitlist(isRole(wl) ? wl : undefined);
  }, [openWaitlist]);

  return (
    <WaitlistContext.Provider value={{ openWaitlist }}>
      {children}
      {open && <WaitlistModal key={session} initialRole={role} source={source} onClose={close} />}
    </WaitlistContext.Provider>
  );
}
