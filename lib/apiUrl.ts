// Base URL of the backend API (separate service, own domain). NEXT_PUBLIC_API_URL is inlined at build time,
// so it must be set as a *build* variable. Empty = same origin (not used in production).
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const apiUrl = (path: string) => `${API_BASE}${path}`;
