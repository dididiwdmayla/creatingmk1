import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
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
 * Aplica o tema salvo ANTES da primeira pintura (evita flash). Roda inline
 * como primeiro elemento do body; o default é o tema escuro (sem atributo).
 * Mesma chave usada pelo ThemeToggle.
 */
const THEME_INIT = `try{if(localStorage.getItem("radar:tema")==="claro")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
