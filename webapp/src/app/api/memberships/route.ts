import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
        where: { userId: session.user.id },
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
}
