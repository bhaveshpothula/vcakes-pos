import prisma from "./db";

interface AuditLogParams {
  action: string;
  targetTable: string;
  targetId?: string | null;
  details?: any;
  userId?: string | null;
}

export async function writeAuditLog({
  action,
  targetTable,
  targetId = null,
  details = null,
  userId = null,
}: AuditLogParams) {
  try {
    let detailsString = "";
    if (details) {
      detailsString = typeof details === "string" ? details : JSON.stringify(details);
    }

    return await prisma.auditLog.create({
      data: {
        action,
        targetTable,
        targetId,
        details: detailsString,
        userId,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
