import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Timestamps for filters
    const now = new Date();
    
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run dashboard aggregate queries in parallel
    const [
      salesToday,
      salesThisMonth,
      lowStockItems,
      recentSales,
      categorySummaries,
      paymentsToday,
      paymentsThisMonth,
      salesWithPaymentsToday,
      inventoryLogsTodayCount,
      lastInventoryLog,
    ] = await Promise.all([
      // 1. Sales today
      prisma.sale.aggregate({
        where: {
          isDeleted: false,
          createdAt: { gte: startOfToday },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // 2. Sales this month
      prisma.sale.aggregate({
        where: {
          isDeleted: false,
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      // 3. Low stock alerts
      prisma.item.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          stock: { lte: prisma.item.fields.lowStockThreshold },
        },
        include: {
          category: { select: { name: true } },
        },
        orderBy: { stock: "asc" },
        take: 10,
      }),
      // 4. Recent transactions
      prisma.sale.findMany({
        where: { isDeleted: false },
        include: {
          staff: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // 5. Category-wise sales count
      prisma.category.findMany({
        where: { isDeleted: false },
        include: {
          items: {
            where: { isDeleted: false },
            include: {
              saleItems: {
                where: {
                  sale: { isDeleted: false },
                },
              },
            },
          },
        },
      }),
      // 6. Payments today grouped by method
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          sale: {
            isDeleted: false,
            createdAt: { gte: startOfToday },
          },
        },
        _sum: { amount: true },
      }),
      // 7. Payments this month grouped by method
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          sale: {
            isDeleted: false,
            createdAt: { gte: startOfMonth },
          },
        },
        _sum: { amount: true },
      }),
      // 8. Sales today with payments count (for split verification)
      prisma.sale.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: startOfToday },
        },
        include: {
          payments: { select: { id: true } },
        },
      }),
      // 9. Inventory logs today count
      prisma.inventoryLog.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),
      // 10. Last inventory log timestamp
      prisma.inventoryLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const splitCountToday = salesWithPaymentsToday.filter(s => s.payments.length > 1).length;

    // 6. Best-selling items (Aggregate quantity sold)
    const bestSellersRaw = await prisma.saleItem.groupBy({
      by: ["itemId", "itemName"],
      where: {
        sale: { isDeleted: false },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    const bestSellers = bestSellersRaw.map((item) => ({
      name: item.itemName,
      quantitySold: item._sum.quantity || 0,
      revenue: item._sum.totalAmount || 0,
    }));

    // 7. Daily Revenue Graph & Payment breakdown (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [rawDailyRevenue, rawDailyPayments] = await Promise.all([
      prisma.sale.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          sale: {
            isDeleted: false,
            createdAt: { gte: thirtyDaysAgo },
          },
        },
        select: {
          amount: true,
          method: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Group daily revenue by date
    const dailyMap: { [date: string]: { revenue: number; cash: number; upi: number; card: number } } = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap[dateKey] = { revenue: 0, cash: 0, upi: 0, card: 0 };
    }

    rawDailyRevenue.forEach((sale) => {
      const dateKey = new Date(sale.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (dailyMap[dateKey] !== undefined) {
        dailyMap[dateKey].revenue += sale.totalAmount;
      }
    });

    rawDailyPayments.forEach((payment) => {
      const dateKey = new Date(payment.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (dailyMap[dateKey] !== undefined) {
        const methodKey = payment.method.toLowerCase() as "cash" | "upi" | "card";
        dailyMap[dateKey][methodKey] += payment.amount;
      }
    });

    const dailyRevenueGraph = Object.entries(dailyMap)
      .map(([date, vals]) => ({
        date,
        revenue: vals.revenue,
        cash: vals.cash,
        upi: vals.upi,
        card: vals.card,
      }))
      .reverse();

    // Format Category Summaries
    const categoryAnalytics = categorySummaries.map((cat) => {
      let totalCatRevenue = 0;
      let totalCatQty = 0;

      cat.items.forEach((item) => {
        item.saleItems.forEach((si) => {
          totalCatRevenue += si.totalAmount;
          totalCatQty += si.quantity;
        });
      });

      return {
        name: cat.name,
        revenue: totalCatRevenue,
        quantitySold: totalCatQty,
        itemCount: cat.items.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Format payment summaries by method
    const getMethodSum = (group: any[], method: string) => {
      const found = group.find((g) => g.method === method);
      return found?._sum?.amount || 0;
    };

    const cashToday = getMethodSum(paymentsToday, "CASH");
    const upiToday = getMethodSum(paymentsToday, "UPI");
    const cardToday = getMethodSum(paymentsToday, "CARD");

    const cashMonth = getMethodSum(paymentsThisMonth, "CASH");
    const upiMonth = getMethodSum(paymentsThisMonth, "UPI");
    const cardMonth = getMethodSum(paymentsThisMonth, "CARD");

    return NextResponse.json({
      summary: {
        totalToday: salesToday._sum.totalAmount || 0,
        countToday: salesToday._count.id || 0,
        totalMonth: salesThisMonth._sum.totalAmount || 0,
        cashToday,
        upiToday,
        cardToday,
        cashMonth,
        upiMonth,
        cardMonth,
        splitCountToday,
      },
      lowStockAlerts: lowStockItems.map((item) => ({
        id: item.id,
        name: item.name,
        stock: item.stock,
        lowStockThreshold: item.lowStockThreshold,
        category: item.category.name,
      })),
      bestSellers,
      recentTransactions: recentSales.map((sale) => ({
        id: sale.id,
        transactionId: sale.transactionId,
        totalAmount: sale.totalAmount,
        staffName: sale.staff.name,
        createdAt: sale.createdAt,
      })),
      dailyRevenueGraph,
      categoryAnalytics,
      inventorySummary: {
        totalToday: inventoryLogsTodayCount,
        lastUpdated: lastInventoryLog?.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
