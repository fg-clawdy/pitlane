import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Optimizations for faster dev and build
  webpack: (config, { dev }) => {
    if (dev) {
      // Use native file watching instead of polling to avoid constant rebuilds
      config.watchOptions = {
        ignored: ['**/node_modules', '**/.next'],
        // Remove polling entirely - let the OS notify of changes
      };
    }
    return config;
  },
  // Reduce the number of bundles compiled in dev mode
  experimental: {
    optimizePackageImports: ['lucide-react', 'zustand', '@radix-ui'],
  },
};

export default nextConfig;
