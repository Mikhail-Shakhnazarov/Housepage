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

    const expenses = await prisma.expense.findMany({
        where: { householdId },
        include: { splits: true },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(expenses);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { title, amount, householdId, payerId } = data;

    if (!title || !amount || !householdId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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
            payerId: payerId || session.user.id,
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
            userId: session.user.id,
            householdId,
        }
    });

    return NextResponse.json(expense);
}
