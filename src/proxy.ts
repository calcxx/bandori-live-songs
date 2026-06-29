import { NextRequest, NextResponse } from "next/server";
import { adminAuthCookieName, normalizeAdminNextPath, verifyAdminAuthToken } from "@/lib/admin/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin") {
    return NextResponse.next();
  }

  const token = request.cookies.get(adminAuthCookieName)?.value;
  if (await verifyAdminAuthToken(token)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "";
  url.searchParams.set("next", normalizeAdminNextPath(`${pathname}${search}`));

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
