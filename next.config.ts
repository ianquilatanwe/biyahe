import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run build:test` and `npm run start:test` use their own folder (.next-test), so browser tests can
  // build and serve while `npm run dev` keeps using .next. npm names the running script in npm_lifecycle_event.
  distDir: process.env.npm_lifecycle_event?.endsWith(":test") ? ".next-test" : ".next",
};

export default nextConfig;
