import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get("householdId");
    const days = parseInt(searchParams.get("days") || "7", 10);

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 });
    }

    await requireHouseholdMember(user.id!, householdId);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [scanSessions, deals, taskActions, feedEvents] = await Promise.all([
      prisma.scanSession.count({ where: { householdId, createdAt: { gte: since } } }),
      prisma.deal.count({ where: { householdId, createdAt: { gte: since } } }),
      prisma.taskAction.count({ where: { householdId, createdAt: { gte: since } } }),
      prisma.feedEvent.count({ where: { householdId, createdAt: { gte: since } } }),
    ]);

    const doneActions = await prisma.taskAction.count({
      where: { householdId, action: "done", createdAt: { gte: since } },
    });

    const skipActions = await prisma.taskAction.count({
      where: { householdId, action: "skip", createdAt: { gte: since } },
    });

    return NextResponse.json({
      days,
      scanSessions,
      deals,
      doneActions,
      skipActions,
      totalActions: taskActions,
      feedEvents,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
