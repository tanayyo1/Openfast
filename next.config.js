/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["localhost"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.reddit.com",
      },
      {
        protocol: "https",
        hostname: "**.redditmedia.com",
      },
    ],
  },
  // CORS is handled in middleware.ts for dynamic origin validation
  // Static headers in next.config.js cannot handle credentialed requests properly
};

module.exports = nextConfig;
