import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Ensures a user is authenticated and returns the user object.
 * Throws a redirect/error if not authenticated.
 */
export async function requireUser() {
    const session = await auth();
    if (!session?.user) {
        throw new Error("UNAUTHENTICATED");
    }
    return session.user;
}

/**
 * Verifies that the user is a member of the specified household.
 * Returns the membership object if valid.
 */
export async function requireHouseholdMember(userId: string, householdId: string) {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_householdId: {
                userId,
                householdId,
            },
        },
    });

    if (!membership) {
        throw new Error("UNAUTHORIZED_HOUSEHOLD");
    }

    return membership;
}

/**
 * Helper to handle authorization errors in API routes.
 */
export function handleAuthError(error: unknown) {
    if (error instanceof Error) {
        if (error.message === "UNAUTHENTICATED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error.message === "UNAUTHORIZED_HOUSEHOLD") {
            return NextResponse.json({ error: "Forbidden: Not a member of this household" }, { status: 403 });
        }
        console.error("Auth helper error:", error.message);
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
