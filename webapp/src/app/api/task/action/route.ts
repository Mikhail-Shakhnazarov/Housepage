import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_ACTIONS = ["done", "skip"];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { householdId, taskId, roomId, dealId, action, clientTs } = await req.json();

    if (!householdId || !taskId || !action) {
      return NextResponse.json({ error: "Missing required fields: householdId, taskId, action" }, { status: 400 });
    }

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}. Allowed: ${ALLOWED_ACTIONS.join(", ")}` }, { status: 400 });
    }

    await requireHouseholdMember(user.id!, householdId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, householdId },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found in household" }, { status: 400 });
    }

    if (roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, householdId },
      });
      if (!room) {
        return NextResponse.json({ error: "Room not found in household" }, { status: 400 });
      }
    }

    if (dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, householdId },
      });
      if (!deal) {
        return NextResponse.json({ error: "Deal not found in household" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const taskAction = await tx.taskAction.create({
        data: {
          householdId,
          taskId,
          roomId: roomId || null,
          dealId: dealId || null,
          userId: user.id!,
          action,
          clientTs: clientTs ? new Date(clientTs) : null,
        },
      });

      if (action === "done") {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "DONE" },
        });
      }

      const actionLabel = action === "done" ? "completed" : "skipped";
      await tx.feedEvent.create({
        data: {
          type: "task",
          action: `${actionLabel} task: ${task.title}`,
          userId: user.id,
          householdId,
        },
      });

      return taskAction;
    });

    return NextResponse.json({
      ok: true,
      taskActionId: result.id,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
