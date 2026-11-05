// Money is stored as integer paise everywhere (bigint columns arrive from Supabase as numbers).

/** ₹1,23,456.78 — Indian digit grouping. */
export function formatINR(paise: number | string | bigint | null | undefined, opts: { decimals?: boolean } = {}): string {
  const n = Number(paise ?? 0) / 100;
  const decimals = opts.decimals ?? true;
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number | string | bigint): number {
  return Number(paise) / 100;
}

/** Earnings for a week: floor(views × rate per 1M views ÷ 1,000,000), in paise. Exact for large numbers. */
export function amountForViews(views: number, ratePerMillionPaise: number): number {
  return Number((BigInt(Math.trunc(views)) * BigInt(Math.trunc(ratePerMillionPaise))) / BigInt(1_000_000));
}

/** 1,240,000 → "12,40,000" (Indian grouping) */
export function formatViews(views: number | string | null | undefined): string {
  return Number(views ?? 0).toLocaleString("en-IN");
}

/** 1,240,000 → "1.2M" */
export function compactViews(views: number | string | null | undefined): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(views ?? 0));
}
