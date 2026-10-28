import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests build into their own folder (NEXT_DIST_DIR=.next-test), so `next build` / `next start`
  // can run while `next dev` is open on .next without the two overwriting each other.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
