import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { LogType, Role } from "@prisma/client";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const saleId = params.id;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        staff: {
          select: { id: true, name: true, email: true },
        },
        saleItems: true,
        payments: true,
      },
    });

    if (!sale || sale.isDeleted) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("Single sale fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const saleId = params.id;

  console.log(`[API DELETE] Incoming request to cancel/delete sale ID: "${saleId}"`);

  if (!saleId || typeof saleId !== "string" || saleId.trim() === "") {
    console.warn("[API DELETE] Invalid sale ID provided.");
    return NextResponse.json({ error: "Invalid transaction ID." }, { status: 400 });
  }

  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      console.warn(`[API DELETE] Unauthorized access attempt for sale: ${saleId}`);
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    if (sessionUser.role !== Role.ADMIN) {
      console.warn(`[API DELETE] Forbidden access: User "${sessionUser.email}" (${sessionUser.role}) attempted to delete sale: ${saleId}`);
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required to delete transactions." },
        { status: 403 }
      );
    }

    // Check if sale exists and is not already deleted
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { saleItems: true },
    });

    if (!sale) {
      console.warn(`[API DELETE] Transaction ID "${saleId}" not found in database.`);
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (sale.isDeleted) {
      console.warn(`[API DELETE] Transaction ID "${saleId}" (${sale.transactionId}) is already deleted.`);
      return NextResponse.json({ error: "Transaction has already been deleted." }, { status: 400 });
    }

    // Execute soft delete and inventory restoration inside a transaction
    console.log(`[API DELETE] Executing soft delete transaction for TXID: ${sale.transactionId}...`);
    await prisma.$transaction(async (tx) => {
      // 1. Mark sale as deleted and update status to REFUNDED, record deletedAt
      await tx.sale.update({
        where: { id: saleId },
        data: { 
          isDeleted: true,
          deletedAt: new Date(),
          status: "REFUNDED",
        },
      });

      // 2. Restore inventory quantities
      for (const saleItem of sale.saleItems) {
        const item = await tx.item.findUnique({
          where: { id: saleItem.itemId },
        });

        if (item) {
          // Increment stock
          const updatedItem = await tx.item.update({
            where: { id: item.id },
            data: {
              stock: {
                increment: saleItem.quantity,
              },
            },
          });

          // Log stock restoration
          await tx.inventoryLog.create({
            data: {
              itemId: item.id,
              changeQty: saleItem.quantity,
              previousQty: item.stock,
              currentQty: updatedItem.stock,
              type: LogType.RESTORE,
              notes: `Stock restored from cancelled transaction: ${sale.transactionId}`,
            },
          });
          console.log(`[API DELETE] Restored ${saleItem.quantity} units to item "${item.name}" (Stock: ${item.stock} -> ${updatedItem.stock})`);
        }
      }
    });

    console.log(`[API DELETE] Soft-delete transaction completed successfully for TXID: ${sale.transactionId}`);

    // Write audit log
    await writeAuditLog({
      action: "SOFT_DELETE_SALE",
      targetTable: "Sale",
      targetId: saleId,
      userId: sessionUser.userId as string,
      details: `Soft deleted sale transaction: ${sale.transactionId}. All item stocks restored successfully.`,
    });

    return NextResponse.json({
      message: "Transaction cancelled and soft-deleted. Inventory stock restored successfully.",
    });
  } catch (error: any) {
    console.error(`[API DELETE] Failed during soft delete transaction for sale: ${saleId}`, error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel transaction and restore stock due to database error." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const saleId = params.id;
    const { status, payments } = await req.json();

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true }
    });

    if (!sale || sale.isDeleted) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (status && status !== "PAID" && status !== "PENDING") {
      return NextResponse.json({ error: "Invalid status. Must be PAID or PENDING." }, { status: 400 });
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      // 1. Update status
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: { status: status as any },
      });

      // 2. Add payments if provided
      if (payments && Array.isArray(payments)) {
        for (const p of payments) {
          await tx.payment.create({
            data: {
              saleId: saleId,
              method: p.method,
              amount: parseFloat(p.amount),
              referenceNo: p.referenceNo ? String(p.referenceNo).trim() : null,
              notes: p.notes ? String(p.notes).trim() : null,
            },
          });
        }
      }

      return updated;
    });

    // Write audit log
    await writeAuditLog({
      action: "UPDATE_SALE_STATUS",
      targetTable: "Sale",
      targetId: saleId,
      userId: sessionUser.userId as string,
      details: `Updated status of transaction ${sale.transactionId} to ${status}. Added ${payments?.length || 0} payments.`,
    });

    return NextResponse.json({
      message: "Transaction updated successfully.",
      sale: updatedSale,
    });
  } catch (error: any) {
    console.error("Sale update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update transaction." },
      { status: 500 }
    );
  }
}
