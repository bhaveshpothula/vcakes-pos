import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { LogType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { updates } = await req.json();

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates must be a valid array." },
        { status: 400 }
      );
    }

    // Filter out rows with empty or undefined quantities
    const activeUpdates = updates.filter(
      (up: any) => up.changeQty !== undefined && up.changeQty !== null && up.changeQty !== ""
    );

    if (activeUpdates.length === 0) {
      return NextResponse.json(
        { error: "No valid stock updates were provided." },
        { status: 400 }
      );
    }

    // Validate that all quantities are positive integers
    for (const update of activeUpdates) {
      const qty = parseInt(update.changeQty);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity "${update.changeQty}" for item ID ${update.itemId || "unknown"}. Quantities must be positive numbers.` },
          { status: 400 }
        );
      }
    }

    // Run transaction
    const results = await prisma.$transaction(async (tx: any) => {
      const logsCreated = [];
      const itemsUpdated = [];

      for (const update of activeUpdates) {
        const { itemId, changeQty, notes } = update;
        const parsedQty = parseInt(changeQty);

        const item = await tx.item.findUnique({
          where: { id: itemId },
        });

        if (!item || item.isDeleted) {
          throw new Error(`Item with ID ${itemId} not found or has been deleted.`);
        }

        const newStock = item.stock + parsedQty;

        const updatedItem = await tx.item.update({
          where: { id: itemId },
          data: { stock: newStock },
        });

        const log = await tx.inventoryLog.create({
          data: {
            itemId,
            changeQty: parsedQty,
            previousQty: item.stock,
            currentQty: newStock,
            type: LogType.MANUAL_UPDATE,
            notes: notes ? notes.trim() : "Bulk stock replenishment",
            userId: sessionUser.userId as string,
            userName: sessionUser.name as string,
          },
        });

        logsCreated.push(log);
        itemsUpdated.push(updatedItem);

        // Write an audit log for each updated item
        await writeAuditLog({
          action: "UPDATE_STOCK",
          targetTable: "Item",
          targetId: itemId,
          userId: sessionUser.userId as string,
          details: `Bulk restocked item "${item.name}" by +${parsedQty}. New stock: ${newStock}. Notes: ${notes || "Bulk stock replenishment"}.`,
        });
      }

      return { itemsUpdated, logsCreated };
    });

    return NextResponse.json({
      message: "Bulk stock log submitted successfully.",
      count: results.itemsUpdated.length,
    });
  } catch (error: any) {
    console.error("Bulk stock log error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to submit bulk stock log." },
      { status: 400 }
    );
  }
}
