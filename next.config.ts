import type { NextConfig } from "next";

// Static export: the whole site is plain files (all processing happens in the visitor's browser),
// served by the nginx container on Yani's server. `npm run build` writes them to out/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
