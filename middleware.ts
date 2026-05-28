import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Protect /admin/* — must be authenticated AND have admin role
    if (pathname.startsWith("/admin")) {
      if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      if (token.role !== "admin") {
        // Authenticated but not admin → 403 page (or back to home)
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Let the middleware function above handle all logic;
      // return true so withAuth doesn't short-circuit before our handler
      authorized: () => true,
    },
  }
);

export const config = {
  // Run middleware only on /admin routes
  matcher: ["/admin/:path*"],
};
