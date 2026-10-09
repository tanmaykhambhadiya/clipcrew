"use client";

import type { Role } from "@/lib/roles";
import { Button } from "./ui/Button";
import { useWaitlist } from "./WaitlistProvider";

type Props = React.ComponentProps<typeof Button> & { role?: Role };

export function JoinWaitlistButton({ role, children = "Join Waitlist", ...props }: Props) {
  const { openWaitlist } = useWaitlist();
  return (
    <Button onClick={() => openWaitlist(role)} {...props}>
      {children}
    </Button>
  );
}

/** Text-link style trigger (e.g. "Join as Podcaster →"). */
export function JoinWaitlistLink({ role, className, children }: { role?: Role; className?: string; children: React.ReactNode }) {
  const { openWaitlist } = useWaitlist();
  return (
    <button type="button" onClick={() => openWaitlist(role)} className={className}>
      {children}
    </button>
  );
}
