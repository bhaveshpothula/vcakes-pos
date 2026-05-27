import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/bakery_pos?schema=public",
  },
  migrations: {
    seed: "/Users/bhaveshpothula/.bun/bin/bun run prisma/seed.ts",
  },


});
