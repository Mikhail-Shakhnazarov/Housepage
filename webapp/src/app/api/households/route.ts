import { requireUser, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { name } = await req.json();

        if (!name) {
            return NextResponse.json({ error: "Missing household name" }, { status: 400 });
        }

        // Create household and membership in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const household = await tx.household.create({
                data: {
                    name,
                },
            });

            const membership = await tx.membership.create({
                data: {
                    userId: user.id!,
                    householdId: household.id,
                    role: "ADMIN",
                },
            });

            // Create Feed Event
            await tx.feedEvent.create({
                data: {
                    type: "household",
                    action: `created household: ${name}`,
                    userId: user.id,
                    householdId: household.id,
                }
            });

            return household;
        });

        return NextResponse.json(result);
    } catch (error) {
        return handleAuthError(error);
    }
}
