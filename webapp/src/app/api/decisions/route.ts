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

    const decisions = await prisma.decision.findMany({
        where: { householdId },
        orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(decisions);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { title, context, householdId } = data;

    if (!title || !householdId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const decision = await prisma.decision.create({
        data: {
            title,
            context,
            householdId,
            createdBy: session.user.id,
            status: "PROPOSED",
        },
    });

    // Create Feed Event
    await prisma.feedEvent.create({
        data: {
            type: "decision",
            action: `proposed decision: ${title}`,
            userId: session.user.id,
            householdId,
        }
    });

    return NextResponse.json(decision);
}
