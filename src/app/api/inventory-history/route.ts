import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const userFilter = searchParams.get("user") || "";
    const dateParam = searchParams.get("date") || "";

    const whereClause: any = {};

    // 1. Filter by search (item name)
    if (search.trim() !== "") {
      whereClause.item = {
        name: {
          contains: search.trim(),
          mode: "insensitive",
        },
      };
    }

    // 2. Filter by user (userName string or userId relation)
    if (userFilter.trim() !== "") {
      whereClause.OR = [
        {
          userName: {
            contains: userFilter.trim(),
            mode: "insensitive",
          },
        },
        {
          user: {
            name: {
              contains: userFilter.trim(),
              mode: "insensitive",
            },
          },
        },
      ];
    }

    // 3. Filter by date (between start and end of that day)
    if (dateParam.trim() !== "") {
      const dateVal = new Date(dateParam);
      if (!isNaN(dateVal.getTime())) {
        const startOfDay = new Date(dateVal);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(dateVal);
        endOfDay.setHours(23, 59, 59, 999);

        whereClause.createdAt = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    // Fetch logs ordered newest first
    const logs = await prisma.inventoryLog.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch distinct users who have logs for the filter dropdown
    const distinctUsersRaw = await prisma.inventoryLog.findMany({
      where: {
        userName: { not: null },
      },
      distinct: ["userName"],
      select: {
        userName: true,
      },
    });
    
    const uniqueUsers = distinctUsersRaw
      .map((u: any) => u.userName)
      .filter(Boolean) as string[];

    return NextResponse.json({
      logs,
      users: uniqueUsers,
    });
  } catch (error: any) {
    console.error("Inventory history fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch inventory history." },
      { status: 500 }
    );
  }
}
