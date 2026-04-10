/** @type {import('next').NextConfig} */
const nextConfig = {
  // ১. টাইপস্ক্রিপ্ট এরর ইগনোর (বিল্ডের জন্য)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ২. আউটপুট মোড - cPanel-এর জন্য standalone (সবচেয়ে গুরুত্বপূর্ণ)
  output: 'standalone',

  // ৩. Turbopack কনফিগারেশন (webpack-এর জায়গায়)
  turbopack: {
    // Turbopack-এর জন্য প্রযোজ্য কোনো কাস্টম কনফিগারেশন এখানে দিতে পারেন।
    // আপাতত খালি রাখলেই চলে।
  },

  // ৪. উন্নয়ন (development) সময় অনুমোদিত উৎস (origins)
  allowedDevOrigins: [
    '6000-firebase-studio-1751357598651.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev',
    '9000-firebase-studio-1751357598651.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev',
    'localhost:3000'
  ],

  // ৫. ইমেজ হোস্ট কনফিগারেশন
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' }
    ],
  },

  // ৬. এক্সপেরিমেন্টাল ফিচার (সার্ভার অ্যাকশন ও অন্যান্য)
  experimental: {
    serverActions: {
      allowedOrigins: [
        '6000-firebase-studio-1751357598651.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev',
        '9000-firebase-studio-1751357598651.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev',
        'localhost:3000'
      ],
      bodySizeLimit: '10mb',
    },
  },

  // ৭. CORS হেডার
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-Requested-With, Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ];
  },

  // ৮. অন্যান্য কনফিগারেশন
  compress: true,        // কম্প্রেশন সক্রিয়
  poweredByHeader: false, // 'X-Powered-By' হেডার বন্ধ
};

module.exports = nextConfig;