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

        const tasks = await prisma.task.findMany({
            where: { householdId },
            orderBy: { dueDate: 'asc' },
        });

        return NextResponse.json(tasks);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const data = await req.json();
        const { title, description, dueDate, householdId, assigneeId } = data;

        if (!title || !householdId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

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
                userId: user.id,
                householdId,
            }
        });

        return NextResponse.json(task);
    } catch (error) {
        return handleAuthError(error);
    }
}
