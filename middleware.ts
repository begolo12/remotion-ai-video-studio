import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "session";

/** Middleware hanya mengecek ada/tidaknya cookie. Verifikasi asli ada di requireUser(). */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Silakan login terlebih dahulu" },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/api/auth/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/studio/:path*",
    "/projects/:path*",
    "/api/projects/:path*",
    "/api/ai/:path*",
    "/api/render/:path*",
    "/api/assets/:path*",
    "/api/workspaces/:path*",
    "/api/settings/:path*",
  ],
};
