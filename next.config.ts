import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not walk up to ~/Develop, where a
  // stray lockfile makes Next infer the entire workspace as the root and scan
  // every sibling repository (which stalls the build).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
