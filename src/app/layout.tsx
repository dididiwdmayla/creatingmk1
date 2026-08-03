import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

import { TEMA_COOKIE, temaOuPadrao } from "@/lib/tema";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono-data",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar",
  description: "Prospecção de leads locais",
};

/**
 * `interactiveWidget: "resizes-content"` é o que faz o teclado virtual
 * ENCOLHER a viewport dinâmica (dvh) em vez de só sobrepor o conteúdo —
 * sem isto, telas cheias baseadas em dvh (ex.: o chat em /mensagens, o
 * editor de demo) ficam com o input escondido atrás do teclado em
 * iOS/Android. `viewportFit: "cover"` é o que dá efeito real ao
 * env(safe-area-inset-*) já usado em vários componentes (Nav, editor).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

/**
 * O tema da plataforma é POR USUÁRIO (`/usuarios/{id}.tema` — ver
 * lib/tema.ts). O `data-theme` sai pronto no HTML do SERVIDOR, lido do
 * cookie-espelho `radar_tema` que as rotas de login e /api/tema escrevem
 * a partir do doc: sem script inline, sem localStorage e sem flash de
 * tema errado antes da primeira pintura.
 *
 * Cookie ausente (deslogado, primeiro acesso, logout) cai no TEMA_PADRAO,
 * que é exatamente o bloco base de `:root` no globals.css.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tema = temaOuPadrao((await cookies()).get(TEMA_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      data-theme={tema}
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
