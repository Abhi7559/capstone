import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If environment variable SERVE_API_ONLY is set to "true" (e.g. on Render), block non-API routes
  if (process.env.SERVE_API_ONLY === "true" && !pathname.startsWith("/api")) {
    return NextResponse.json(
      { message: "This server is running strictly as an API-only Mock Server." },
      { status: 404 }
    );
  }

  const token = await getToken({
    req,
    secret:
      process.env.NEXTAUTH_SECRET ||
      "capstone-project-nextauth-secret-key-12345",
  });

  const protectedRoutes = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/analytics",
    "/profile",
    "/members",
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
