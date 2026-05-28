import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const backupId = params.id;

    const backup = await prisma.backupLog.findUnique({
      where: { id: backupId },
    });

    if (!backup || backup.status !== "SUCCESS") {
      return NextResponse.json({ error: "Backup record not found." }, { status: 404 });
    }

    // Return the raw text representation of the backup JSON
    return new NextResponse(backup.dataContent, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      },
    });
  } catch (error) {
    console.error("Backup detail fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
