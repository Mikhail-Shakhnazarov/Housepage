import { requireUser, requireHouseholdMember, requireHouseholdOwner, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;

        await requireHouseholdMember(user.id!, id);

        const household = await prisma.household.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                address: true,
                createdAt: true,
                memberships: {
                    include: {
                        user: {
                            select: { id: true, email: true, name: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                _count: {
                    select: { tasks: true, notes: true, expenses: true, decisions: true },
                },
            },
        });

        if (!household) {
            return NextResponse.json({ error: "Household not found" }, { status: 404 });
        }

        const members = household.memberships.map(m => ({
            id: m.id,
            userId: m.user.id,
            email: m.user.email,
            name: m.user.name,
            role: m.role,
            joinedAt: m.createdAt,
        }));

        return NextResponse.json({
            id: household.id,
            name: household.name,
            address: household.address,
            createdAt: household.createdAt,
            members,
            counts: household._count,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;
        const { name } = await req.json();

        await requireHouseholdOwner(user.id!, id);

        if (!name) {
            return NextResponse.json({ error: "Missing household name" }, { status: 400 });
        }

        const household = await prisma.household.update({
            where: { id },
            data: { name },
        });

        await prisma.feedEvent.create({
            data: {
                type: "household",
                action: `renamed household to: ${name}`,
                userId: user.id,
                householdId: id,
            },
        });

        return NextResponse.json(household);
    } catch (error) {
        return handleAuthError(error);
    }
}
