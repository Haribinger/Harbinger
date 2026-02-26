const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx'],
  // Disable source maps in dev to prevent 404s for internal files
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    config.resolve.extensions.push('.jsx');
    // Disable source maps in dev mode to avoid 404s
    if (dev) {
      config.devtool = false;
    }
    return config;
  },
  turbopack: {
    resolveExtensions: ['.js', '.jsx'],
  },
  async headers() {
    // In dev, skip CSP so HMR/Turbopack doesn't fight you
    if (isDev) return [];

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              "connect-src 'self' https:; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
