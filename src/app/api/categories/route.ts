import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const deletedOnly = searchParams.get("deletedOnly") === "true";

    const whereClause: any = {};
    if (deletedOnly) {
      whereClause.isDeleted = true;
    } else if (!includeDeleted) {
      whereClause.isDeleted = false;
    }

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    });


    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Category name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check if duplicate exists
    const duplicate = await prisma.category.findFirst({
      where: { name: trimmedName },
    });

    if (duplicate) {
      if (duplicate.isDeleted) {
        // Restore category
        const restored = await prisma.category.update({
          where: { id: duplicate.id },
          data: { isDeleted: false },
        });

        await writeAuditLog({
          action: "RESTORE_CATEGORY",
          targetTable: "Category",
          targetId: restored.id,
          userId: sessionUser.userId as string,
          details: `Restored soft-deleted category: ${trimmedName}`,
        });

        return NextResponse.json({
          message: "Category restored successfully.",
          category: restored,
        });
      }

      return NextResponse.json(
        { error: "Category already exists." },
        { status: 409 }
      );
    }

    const newCategory = await prisma.category.create({
      data: { name: trimmedName },
    });

    await writeAuditLog({
      action: "CREATE_CATEGORY",
      targetTable: "Category",
      targetId: newCategory.id,
      userId: sessionUser.userId as string,
      details: `Created new category: ${trimmedName}`,
    });

    return NextResponse.json({
      message: "Category created successfully.",
      category: newCategory,
    }, { status: 201 });
  } catch (error) {
    console.error("Category create error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
