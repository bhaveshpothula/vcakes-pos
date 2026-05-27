import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser || sessionUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Users list fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
