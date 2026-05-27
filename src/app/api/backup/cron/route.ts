import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Cron Secret
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET || "fallback-cron-secret-key-2026-xyz";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized cron execution." },
        { status: 401 }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `bakery_auto_backup_${timestamp}.json`;

    // 2. Query all database records
    const [users, categories, items, sales, saleItems, inventoryLogs, auditLogs, payments] = await Promise.all([
      prisma.user.findMany(),
      prisma.category.findMany(),
      prisma.item.findMany(),
      prisma.sale.findMany(),
      prisma.saleItem.findMany(),
      prisma.inventoryLog.findMany(),
      prisma.auditLog.findMany(),
      prisma.payment.findMany(),
    ]);

    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        users,
        categories,
        items,
        sales,
        saleItems,
        inventoryLogs,
        auditLogs,
        payments,
      },
    };

    const backupJsonString = JSON.stringify(backupData);

    // 3. Save backup in database
    const backupRecord = await prisma.backupLog.create({
      data: {
        fileName,
        backupType: "AUTO",
        status: "SUCCESS",
        dataContent: backupJsonString,
      },
    });

    // 4. Save locally if possible
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(backupDir, fileName), backupJsonString);
    } catch (fsError) {
      console.warn("Failed to write auto-backup to disk (serverless/read-only), database backup succeeded:", fsError);
    }

    // Write audit log
    await writeAuditLog({
      action: "AUTO_BACKUP",
      targetTable: "BackupLog",
      targetId: backupRecord.id,
      details: "Automated daily system backup completed successfully.",
    });

    return NextResponse.json({
      message: "Automated backup completed.",
      backupId: backupRecord.id,
    });
  } catch (error: any) {
    console.error("Auto backup failed:", error);
    
    try {
      await prisma.backupLog.create({
        data: {
          fileName: `bakery_auto_backup_failed_${Date.now()}.json`,
          backupType: "AUTO",
          status: "FAILED",
          dataContent: "",
          errorLog: error.message || String(error),
        },
      });
    } catch (e) {
      console.error("Failed to write failed auto-backup log:", e);
    }

    return NextResponse.json(
      { error: "Cron auto backup failed: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
