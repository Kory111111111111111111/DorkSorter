import type { NextConfig } from "next";

// GitHub project sites are served from /<repo>. The Pages workflow sets BASE_PATH
// from actions/configure-pages. Local builds leave it empty.
const rawBasePath = process.env.BASE_PATH ?? "";
const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
