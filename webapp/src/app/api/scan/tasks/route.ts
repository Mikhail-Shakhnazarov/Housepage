import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const user = await requireUser();
        const { searchParams } = new URL(req.url);
        const householdId = searchParams.get("householdId");
        const roomId = searchParams.get("roomId");

        if (!householdId || !roomId) {
            return NextResponse.json({ error: "Missing householdId or roomId" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

        const tasks = await prisma.task.findMany({
            where: { householdId, roomId, archivedAt: null },
            select: {
                id: true,
                sourceKey: true,
                title: true,
                effort: true,
                minutesEst: true,
                kind: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json({ tasks });
    } catch (error) {
        return handleAuthError(error);
    }
}
