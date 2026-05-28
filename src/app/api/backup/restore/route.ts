import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { backupId } = await req.json();
    if (!backupId) {
      return NextResponse.json({ error: "Backup ID is required." }, { status: 400 });
    }

    // Retrieve backup log
    const backupLog = await prisma.backupLog.findUnique({
      where: { id: backupId },
    });

    if (!backupLog || backupLog.status !== "SUCCESS" || !backupLog.dataContent) {
      return NextResponse.json({ error: "Valid backup file not found." }, { status: 404 });
    }

    const backup = JSON.parse(backupLog.dataContent);
    const { users, categories, items, sales, saleItems, inventoryLogs, auditLogs, payments } = backup.data;

    // Run restore inside transaction to prevent database corruption
    await prisma.$transaction(async (tx: any) => {
      // 1. Delete all existing records in dependency order (children first)
      await tx.saleItem.deleteMany();
      await tx.payment.deleteMany();
      await tx.sale.deleteMany();
      await tx.inventoryLog.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.item.deleteMany();
      await tx.category.deleteMany();
      await tx.user.deleteMany();

      // 2. Re-insert Users
      if (users && users.length > 0) {
        await tx.user.createMany({ data: users });
      }

      // 3. Re-insert Categories
      if (categories && categories.length > 0) {
        await tx.category.createMany({ data: categories });
      }

      // 4. Re-insert Items
      if (items && items.length > 0) {
        await tx.item.createMany({ data: items });
      }

      // 5. Re-insert Sales
      if (sales && sales.length > 0) {
        await tx.sale.createMany({ data: sales });
      }

      // 6. Re-insert Payments
      if (payments && payments.length > 0) {
        await tx.payment.createMany({ data: payments });
      }

      // 7. Re-insert SaleItems
      if (saleItems && saleItems.length > 0) {
        await tx.saleItem.createMany({ data: saleItems });
      }

      // 8. Re-insert InventoryLogs
      if (inventoryLogs && inventoryLogs.length > 0) {
        await tx.inventoryLog.createMany({ data: inventoryLogs });
      }

      // 9. Re-insert AuditLogs
      if (auditLogs && auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: auditLogs });
      }
    });

    // Write audit log to the newly restored audit logs table
    await writeAuditLog({
      action: "RESTORE_DATABASE",
      targetTable: "BackupLog",
      targetId: backupId,
      userId: sessionUser.userId as string,
      details: `Database restored to backup point: ${backupLog.fileName} (Backup created on: ${backupLog.createdAt})`,
    });

    return NextResponse.json({
      message: "Database restored successfully. Session may need to be re-authenticated if user credentials changed.",
    });
  } catch (error: any) {
    console.error("Database restore error:", error);
    return NextResponse.json(
      { error: "Failed to restore database: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
