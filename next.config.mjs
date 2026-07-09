/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client"],
};

export default nextConfig;
