import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;

  // Define public pages
  const isLoginPage = pathname === "/login";
  const isPublicApi = pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout");

  // Skip middleware for static assets, public resources, and Next.js internal endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".") || // files like manifest.json, sw.js
    isPublicApi
  ) {
    return NextResponse.next();
  }

  // 1. If NOT logged in
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // 2. If logged in, verify JWT
  const user = await verifyJWT(token);
  if (!user) {
    // Bad token, clear cookie and redirect
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Invalid session." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
    
    response.cookies.set("session", "", { path: "/", maxAge: 0 });
    return response;
  }

  // 3. User is valid, enforce role-based access
  const isAdmin = user.role === "ADMIN";

  // Redirect logged-in users away from /login
  if (isLoginPage) {
    return NextResponse.redirect(new URL("/pos", req.url));
  }

  // Admin-only pages and APIs
  const adminOnlyRoutes = ["/dashboard", "/inventory", "/reports", "/audit-logs", "/backups"];
  const isAdminOnlyPage = adminOnlyRoutes.some(route => pathname.startsWith(route));
  
  const adminOnlyApis = [
    "/api/backup",
    "/api/auth/register-staff",
    "/api/audit-logs",
  ];
  const isAdminOnlyApi = adminOnlyApis.some(api => pathname.startsWith(api));

  // Also block non-admin modifying items/categories
  const isItemCategoryWrite = 
    (pathname.startsWith("/api/items") || pathname.startsWith("/api/categories")) && 
    ["POST", "PUT", "DELETE"].includes(req.method);

  if ((isAdminOnlyPage || isAdminOnlyApi || isItemCategoryWrite) && !isAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden. Admin privileges required." },
        { status: 403 }
      );
    }
    // Redirect staff to their allowed POS page
    return NextResponse.redirect(new URL("/pos", req.url));
  }

  return NextResponse.next();
}

// Config to run middleware on all relevant paths
export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/pos/:path*",
    "/inventory/:path*",
    "/reports/:path*",
    "/audit-logs/:path*",
    "/backups/:path*",
    "/api/:path*",
  ],
};
