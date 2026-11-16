import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

// Server-side calls from pages/layouts to the backend API. The visitor's session cookie is forwarded,
// so the backend decides who they are and what they may see — this app has no database access.
// API_URL may be an internal address (e.g. http://backend:4000); it falls back to the public one.

const API = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const SESSION_COOKIE = "cc_session";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** GET a backend JSON endpoint as the current visitor. Throws ApiError on a non-OK answer. */
export async function serverApi<T = unknown>(path: string): Promise<T> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  let res: Response;
  try {
    res = await fetch(API + path, {
      cache: "no-store",
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    });
  } catch {
    throw new ApiError("The server is unreachable right now. Please try again in a moment.", 503);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new ApiError(data.error || "Something went wrong.", res.status);
  return data as T;
}

/** Like serverApi, but turns auth failures into the right page behaviour:
 *  signed out → /login, not allowed → back to the dashboard, missing → 404. */
export async function pageApi<T = unknown>(path: string, opts: { forbiddenTo?: string } = {}): Promise<T> {
  try {
    return await serverApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) redirect("/login");
      if (e.status === 403) redirect(opts.forbiddenTo ?? "/admin");
      if (e.status === 404) notFound();
    }
    throw e;
  }
}
