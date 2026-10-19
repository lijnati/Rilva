import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Snapshot files are read from disk by server components; make sure they ship with the server output.
  outputFileTracingIncludes: {
    "/": ["./public/snapshots/**/*"],
  },
};

export default nextConfig;
