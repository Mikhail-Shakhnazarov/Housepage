import { requireUser, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const user = await requireUser();

        const memberships = await prisma.membership.findMany({
            where: { userId: user.id! },
            include: {
                household: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        const households = memberships.map((m: any) => ({
            id: m.household.id,
            name: m.household.name,
            role: m.role,
        }));

        return NextResponse.json(households);
    } catch (error) {
        return handleAuthError(error);
    }
}
