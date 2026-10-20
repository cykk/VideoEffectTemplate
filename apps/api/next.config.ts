import type { NextConfig } from "next";

const nextDistDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig: NextConfig = {
  distDir: nextDistDir,
  transpilePackages: ["@markless/shared"],
  allowedDevOrigins: [
    "web.marklessdev.online",
    "api.marklessdev.online",
    "localhost:3000",
    "localhost:3001",
  ],
};

export default nextConfig;
