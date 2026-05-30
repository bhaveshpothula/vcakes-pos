import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { LogType } from "@prisma/client";

// Generate a unique human-readable transaction ID (e.g. SD-2605-A3DF)
function generateTransactionId(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // "260526"
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase(); // "A3DF"
  return `SD-${dateStr}-${randStr}`;
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const staffId = searchParams.get("staffId");

    const offset = (page - 1) * limit;

    const whereClause: any = { isDeleted: false };

    // Search filter
    if (search) {
      whereClause.OR = [
        { transactionId: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        {
          saleItems: {
            some: {
              itemName: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    // Staff filter
    if (staffId) {
      whereClause.staffId = staffId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of that day (23:59:59.999)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        include: {
          staff: {
            select: { id: true, name: true, email: true },
          },
          saleItems: true,
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      sales,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      totalCount,
    });
  } catch (error) {
    console.error("Sales fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { items, notes, payments, customerName, customerPhone, status } = await req.json();

    const validStatuses = ["PAID", "PENDING"];
    let saleStatus = "PAID";
    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status: ${status}. Must be PAID or PENDING.` },
          { status: 400 }
        );
      }
      saleStatus = status;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required to complete checkout." },
        { status: 400 }
      );
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "At least one payment entry is required to complete checkout." },
        { status: 400 }
      );
    }

    // Validate payment methods and amounts
    const validMethods = ["CASH", "UPI", "CARD"];
    let paymentsTotal = 0;
    for (const p of payments) {
      if (!p.method || !validMethods.includes(p.method)) {
        return NextResponse.json(
          { error: `Invalid payment method: ${p.method}. Must be CASH, UPI, or CARD.` },
          { status: 400 }
        );
      }
      const amt = parseFloat(p.amount);
      if (isNaN(amt) || amt <= 0) {
        return NextResponse.json(
          { error: `Invalid payment amount: ${p.amount}. Must be greater than zero.` },
          { status: 400 }
        );
      }
      paymentsTotal += amt;
    }

    const txId = generateTransactionId();

    // Run checkout inside transaction
    const saleResult = await prisma.$transaction(async (tx: any) => {
      let totalAmount = 0;
      const saleItemData = [];
      const inventoryLogs = [];

      // 1. Process each item, lock stock, verify availability
      for (const cartItem of items) {
        const item = await tx.item.findUnique({
          where: { id: cartItem.id },
        });

        if (!item || item.isDeleted || !item.isActive) {
          throw new Error(`Item "${cartItem.name || cartItem.id}" is no longer available.`);
        }

        if (item.stock < cartItem.quantity) {
          throw new Error(`Out of stock: "${item.name}" only has ${item.stock} left (requested ${cartItem.quantity}).`);
        }

        const salePrice = parseFloat(cartItem.price);
        if (isNaN(salePrice) || salePrice < 0) {
          throw new Error(`Invalid price for item "${item.name}".`);
        }
console.log("ITEM", cartItem);
const discountPercent = cartItem.discountPercent || 0;
const itemTotal =
  salePrice * (1 - discountPercent / 100) * cartItem.quantity;
        totalAmount += itemTotal;

        saleItemData.push({
          itemId: item.id,
          itemName: item.name,
          price: salePrice,
          quantity: cartItem.quantity,
          totalAmount: itemTotal,
          note: cartItem.note ? String(cartItem.note).trim() : null,
        });

        // Decrement stock
        const updatedItem = await tx.item.update({
          where: { id: item.id },
          data: {
            stock: {
              decrement: cartItem.quantity,
            },
          },
        });

        // Prepare Inventory Log
        inventoryLogs.push({
          itemId: item.id,
          changeQty: -cartItem.quantity,
          previousQty: item.stock,
          currentQty: updatedItem.stock,
          type: LogType.SALE,
          notes: `Sold via transaction: ${txId}`,
        });
      }

      // Verify that total split matches the total bill
      /*
if (totalAmount.toFixed(2) !== paymentsTotal.toFixed(2)) {
  throw new Error(
    `Payment mismatch: Billed total is ₹${totalAmount.toFixed(2)}, but total paid is ₹${paymentsTotal.toFixed(2)}.`
  );
}
*/

      // 2. Create the Sale record
const discountedTotal = totalAmount;
      const sale = await tx.sale.create({
        data: {
          transactionId: txId,
totalAmount: discountedTotal,
          notes,
          customerName: customerName ? customerName.trim() : null,
          customerPhone: customerPhone ? customerPhone.trim() : null,
          status: saleStatus as any,
          staffId: sessionUser.userId as string,
        },
      });

      // 3. Create Payment records
      for (const p of payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: p.method,
            amount: parseFloat(p.amount),
            referenceNo: p.referenceNo ? String(p.referenceNo).trim() : null,
            notes: p.notes ? String(p.notes).trim() : null,
          },
        });
      }

      // 4. Create SaleItems records
      const saleItemsToInsert = saleItemData.map((sItem) => ({
        ...sItem,
        saleId: sale.id,
      }));

      await tx.saleItem.createMany({
        data: saleItemsToInsert,
      });

      // 5. Save Inventory Logs
      for (const log of inventoryLogs) {
        await tx.inventoryLog.create({
          data: log,
        });
      }

      return { sale, txId, totalAmount };
    });

    // Write audit log
    await writeAuditLog({
      action: "CREATE_SALE",
      targetTable: "Sale",
      targetId: saleResult.sale.id,
      userId: sessionUser.userId as string,
      details: `Completed checkout for sale ${saleResult.txId}. Total amount: ₹${saleResult.totalAmount.toFixed(2)}. Payments: ${payments.map(p => `${p.method}: ₹${p.amount}`).join(", ")}`,
    });

    // Return receipt-ready details
    const receipt = await prisma.sale.findUnique({
      where: { id: saleResult.sale.id },
      include: {
        staff: {
          select: { name: true },
        },
        saleItems: true,
        payments: true,
      },
    });

    return NextResponse.json({
      message: "Checkout completed successfully.",
      sale: receipt,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Sales checkout transaction error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to complete transaction checkout." },
      { status: 400 }
    );
  }
}
