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

        const checks = await prisma.check.findMany({
            where: { householdId, roomId, active: true },
            select: {
                id: true,
                sourceKey: true,
                prompt: true,
                taskLinks: {
                    select: { taskId: true },
                },
            },
            orderBy: { sortOrder: 'asc' },
        });

        const result = checks.map(c => ({
            id: c.id,
            sourceKey: c.sourceKey,
            prompt: c.prompt,
            linkedTaskIds: c.taskLinks.map(l => l.taskId),
        }));

        return NextResponse.json({ checks: result });
    } catch (error) {
        return handleAuthError(error);
    }
}
