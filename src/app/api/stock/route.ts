import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { LogType, Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    const { itemId, changeQty, notes } = await req.json();

    if (!itemId || changeQty === undefined) {
      return NextResponse.json(
        { error: "ItemId and changeQty are required." },
        { status: 400 }
      );
    }

    const parsedChangeQty = parseInt(changeQty);
    if (isNaN(parsedChangeQty) || parsedChangeQty === 0) {
      return NextResponse.json(
        { error: "Change quantity must be a non-zero integer." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const item = await tx.item.findUnique({
        where: { id: itemId },
      });

      if (!item || item.isDeleted) {
        throw new Error("Item not found.");
      }

      const newStock = item.stock + parsedChangeQty;
      if (newStock < 0) {
        throw new Error(`Insufficient stock. Current stock is ${item.stock}, cannot decrement by ${Math.abs(parsedChangeQty)}.`);
      }

      const updatedItem = await tx.item.update({
        where: { id: itemId },
        data: { stock: newStock },
      });

      const invLog = await tx.inventoryLog.create({
        data: {
          itemId,
          changeQty: parsedChangeQty,
          previousQty: item.stock,
          currentQty: newStock,
          type: LogType.MANUAL_UPDATE,
          notes: notes || "Manual stock adjustment by admin",
        },
      });

      return { updatedItem, invLog };
    });

    await writeAuditLog({
      action: "UPDATE_STOCK",
      targetTable: "Item",
      targetId: itemId,
      userId: sessionUser.userId as string,
      details: `Manually adjusted stock of "${result.updatedItem.name}" by ${parsedChangeQty > 0 ? "+" : ""}${parsedChangeQty}. New stock: ${result.updatedItem.stock}. Notes: ${notes || "None"}.`,
    });

    return NextResponse.json({
      message: "Stock adjusted successfully.",
      item: result.updatedItem,
    });
  } catch (error: any) {
    console.error("Stock adjustment transaction error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to adjust stock." },
      { status: 400 }
    );
  }
}

// GET - Retrieve inventory logs for analysis
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const whereClause: any = {};
    if (itemId) {
      whereClause.itemId = itemId;
    }

    const logs = await prisma.inventoryLog.findMany({
      where: whereClause,
      include: {
        item: {
          select: { name: true, category: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Inventory logs fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
