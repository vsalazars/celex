// front-celex/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // si usas imágenes de next en Render y no tienes loader externo:
  images: { unoptimized: true },
  // si usas "next export" (Static Site), añade: output: 'export'
  // output: 'export',
};

export default nextConfig;
