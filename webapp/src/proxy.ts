import NextAuth, { type NextAuthRequest } from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req: NextAuthRequest) => {
    const isLoggedIn = !!req.auth;
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth/signin')
        || req.nextUrl.pathname.startsWith('/api/auth');
    const isLandingPage = req.nextUrl.pathname === '/';

    if (!isLoggedIn && !isAuthPage && !isLandingPage) {
        return Response.redirect(new URL("/auth/signin", req.nextUrl));
    }
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
