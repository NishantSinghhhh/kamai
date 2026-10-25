import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the dashboard only ever talks to kamai's free routes
  reactStrictMode: true,
};

export default nextConfig;
