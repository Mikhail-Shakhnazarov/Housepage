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

        const notes = await prisma.note.findMany({
            where: { householdId },
            orderBy: { pinned: 'desc' },
        });

        return NextResponse.json(notes);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const data = await req.json();
        const { title, content, category, householdId } = data;

        if (!title || !content || !householdId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

        const note = await prisma.note.create({
            data: {
                title,
                content,
                category: category || "General",
                householdId,
            },
        });

        // Create Feed Event
        await prisma.feedEvent.create({
            data: {
                type: "manual",
                action: `updated manual: ${title}`,
                userId: user.id,
                householdId,
            }
        });

        return NextResponse.json(note);
    } catch (error) {
        return handleAuthError(error);
    }
}
