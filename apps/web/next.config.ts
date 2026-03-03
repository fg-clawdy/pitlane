import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Specify the src directory
  experimental: {
    // This tells Next.js to use the src directory
  },
};

export default nextConfig;
