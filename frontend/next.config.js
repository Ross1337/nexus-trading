/** @type {import("next").NextConfig} */
const nextConfig = {
  skipTrailingSlashRedirect: true,
  trailingSlash: false,
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      // Match with explicit trailing slash variants so Next preserves the slash
      {
        source: "/api/:path*/",
        destination: `${apiUrl}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${apiUrl}/ws/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
