import { requireUser, requireHouseholdOwner, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;
        const { role } = await req.json();

        const membership = await prisma.membership.findUnique({ where: { id } });
        if (!membership) {
            return NextResponse.json({ error: "Membership not found" }, { status: 404 });
        }

        await requireHouseholdOwner(user.id!, membership.householdId);

        const validRoles = ["OWNER", "MEMBER", "SUBLET"];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: `Invalid role. Allowed: ${validRoles.join(", ")}` }, { status: 400 });
        }

        const updated = await prisma.membership.update({
            where: { id },
            data: { role },
        });

        await prisma.feedEvent.create({
            data: {
                type: "household",
                action: `changed role of member to ${role}`,
                userId: user.id,
                householdId: membership.householdId,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;

        const membership = await prisma.membership.findUnique({ where: { id } });
        if (!membership) {
            return NextResponse.json({ error: "Membership not found" }, { status: 404 });
        }

        await requireHouseholdOwner(user.id!, membership.householdId);

        if (membership.userId === user.id) {
            const ownerCount = await prisma.membership.count({
                where: { householdId: membership.householdId, role: "OWNER" },
            });
            if (ownerCount <= 1) {
                return NextResponse.json({ error: "Cannot remove the sole owner" }, { status: 400 });
            }
        }

        await prisma.membership.delete({ where: { id } });

        await prisma.feedEvent.create({
            data: {
                type: "household",
                action: `removed a member from the household`,
                userId: user.id,
                householdId: membership.householdId,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleAuthError(error);
    }
}
