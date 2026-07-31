import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    useTypeScriptCli: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
