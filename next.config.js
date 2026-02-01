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
  async headers() {
    // Build allowed origins list
    const allowedOrigins = [
      process.env.APP_URL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // Allow Vercel preview deployments
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean);

    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value: allowedOrigins.join(", ") || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
