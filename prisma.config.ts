import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "postgresql://neondb_owner:npg_ihEjG8ucTI6O@ep-restless-butterfly-aqfrmo4b-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
  migrations: {
    seed: "/Users/bhaveshpothula/.bun/bin/bun run prisma/seed.ts",
  },


});
