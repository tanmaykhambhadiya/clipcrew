import { NextResponse, type NextRequest } from "next/server";

// Sends visitors without a session cookie to /login. The cookie itself is checked against the
// database (and roles/permissions enforced) in the pages and API routes via getMe() / can().
export function middleware(request: NextRequest) {
  if (request.cookies.get("cc_session")?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/portal/:path*"] };
