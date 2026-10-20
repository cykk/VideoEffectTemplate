import "tsconfig-paths/register";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("drizzle-kit ?? DATABASE_URL ???????????????");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/server/src/lib/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  migrations: {
    prefix: "timestamp",
  },
  dbCredentials: {
    url: connectionString,
  },
});
