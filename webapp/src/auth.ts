import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        {
            id: "credentials",
            name: "Mock Account",
            type: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
                if (!credentials?.email) return null;

                // Simple mock authorize: find or create user
                let user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email: credentials.email as string,
                            name: (credentials.email as string).split('@')[0]
                        },
                    });
                }

                return user;
            },
        },
    ],
    callbacks: {
        session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
            }
            return session;
        },
    },
});
