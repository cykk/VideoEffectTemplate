import "tsconfig-paths/register";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/server/src/lib/db/schema/starter.ts",
  out: "./drizzle-starter",
  strict: true,
  migrations: { prefix: "timestamp" },
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://starter:starter@localhost:5432/starter",
  },
});
