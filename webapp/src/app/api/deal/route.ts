import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { scoreAndSelectTasks } from "@/lib/scan/deal";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { householdId, roomId, scanSessionId, energy, timeMin, handSize } = await req.json();

    if (!householdId || !roomId || energy == null || timeMin == null || handSize == null) {
      return NextResponse.json({ error: "Missing required fields: householdId, roomId, energy, timeMin, handSize" }, { status: 400 });
    }

    if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
      return NextResponse.json({ error: "Invalid energy: must be an integer between 1 and 5" }, { status: 400 });
    }

    if (!Number.isInteger(timeMin) || timeMin < 1 || timeMin > 480) {
      return NextResponse.json({ error: "Invalid timeMin: must be between 1 and 480" }, { status: 400 });
    }

    if (!Number.isInteger(handSize) || handSize < 1 || handSize > 20) {
      return NextResponse.json({ error: "Invalid handSize: must be between 1 and 20" }, { status: 400 });
    }

    await requireHouseholdMember(user.id!, householdId);

    const room = await prisma.room.findFirst({
      where: { id: roomId, householdId },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found in household" }, { status: 400 });
    }

    if (scanSessionId) {
      const session = await prisma.scanSession.findFirst({
        where: { id: scanSessionId, householdId, roomId },
      });
      if (!session) {
        return NextResponse.json({ error: "Scan session not found in this household/room" }, { status: 400 });
      }
    }

    const tasks = await prisma.task.findMany({
      where: { householdId, roomId, archivedAt: null },
      select: {
        id: true,
        title: true,
        roomId: true,
        effort: true,
        minutesEst: true,
        status: true,
      },
    });

    const failedCheckTaskIds = new Set<string>();
    if (scanSessionId) {
      const failedAnswers = await prisma.scanAnswer.findMany({
        where: {
          scanSessionId,
          answer: "no",
        },
        include: {
          check: {
            include: {
              taskLinks: { select: { taskId: true } },
            },
          },
        },
      });
      for (const ans of failedAnswers) {
        for (const link of ans.check.taskLinks) {
          failedCheckTaskIds.add(link.taskId);
        }
      }
    } else {
      const latestSession = await prisma.scanSession.findFirst({
        where: { householdId, roomId },
        orderBy: { createdAt: "desc" },
      });
      if (latestSession) {
        const failedAnswers = await prisma.scanAnswer.findMany({
          where: {
            scanSessionId: latestSession.id,
            answer: "no",
          },
          include: {
            check: {
              include: {
                taskLinks: { select: { taskId: true } },
              },
            },
          },
        });
        for (const ans of failedAnswers) {
          for (const link of ans.check.taskLinks) {
            failedCheckTaskIds.add(link.taskId);
          }
        }
      }
    }

    const recentSkipActions = await prisma.taskAction.findMany({
      where: {
        householdId,
        action: "skip",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { taskId: true },
    });
    const recentSkipTaskIds = new Set(recentSkipActions.map((a: { taskId: string }) => a.taskId));

    const recentDoneActions = await prisma.taskAction.findMany({
      where: {
        householdId,
        action: "done",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { taskId: true },
    });
    const recentDoneTaskIds = new Set(recentDoneActions.map((a: { taskId: string }) => a.taskId));

    const scored = scoreAndSelectTasks({
      tasks,
      failedCheckTaskIds,
      selectedRoomId: roomId,
      energy,
      timeMin,
      recentSkipTaskIds,
      recentDoneTaskIds,
      handSize,
    });

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          householdId,
          roomId,
          scanSessionId: scanSessionId || null,
          userId: user.id!,
          energy,
          timeMin,
          handSize,
        },
      });

      for (let i = 0; i < scored.length; i++) {
        await tx.dealTask.create({
          data: {
            dealId: deal.id,
            taskId: scored[i].taskId,
            position: i,
            score: scored[i].score,
            reason: scored[i].reason,
          },
        });
      }

      await tx.feedEvent.create({
        data: {
          type: "deal",
          action: `dealt ${scored.length} tasks in ${room.slug} (energy=${energy}, time=${timeMin}min)`,
          userId: user.id,
          householdId,
        },
      });

      return deal;
    });

    return NextResponse.json({
      dealId: result.id,
      tasks: scored,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
