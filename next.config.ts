import type { NextConfig } from "next";

const nextDistDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig: NextConfig = {
    distDir: nextDistDir,
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
        unoptimized: process.env.NODE_ENV === "development",
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.watermarkremover.tech",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
            },
        ],
    },
};

export default nextConfig;
