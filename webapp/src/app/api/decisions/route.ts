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

        const decisions = await prisma.decision.findMany({
            where: { householdId },
            orderBy: { updatedAt: 'desc' },
        });

        return NextResponse.json(decisions);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const data = await req.json();
        const { title, context, householdId } = data;

        if (!title || !householdId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

        const decision = await prisma.decision.create({
            data: {
                title,
                context,
                householdId,
                createdBy: user.id!,
                status: "PROPOSED",
            },
        });

        // Create Feed Event
        await prisma.feedEvent.create({
            data: {
                type: "decision",
                action: `proposed decision: ${title}`,
                userId: user.id,
                householdId,
            }
        });

        return NextResponse.json(decision);
    } catch (error) {
        return handleAuthError(error);
    }
}
