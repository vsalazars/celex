/** @type {import('next').NextConfig} */
const nextConfig = {
  // No bloquees el build por lint ni TS en prod
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Si usas next/image sin loader externo en Render
  images: { unoptimized: true },
};

export default nextConfig;
