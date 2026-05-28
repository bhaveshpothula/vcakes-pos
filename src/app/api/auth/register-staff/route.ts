import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "All fields (name, email, password) are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const formattedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: formattedEmail,
      },
    });

    if (existingUser) {
      if (existingUser.isDeleted) {
        // Restore user if soft-deleted
        const hashedPassword = await hashPassword(password);
        const restoredUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            passwordHash: hashedPassword,
            isDeleted: false,
            isActive: true,
          },
        });

        await writeAuditLog({
          action: "RESTORE_USER",
          targetTable: "User",
          targetId: restoredUser.id,
          userId: sessionUser.userId as string,
          details: `Restored soft-deleted user account: ${formattedEmail}`,
        });

        return NextResponse.json({
          message: "Staff account restored successfully.",
          user: {
            id: restoredUser.id,
            email: restoredUser.email,
            name: restoredUser.name,
            role: restoredUser.role,
          },
        });
      }

      return NextResponse.json(
        { error: "User with this email already exists." },
        { status: 409 }
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        name,
        email: formattedEmail,
        passwordHash: hashedPassword,
        role: Role.STAFF,
      },
    });

    // Write audit log
    await writeAuditLog({
      action: "CREATE_USER",
      targetTable: "User",
      targetId: newUser.id,
      userId: sessionUser.userId as string,
      details: `Created new staff account for: ${formattedEmail}`,
    });

    return NextResponse.json(
      {
        message: "Staff account created successfully.",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Staff registration API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
