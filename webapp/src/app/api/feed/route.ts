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

        const events = await prisma.feedEvent.findMany({
            where: { householdId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        // Map icons based on type
        const eventsWithIcons = events.map((event: { type: string; createdAt: Date; [key: string]: unknown }) => {
            let icon = '📝';
            if (event.type === 'chore') icon = '♻️';
            if (event.type === 'money') icon = '💳';
            if (event.type === 'manual') icon = '🔥';
            if (event.type === 'decision') icon = '🤫';
            if (event.type === 'household') icon = '🏠';

            return {
                ...event,
                icon,
                // Simple relative time for now (or format on client)
                time: new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
        });

        return NextResponse.json(eventsWithIcons);
    } catch (error) {
        return handleAuthError(error);
    }
}
