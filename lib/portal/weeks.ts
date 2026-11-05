// Weeks run Monday–Sunday in India time (Asia/Kolkata). Dates are 'YYYY-MM-DD' strings.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India, as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1 … Sun=7
  return addDays(date, 1 - isoDow);
}

export function currentWeekStart(now: Date = new Date()): string {
  return weekStartOf(istToday(now));
}

export function isMonday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

/** "3 – 9 Nov 2026" */
export function formatWeek(weekStart: string): string {
  const s = new Date(`${weekStart}T00:00:00Z`);
  const e = new Date(`${addDays(weekStart, 6)}T00:00:00Z`);
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
  const yr = e.getUTCFullYear();
  return s.getUTCMonth() === e.getUTCMonth()
    ? `${day(s)} – ${day(e)} ${mon(e)} ${yr}`
    : `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)} ${yr}`;
}

/** The last `count` week starts, newest first (current week included). */
export function recentWeeks(count: number, now: Date = new Date()): string[] {
  const first = currentWeekStart(now);
  return Array.from({ length: count }, (_, i) => addDays(first, -7 * i));
}

/** "5 Nov 2026" from an ISO timestamp or date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: value.length === 10 ? "UTC" : "Asia/Kolkata" });
}
