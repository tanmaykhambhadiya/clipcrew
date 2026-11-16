import "server-only";
import { cache } from "react";
import { serverApi } from "@/lib/server-api";

export type NavCounts = { pendingAccounts?: number; accountsNeedingCode?: number; pendingSubmissions?: number };

/** Menu-badge numbers, fetched once per request (the layout and the overview both use them). Never throws. */
export const getNavCounts = cache(async (): Promise<NavCounts> => {
  try {
    return await serverApi<NavCounts>("/api/admin/nav-counts");
  } catch {
    return {};
  }
});
