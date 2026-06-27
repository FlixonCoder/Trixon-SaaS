import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow SVG badge images from the backend API to render in <img> tags
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.trixon.cloud",
        pathname: "/api/badge/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/api/badge/**",
      },
    ],
  },

  // Bypass static export for pages that need server-side rendering
  // (Next.js App Router handles this automatically — no extra config needed)
};

export default nextConfig;
