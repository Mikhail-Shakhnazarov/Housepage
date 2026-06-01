import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_STATUSES = ["PROPOSED", "AGREED", "BLOCKED", "ARCHIVED"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;
        const { status, title, context } = await req.json();

        const decision = await prisma.decision.findUnique({ where: { id } });
        if (!decision) {
            return NextResponse.json({ error: "Decision not found" }, { status: 404 });
        }

        await requireHouseholdMember(user.id!, decision.householdId);

        if (status) {
            if (!ALLOWED_STATUSES.includes(status)) {
                return NextResponse.json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
            }
        }

        const updated = await prisma.decision.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(title !== undefined && { title }),
                ...(context !== undefined && { context }),
            },
        });

        if (status && status !== decision.status) {
            await prisma.feedEvent.create({
                data: {
                    type: "decision",
                    action: `updated decision "${updated.title}" to ${status}`,
                    userId: user.id,
                    householdId: decision.householdId,
                },
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        return handleAuthError(error);
    }
}
