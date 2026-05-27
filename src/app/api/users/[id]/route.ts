import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const userId = params.id;
    const body = await req.json();

    // Prevent self modification
    if (userId === sessionUser.userId) {
      return NextResponse.json({ error: "Cannot modify your own user account." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser || existingUser.isDeleted) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (body.isActive !== undefined) dataToUpdate.isActive = Boolean(body.isActive);
    if (body.name !== undefined) dataToUpdate.name = body.name.trim();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    await writeAuditLog({
      action: "UPDATE_USER_STATUS",
      targetTable: "User",
      targetId: userId,
      userId: sessionUser.userId as string,
      details: {
        before: { isActive: existingUser.isActive, name: existingUser.name },
        after: dataToUpdate,
      },
    });

    return NextResponse.json({
      message: "User status updated successfully.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const userId = params.id;

    // Prevent self deletion
    if (userId === sessionUser.userId) {
      return NextResponse.json({ error: "Cannot delete your own user account." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser || existingUser.isDeleted) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Soft delete
    const softDeletedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        isDeleted: true,
        isActive: false
      },
    });

    await writeAuditLog({
      action: "SOFT_DELETE_USER",
      targetTable: "User",
      targetId: userId,
      userId: sessionUser.userId as string,
      details: `Soft deleted staff account: ${existingUser.email}`,
    });

    return NextResponse.json({
      message: "User account soft-deleted successfully.",
      user: {
        id: softDeletedUser.id,
        email: softDeletedUser.email,
        isDeleted: true,
      },
    });
  } catch (error) {
    console.error("User soft delete error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
