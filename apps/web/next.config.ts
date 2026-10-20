import type { NextConfig } from "next";

const nextDistDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig: NextConfig = {
  distDir: nextDistDir,
  transpilePackages: ["@markless/shared"],
  devIndicators: {
    position: "bottom-right",
  },
  turbopack: {},
  allowedDevOrigins: [
    "web.marklessdev.online",
    "api.marklessdev.online",
    "localhost:3000",
    "localhost:3001",
  ],
  images: {
    unoptimized: process.env.NODE_ENV === "development" || process.env.CF_WORKERS === "1",
    remotePatterns: [
      { protocol: "https", hostname: "cdn.markless.dev" },
      { protocol: "https", hostname: "assets.mp3totext.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
