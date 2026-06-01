import { requireUser, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
        }

        const invitation = await prisma.invitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            return NextResponse.json({ error: "Invalid invitation token" }, { status: 400 });
        }

        if (invitation.expiresAt < new Date()) {
            return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
        }

        const existing = await prisma.membership.findUnique({
            where: {
                userId_householdId: {
                    userId: user.id!,
                    householdId: invitation.householdId,
                },
            },
        });

        if (existing) {
            return NextResponse.json({ error: "Already a member of this household" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const membership = await tx.membership.create({
                data: {
                    userId: user.id!,
                    householdId: invitation.householdId,
                    role: invitation.role,
                },
            });

            await tx.feedEvent.create({
                data: {
                    type: "household",
                    action: `joined the household via invitation`,
                    userId: user.id,
                    householdId: invitation.householdId,
                },
            });

            await tx.invitation.delete({
                where: { id: invitation.id },
            });

            const household = await tx.household.findUnique({
                where: { id: invitation.householdId },
                select: { id: true, name: true },
            });

            return { membership, household };
        });

        return NextResponse.json({
            ok: true,
            household: result.household,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
