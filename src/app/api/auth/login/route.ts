import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { comparePassword, signJWT, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Auto-bootstrap default admin if none exists
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", isDeleted: false },
    });
    if (adminCount === 0) {
      const adminPasswordHash = await hashPassword("password123");
      await prisma.user.create({
        data: {
          email: "admin@bakery.com",
          name: "Admin User",
          passwordHash: adminPasswordHash,
          role: "ADMIN",
        },
      });
      console.log("Default admin account auto-bootstrapped.");
    }


    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Find active user
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        isDeleted: false,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      // Log failed attempt for security audit
      await writeAuditLog({
        action: "LOGIN_FAILED",
        targetTable: "User",
        targetId: user.id,
        details: `Failed login attempt for email: ${email}`,
      });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Write audit log
    await writeAuditLog({
      action: "LOGIN_SUCCESS",
      targetTable: "User",
      targetId: user.id,
      userId: user.id,
      details: "User successfully authenticated.",
    });

    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // Set cookie
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
