import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const user = await requireUser();
        const { searchParams } = new URL(req.url);
        const householdId = searchParams.get("householdId");

        if (!householdId) {
            return NextResponse.json({ error: "Missing householdId" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

        const rooms = await prisma.room.findMany({
            where: { householdId },
            select: { id: true, slug: true, name: true },
            orderBy: { sortOrder: 'asc' },
        });

        return NextResponse.json({ rooms });
    } catch (error) {
        return handleAuthError(error);
    }
}
