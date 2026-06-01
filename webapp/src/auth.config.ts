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
            async authorize() {
                return null;
            },
        },
    ],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isAuthPage = nextUrl.pathname.startsWith('/auth/signin')
                || nextUrl.pathname.startsWith('/api/auth');
            const isLandingPage = nextUrl.pathname === '/';

            if (isLandingPage || isAuthPage) return true;
            return isLoggedIn;
        },
    },
};
