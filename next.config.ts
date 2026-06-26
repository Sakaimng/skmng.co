import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 2678400, // 31 days — source photos change infrequently
    localPatterns: [{ pathname: "/assets/**" }],
    qualities: [40, 60, 80],
    // Match sizes props: 100vw/50vw/33vw lightbox & gallery, grid capped at 200px
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skmng.co" }],
        destination: "https://skmng.co/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
