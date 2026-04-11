import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

function blobImageRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const manifestPath = join(process.cwd(), "src/data/blobAssetUrls.json");
  if (!existsSync(manifestPath)) return [];

  try {
    const map = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    const hosts = new Set<string>();
    for (const value of Object.values(map)) {
      if (typeof value !== "string") continue;
      try {
        hosts.add(new URL(value).hostname);
      } catch {
        /* ignore invalid URL */
      }
    }
    return [...hosts].map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    }));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      ...blobImageRemotePatterns(),
    ],
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
};

export default nextConfig;
