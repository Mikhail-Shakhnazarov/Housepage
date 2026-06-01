import { requireUser, requireHouseholdMember, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_ANSWERS = ["yes", "no"];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { householdId, roomId, clientTs, answers } = await req.json();

    if (!householdId || !roomId || !answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Missing required fields: householdId, roomId, answers" }, { status: 400 });
    }

    for (const ans of answers) {
      if (!ans.checkId || !ALLOWED_ANSWERS.includes(ans.answer)) {
        return NextResponse.json({ error: `Invalid answer value: "${ans.answer}". Allowed: ${ALLOWED_ANSWERS.join(", ")}` }, { status: 400 });
      }
    }

    await requireHouseholdMember(user.id!, householdId);

    const room = await prisma.room.findFirst({
      where: { id: roomId, householdId },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found in household" }, { status: 400 });
    }

    const checkIds = answers.map((a: { checkId: string }) => a.checkId);
    const checks = await prisma.check.findMany({
      where: { id: { in: checkIds }, householdId, roomId },
    });
    if (checks.length !== checkIds.length) {
      return NextResponse.json({ error: "One or more checks not found in this household/room" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.scanSession.create({
        data: {
          householdId,
          roomId,
          userId: user.id!,
          clientTs: clientTs ? new Date(clientTs) : null,
        },
      });

      for (const ans of answers) {
        await tx.scanAnswer.create({
          data: {
            scanSessionId: session.id,
            checkId: ans.checkId,
            answer: ans.answer,
          },
        });
      }

      await tx.feedEvent.create({
        data: {
          type: "scan",
          action: `scanned room ${room.slug}: ${answers.length} checks answered`,
          userId: user.id,
          householdId,
        },
      });

      return session;
    });

    return NextResponse.json({
      ok: true,
      scanSessionId: result.id,
      answersWritten: answers.length,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
