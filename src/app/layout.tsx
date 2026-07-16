import type { Metadata } from "next";
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
 * Aplica o tema salvo ANTES da primeira pintura (evita flash). Roda inline
 * como primeiro elemento do body; o default é o tema escuro (sem atributo).
 * Mesma chave usada pelo ThemeToggle. Também desliga a restauração de
 * scroll NATIVA do browser (history.scrollRestoration) o mais cedo
 * possível — sem isso ela briga com a restauração manual da lista de
 * leads (sessionStorage + useLayoutEffect) ao voltar da ficha.
 */
const THEME_INIT = `try{if(localStorage.getItem("radar:tema")==="claro")document.documentElement.dataset.theme="light"}catch(e){}try{if("scrollRestoration" in history)history.scrollRestoration="manual"}catch(e){}`;

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
