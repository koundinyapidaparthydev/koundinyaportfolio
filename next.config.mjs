/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_PAGES === "1";

const nextConfig = {
  output: isPages ? "export" : undefined,
  distDir: isPages ? "dist" : undefined,
  basePath: isPages ? "/koundinyaportfolio" : undefined,
  images: {
    unoptimized: isPages,
  },
};

export default nextConfig;
