
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import prisma from "../src/lib/db";


async function main() {
  console.log("Seeding started...");

  // 1. Create Default Users
  const adminPasswordHash = await bcrypt.hash("password123", 10);
  const staffPasswordHash = await bcrypt.hash("staff123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bakery.com" },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      email: "admin@bakery.com",
      name: "Admin User",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@bakery.com" },
    update: {
      passwordHash: staffPasswordHash,
    },
    create: {
      email: "staff@bakery.com",
      name: "Staff User",
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
    },
  });


  console.log("Users seeded:", { admin: admin.email, staff: staff.email });

  // 2. Preloaded Categories & Items
  const categoryData = [
    {
      name: "Cakes",
      items: [
        "Vanilla",
        "Plain Chocolate",
        "Pineapple",
        "Strawberry",
        "Black Forest",
        "White Forest",
        "Blueberry",
        "Butterscotch",
        "Red Velvet",
        "Fusion Chocolate",
        "Pure Chocolate",
        "Hazelnut",
        "Nutty Chocolate",
        "Choco Chip",
        "Death by Chocolate",
      ],
    },
    {
      name: "Cut Pieces",
      items: [
        "Butterscotch",
        "Pure Chocolate",
        "Nutty Chocolate",
        "Strawberry",
        "Pineapple",
        "Black Forest",
        "White Forest",
        "Fusion Chocolate",
        "Blueberry",
        "Death by Chocolate",
      ],
    },
    {
      name: "Puffs & Savories",
      items: [
        "Mushroom Puff",
        "Paneer Puff",
        "Veg Puff",
        "Kadai Veg Puff",
        "Aloo Puff",
        "Korean Cheese Bun",
        "Choco Lava",
        "Brownie",
        "Carrot Walnut Cupcake",
      ],
    },
    {
      name: "Party Combo Items",
      items: [
        "Balloons",
        "Sparkles",
        "Snow Spray",
        "Ribbon Spray",
        "Tags",
        "Sash",
        "Caps",
        "Poppers",
      ],
    },
    {
      name: "Premium Chocolates & Add-ons",
      items: [
        "Ferrero Rocher",
        "Kinder Bueno",
        "Nutella",
        "Raffaello",
      ],
    },
    {
      name: "Cookies & Snacks",
      items: [
        "Water Bottles",
        "Ragi Cookies",
        "Fruit Cookies",
        "Kaju Cookies",
        "Whole Wheat Cookies",
        "Nutella B-Ready",
      ],
    },
  ];

  for (const cat of categoryData) {
    // Check if category already exists
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name },
    });

    console.log(`Category created/verified: ${category.name}`);

    for (const itemName of cat.items) {
      // Check if item already exists under this category
      const existingItem = await prisma.item.findFirst({
        where: { name: itemName, categoryId: category.id },
      });

      if (!existingItem) {
        const item = await prisma.item.create({
          data: {
            name: itemName,
            stock: 30, // Default seed stock
            lowStockThreshold: 10,
            categoryId: category.id,
          },
        });


        // Add to Inventory Log
        await prisma.inventoryLog.create({
          data: {
            itemId: item.id,
            changeQty: 30,
            previousQty: 0,
            currentQty: 30,
            type: LogType.INITIAL,
            notes: "Seed database initialization",
          },
        });
      }
    }
  }

  // Create seed audit log
  await prisma.auditLog.create({
    data: {
      action: "SEED_DATABASE",
      targetTable: "Multiple",
      targetId: "Seed",
      details: "Database successfully seeded with standard categories, items, and credentials.",
      userId: admin.id,
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
