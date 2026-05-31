import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get("householdId");

    if (!session?.user?.id || !householdId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await prisma.note.findMany({
        where: { householdId },
        orderBy: { pinned: 'desc' },
    });

    return NextResponse.json(notes);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { title, content, category, householdId } = data;

    if (!title || !content || !householdId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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
            userId: session.user.id,
            householdId,
        }
    });

    return NextResponse.json(note);
}
