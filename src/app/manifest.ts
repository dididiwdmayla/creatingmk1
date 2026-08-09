import type { MetadataRoute } from "next";

import { TEMAS_META, TEMA_PADRAO } from "@/lib/tema";

/**
 * Manifest da PWA: nome/ícones pra instalação no celular. `theme_color` e
 * `background_color` usam o tema padrão (`escuro`) — o manifest é estático
 * (sem acesso ao cookie por usuário), diferente da `<meta name="theme-color">`
 * do RootLayout, que já segue o tema de quem está logado.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar",
    short_name: "Radar",
    description: "Prospecção de leads locais",
    start_url: "/",
    display: "standalone",
    background_color: "#060a10",
    theme_color: TEMAS_META[TEMA_PADRAO].barra,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
