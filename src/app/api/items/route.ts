import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { LogType, Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const deletedOnly = searchParams.get("deletedOnly") === "true";

    const whereClause: any = {};
    if (deletedOnly) {
      whereClause.isDeleted = true;
    } else if (!includeDeleted) {
      whereClause.isDeleted = false;
    }

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }


    const items = await prisma.item.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Items fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { name, stock, lowStockThreshold, categoryId } = await req.json();

    if (!name || categoryId === undefined) {
      return NextResponse.json(
        { error: "Name and categoryId are required fields." },
        { status: 400 }
      );
    }

    const parsedStock = parseInt(stock || 0);
    const parsedThreshold = parseInt(lowStockThreshold || 10);

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.isDeleted) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    // Check for soft-deleted or existing duplicate name in this category
    const duplicate = await prisma.item.findFirst({
      where: {
        name: name.trim(),
        categoryId,
      },
    });

    if (duplicate) {
      if (duplicate.isDeleted) {
        // Restore soft-deleted item and update its stats
        const restoredItem = await prisma.$transaction(async (tx: any) => {
          const item = await tx.item.update({
            where: { id: duplicate.id },
            data: {
              isDeleted: false,
              isActive: true,
              stock: parsedStock,
              lowStockThreshold: parsedThreshold,
            },
          });

          await tx.inventoryLog.create({
            data: {
              itemId: item.id,
              changeQty: parsedStock,
              previousQty: 0,
              currentQty: parsedStock,
              type: LogType.RESTORE,
              notes: "Restored soft-deleted item and updated stock level.",
            },
          });

          return item;
        });

        await writeAuditLog({
          action: "RESTORE_ITEM",
          targetTable: "Item",
          targetId: restoredItem.id,
          userId: sessionUser.userId as string,
          details: `Restored soft-deleted item: ${restoredItem.name} under Category ID ${categoryId}`,
        });

        return NextResponse.json({
          message: "Item restored successfully.",
          item: restoredItem,
        });
      }

      return NextResponse.json(
        { error: "Item already exists in this category." },
        { status: 409 }
      );
    }

    // Create item inside a transaction
    const newItem = await prisma.$transaction(async (tx: any) => {
      const item = await tx.item.create({
        data: {
          name: name.trim(),
          stock: parsedStock,
          lowStockThreshold: parsedThreshold,
          categoryId,
        },
      });

      // Log initial inventory
      await tx.inventoryLog.create({
        data: {
          itemId: item.id,
          changeQty: parsedStock,
          previousQty: 0,
          currentQty: parsedStock,
          type: LogType.INITIAL,
          notes: "Initial inventory setup on item creation",
        },
      });

      return item;
    });

    // Write audit log
    await writeAuditLog({
      action: "CREATE_ITEM",
      targetTable: "Item",
      targetId: newItem.id,
      userId: sessionUser.userId as string,
      details: `Created new item: ${newItem.name} with stock: ${parsedStock}`,
    });


    return NextResponse.json({
      message: "Item created successfully.",
      item: newItem,
    }, { status: 201 });
  } catch (error) {
    console.error("Item create error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
