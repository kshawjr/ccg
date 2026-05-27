/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @react-pdf/renderer ships an ESM build with its own internal worker that
    // Next's bundler mishandles. Treating it as an external keeps the
    // runtime require path intact in API routes.
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
};

export default nextConfig;
