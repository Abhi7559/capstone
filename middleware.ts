import { type NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If environment variable SERVE_API_ONLY is set to "true" (e.g. on Render), block non-API routes
  if (process.env.SERVE_API_ONLY === "true" && !pathname.startsWith("/api")) {
    return NextResponse.json(
      {
        message: "This server is running strictly as an API-only Mock Server.",
      },
      { status: 404 },
    );
  }

  // Redirect root path to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
