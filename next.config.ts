import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  // Ignore ESLint errors during build for Docker compatibility
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignore TypeScript errors during build for Docker compatibility
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Allow monitor.js to be served as JavaScript with proper CSP
        source: '/api/monitor.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // Configure CSP for the main application
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data:; object-src 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
  // Allow external packages for WebSocket support
  serverExternalPackages: ['ws'],
};

export default nextConfig;
