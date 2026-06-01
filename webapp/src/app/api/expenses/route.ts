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

        const expenses = await prisma.expense.findMany({
            where: { householdId },
            include: { splits: true },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(expenses);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const data = await req.json();
        const { title, amount, householdId, payerId } = data;

        if (!title || !amount || !householdId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await requireHouseholdMember(user.id!, householdId);

        // Fetch household members for splitting
        const members = await prisma.membership.findMany({
            where: { householdId },
        });

        const splitAmount = amount / members.length;

        const expense = await prisma.expense.create({
            data: {
                title,
                amount,
                householdId,
                payerId: payerId || user.id,
                splits: {
                    create: members.map((m: any) => ({
                        userId: m.userId,
                        amount: splitAmount,
                    }))
                }
            },
        });

        // Create Feed Event
        await prisma.feedEvent.create({
            data: {
                type: "money",
                action: `logged expense: ${title} (${amount} €)`,
                userId: user.id,
                householdId,
            }
        });

        return NextResponse.json(expense);
    } catch (error) {
        return handleAuthError(error);
    }
}
