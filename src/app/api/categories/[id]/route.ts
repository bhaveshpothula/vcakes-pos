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

    const categoryId = params.id;
    const { name } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Category name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.isDeleted) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    // Check duplicate name
    const duplicate = await prisma.category.findFirst({
      where: {
        name: trimmedName,
        id: { not: categoryId },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Another category already exists with this name." },
        { status: 409 }
      );
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: { name: trimmedName },
    });

    await writeAuditLog({
      action: "UPDATE_CATEGORY",
      targetTable: "Category",
      targetId: categoryId,
      userId: sessionUser.userId as string,
      details: {
        before: { name: existingCategory.name },
        after: { name: trimmedName },
      },
    });

    return NextResponse.json({
      message: "Category updated successfully.",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Category update error:", error);
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

    const categoryId = params.id;

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.isDeleted) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    // Run cascade soft delete in a transaction: soft-delete Category, and soft-delete all items inside it
    const result = await prisma.$transaction(async (tx) => {
      // 1. Soft delete Category
      const cat = await tx.category.update({
        where: { id: categoryId },
        data: { isDeleted: true },
      });

      // 2. Soft delete Items inside category
      const itemsCount = await tx.item.updateMany({
        where: { categoryId, isDeleted: false },
        data: { 
          isDeleted: true,
          isActive: false
        },
      });

      return { cat, itemsCount: itemsCount.count };
    });

    await writeAuditLog({
      action: "SOFT_DELETE_CATEGORY",
      targetTable: "Category",
      targetId: categoryId,
      userId: sessionUser.userId as string,
      details: `Soft deleted category: ${existingCategory.name}. Soft-deleted ${result.itemsCount} child items.`,
    });

    return NextResponse.json({
      message: `Category soft-deleted successfully. ${result.itemsCount} items soft-deleted.`,
      category: result.cat,
    });
  } catch (error) {
    console.error("Category soft delete error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
