import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function requireUser() {
    const session = await auth();
    if (!session?.user) {
        throw new Error("UNAUTHENTICATED");
    }
    return session.user;
}

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

export async function requireHouseholdOwner(userId: string, householdId: string) {
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

    if (membership.role !== "OWNER") {
        throw new Error("FORBIDDEN_ROLE");
    }

    return membership;
}

export async function requireHouseholdRole(userId: string, householdId: string, allowedRoles: string[]) {
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

    if (!allowedRoles.includes(membership.role)) {
        throw new Error("FORBIDDEN_ROLE");
    }

    return membership;
}

export function handleAuthError(error: unknown) {
    if (error instanceof Error) {
        if (error.message === "UNAUTHENTICATED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error.message === "UNAUTHORIZED_HOUSEHOLD") {
            return NextResponse.json({ error: "Forbidden: Not a member of this household" }, { status: 403 });
        }
        if (error.message === "FORBIDDEN_ROLE") {
            return NextResponse.json({ error: "Forbidden: Insufficient role" }, { status: 403 });
        }
        console.error("Auth helper error:", error.message);
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
