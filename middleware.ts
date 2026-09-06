import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret:
      process.env.NEXTAUTH_SECRET ||
      "capstone-project-nextauth-secret-key-12345",
  });

  const { pathname } = req.nextUrl;

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
  matcher: [
    "/",
    "/dashboard/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/members/:path*",
  ],
};
