import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

// In-memory, per server instance — fine for v1 (resets on cold start / redeploy).
const buckets = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns true if the request is allowed. */
export function rateLimit(scope: string, ip: string): boolean {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);

  // Opportunistic cleanup so the map can't grow forever.
  if (buckets.size > 5000) {
    buckets.forEach((times, k) => {
      if (times.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    });
  }
  return true;
}
