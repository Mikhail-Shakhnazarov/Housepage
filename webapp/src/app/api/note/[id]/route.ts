import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;
        const { title, content, category, pinned } = await req.json();

        const note = await prisma.note.findUnique({ where: { id } });
        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        await requireHouseholdMember(user.id!, note.householdId);

        const updated = await prisma.note.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
                ...(category !== undefined && { category }),
                ...(pinned !== undefined && { pinned }),
            },
        });

        await prisma.feedEvent.create({
            data: {
                type: "manual",
                action: `updated note: ${updated.title}`,
                userId: user.id,
                householdId: note.householdId,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return handleAuthError(error);
    }
}
