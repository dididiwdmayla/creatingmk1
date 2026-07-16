import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Imagens de demo sobem para o Firebase Storage e são servidas públicas
    // (ver src/lib/firebase/storage.ts). As skins usam <Image unoptimized>,
    // mas o pattern fica declarado para o caso de alguma skin otimizar.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
