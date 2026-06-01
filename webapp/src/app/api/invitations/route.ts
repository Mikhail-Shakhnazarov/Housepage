import { requireUser, requireHouseholdOwner, handleAuthError } from "@/lib/household-auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

const ALLOWED_ROLES = ["OWNER", "MEMBER", "SUBLET"];

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { householdId, email, role } = await req.json();

        if (!householdId || !email) {
            return NextResponse.json({ error: "Missing required fields: householdId, email" }, { status: 400 });
        }

        if (role && !ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: `Invalid role: ${role}. Allowed: ${ALLOWED_ROLES.join(", ")}` }, { status: 400 });
        }

        await requireHouseholdOwner(user.id!, householdId);

        const token = crypto.randomBytes(16).toString("hex");

        const invitation = await prisma.invitation.create({
            data: {
                householdId,
                email,
                role: role || "MEMBER",
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        await prisma.feedEvent.create({
            data: {
                type: "household",
                action: `invited ${email} to join`,
                userId: user.id,
                householdId,
            },
        });

        return NextResponse.json({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            token: invitation.token,
            expiresAt: invitation.expiresAt,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
