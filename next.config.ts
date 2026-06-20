import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  ...(isGhPages ? { output: "export", basePath: "/kick-man" } : {}),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
