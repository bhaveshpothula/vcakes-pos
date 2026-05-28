import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import * as fs from "fs";
import * as path from "path";

// GET - List all backups
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const backups = await prisma.backupLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        backupType: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ backups });
  } catch (error) {
    console.error("Fetch backups error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST - Create manual backup
export async function POST(req: NextRequest) {
  let sessionUser;
  try {
    sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `bakery_backup_${timestamp}.json`;

    // Fetch all database records
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

    const backupJsonString = JSON.stringify(backupData, null, 2);

    // 1. Write to Database BackupLog table (ensures cloud persistence)
    const backupRecord = await prisma.backupLog.create({
      data: {
        fileName,
        backupType: "MANUAL",
        status: "SUCCESS",
        dataContent: backupJsonString,
      },
    });

    // 2. Write to local file system if local directory is writeable (for double redundancy)
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(backupDir, fileName), backupJsonString);
    } catch (fsError) {
      console.warn("Failed to write backup to local disk (probably serverless/read-only environment), but database backup succeeded:", fsError);
    }

    await writeAuditLog({
      action: "CREATE_BACKUP",
      targetTable: "BackupLog",
      targetId: backupRecord.id,
      userId: sessionUser?.userId as string | undefined,
      details: `Created manual database backup: ${fileName}`,
    });


    return NextResponse.json({
      message: "Backup created successfully.",
      backup: {
        id: backupRecord.id,
        fileName: backupRecord.fileName,
        createdAt: backupRecord.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Backup creation error:", error);

    // Save failed backup log
    try {
      await prisma.backupLog.create({
        data: {
          fileName: `bakery_backup_failed_${Date.now()}.json`,
          backupType: "MANUAL",
          status: "FAILED",
          dataContent: "",
          errorLog: error.message || String(error),
        },
      });
    } catch (e) {
      console.error("Failed to write error backup log:", e);
    }

    return NextResponse.json(
      { error: "Failed to create database backup: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
