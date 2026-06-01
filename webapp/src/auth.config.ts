import { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
    providers: [
        {
            id: "credentials",
            name: "Mock Account",
            type: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
            },
            // Authorize logic remains in the main auth.ts (server only)
        } as any,
    ],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isAuthPage = nextUrl.pathname.startsWith('/api/auth');
            const isLandingPage = nextUrl.pathname === '/';

            if (isLandingPage || isAuthPage) return true;
            return isLoggedIn;
        },
    },
} as NextAuthConfig;
