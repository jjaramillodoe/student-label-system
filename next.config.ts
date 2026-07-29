import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Buffer for client-side mdb-reader is provided via `import { Buffer } from 'buffer'`
  // in legacyRoster.ts — no custom webpack/turbopack polyfill needed.
};

export default nextConfig;
