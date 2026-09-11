import type { NextConfig } from "next";

/**
 * Parthia Health — static export configuration.
 *
 * The app is exported as plain HTML/JS/CSS (`output: "export"`) so it can be
 * hosted on Azure Static Web Apps without any server runtime. There are no
 * API routes and no server components that need a Node server at runtime.
 *
 * `trailingSlash: true` makes every route export as `<route>/index.html`, which
 * maps cleanly onto static hosts that resolve directory paths.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
