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

    const tasks = await prisma.task.findMany({
        where: { householdId },
        orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(tasks);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { title, description, dueDate, householdId, assigneeId } = data;

    if (!title || !householdId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const task = await prisma.task.create({
        data: {
            title,
            description,
            dueDate: dueDate ? new Date(dueDate) : null,
            householdId,
            assigneeId,
            status: "OPEN",
        },
    });

    // Create Feed Event
    await prisma.feedEvent.create({
        data: {
            type: "chore",
            action: `added task: ${title}`,
            userId: session.user.id,
            householdId,
        }
    });

    return NextResponse.json(task);
}
