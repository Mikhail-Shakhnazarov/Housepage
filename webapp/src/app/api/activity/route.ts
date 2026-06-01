import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get("householdId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 });
    }

    await requireHouseholdMember(user.id!, householdId);

    const events = await prisma.feedEvent.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return NextResponse.json({ events });
  } catch (error) {
    return handleAuthError(error);
  }
}
