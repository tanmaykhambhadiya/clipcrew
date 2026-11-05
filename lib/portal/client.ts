// Browser-side fetch helper for /api/admin/* and /api/portal/* routes.
// Throws an Error carrying `.fields` (per-field messages) when the route answers { ok: false }.

export type ApiError = Error & { fields?: Record<string, string>; status?: number };

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login");
    throw Object.assign(new Error(data.error || "Something went wrong."), { fields: data.fields, status: res.status }) as ApiError;
  }
  return data as T;
}
