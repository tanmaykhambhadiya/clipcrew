import { AsyncLocalStorage } from "node:async_hooks";

// Per-request state. Handlers written for Next.js call cookies().get/set/delete; here that works
// against this store: incoming cookies are read from the request, and outgoing ones are collected
// and sent as Set-Cookie headers when the handler returns.

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  expires?: Date;
  maxAge?: number;
  domain?: string;
};

type Store = { incoming: Map<string, string>; outgoing: string[] };

export const requestContext = new AsyncLocalStorage<Store>();

export function parseCookieHeader(header: string | undefined): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    try {
      jar.set(name, decodeURIComponent(value));
    } catch {
      jar.set(name, value);
    }
  }
  return jar;
}

function serialize(name: string, value: string, o: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`];
  if (o.domain) parts.push(`Domain=${o.domain}`);
  if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`);
  if (o.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAge)}`);
  if (o.httpOnly) parts.push("HttpOnly");
  if (o.secure) parts.push("Secure");
  parts.push(`SameSite=${(o.sameSite ?? "lax").replace(/^./, (c) => c.toUpperCase())}`);
  return parts.join("; ");
}

function store(): Store {
  const s = requestContext.getStore();
  if (!s) throw new Error("cookies() was called outside a request");
  return s;
}

/** Same surface as Next's cookies() for the parts the routes use. */
export function cookies() {
  return {
    get(name: string) {
      const v = store().incoming.get(name);
      return v === undefined ? undefined : { name, value: v };
    },
    set(name: string, value: string, options: CookieOptions = {}) {
      store().outgoing.push(serialize(name, value, options));
      store().incoming.set(name, value);
    },
    delete(name: string, options: CookieOptions = {}) {
      store().outgoing.push(serialize(name, "", { ...options, expires: new Date(0), maxAge: 0 }));
      store().incoming.delete(name);
    },
  };
}
