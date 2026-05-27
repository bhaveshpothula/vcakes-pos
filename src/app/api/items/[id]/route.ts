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
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const itemId = params.id;
    const body = await req.json();

    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!existingItem || existingItem.isDeleted) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (body.name !== undefined) dataToUpdate.name = body.name.trim();
    if (body.lowStockThreshold !== undefined) dataToUpdate.lowStockThreshold = parseInt(body.lowStockThreshold);
    if (body.categoryId !== undefined) dataToUpdate.categoryId = body.categoryId;
    if (body.isActive !== undefined) dataToUpdate.isActive = Boolean(body.isActive);

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: dataToUpdate,
    });

    await writeAuditLog({
      action: "UPDATE_ITEM",
      targetTable: "Item",
      targetId: itemId,
      userId: sessionUser.userId as string,
      details: {
        before: {
          name: existingItem.name,
          isActive: existingItem.isActive,
          lowStockThreshold: existingItem.lowStockThreshold,
          categoryId: existingItem.categoryId,
        },
        after: dataToUpdate,
      },
    });


    return NextResponse.json({
      message: "Item updated successfully.",
      item: updatedItem,
    });
  } catch (error) {
    console.error("Item update error:", error);
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
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const itemId = params.id;

    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!existingItem || existingItem.isDeleted) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    // Soft delete
    const softDeletedItem = await prisma.item.update({
      where: { id: itemId },
      data: { 
        isDeleted: true,
        isActive: false
      },
    });

    await writeAuditLog({
      action: "SOFT_DELETE_ITEM",
      targetTable: "Item",
      targetId: itemId,
      userId: sessionUser.userId as string,
      details: `Soft deleted item: ${existingItem.name}`,
    });

    return NextResponse.json({
      message: "Item soft-deleted successfully.",
      item: softDeletedItem,
    });
  } catch (error) {
    console.error("Item soft delete error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
