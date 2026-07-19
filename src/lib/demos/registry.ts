import { BARBEARIA_EXEMPLO } from "@/components/demos/barbearia/exemplo";
import { BARBEARIA_SECOES } from "@/components/demos/barbearia/secoes";
import { BarbeariaEditorial } from "@/components/demos/barbearia/Skin";
import {
  BARBEARIA_THEME_DEFAULT,
  BARBEARIA_THEME_PRESETS,
} from "@/components/demos/barbearia/themes";
import { LANCHERIA_DECORATIVE_FLOATS } from "@/components/demos/lancheria/decorativeFloats";
import { LANCHERIA_EXEMPLO } from "@/components/demos/lancheria/exemplo";
import { LANCHERIA_SECOES } from "@/components/demos/lancheria/secoes";
import { LancheriaChapaBurger } from "@/components/demos/lancheria/Skin";
import {
  LANCHERIA_THEME_DEFAULT,
  LANCHERIA_THEME_PRESETS,
} from "@/components/demos/lancheria/themes";
import { TATUAGEM_EXEMPLO } from "@/components/demos/tatuagem/exemplo";
import { TATUAGEM_SECOES } from "@/components/demos/tatuagem/secoes";
import { TatuagemEditorial } from "@/components/demos/tatuagem/Skin";
import {
  TATUAGEM_THEME_DEFAULT,
  TATUAGEM_THEME_PRESETS,
} from "@/components/demos/tatuagem/themes";
import type { SkinDefinition, Theme } from "./types";

/**
 * Registro de skins da Forja de Demos. Para adicionar uma skin, crie o
 * pacote em src/components/demos/<nicho>/ (Skin.tsx + themes.ts +
 * exemplo.ts) e acrescente a entrada aqui — rota pública e ficha do lead
 * passam a conhecê-la automaticamente. Ver ARCHITECTURE.md.
 */
export const SKINS: SkinDefinition[] = [
  {
    id: "barbearia-editorial",
    nicho: "barbearia",
    nome: "Barbearia Editorial",
    descricao: "Editorial escuro premium: seções numeradas, serviços com preço, equipe e ritual.",
    componente: BarbeariaEditorial,
    themeDefault: BARBEARIA_THEME_DEFAULT,
    themePresets: BARBEARIA_THEME_PRESETS,
    demoDataExemplo: BARBEARIA_EXEMPLO,
    secoes: BARBEARIA_SECOES,
    heroEscalaLimites: { min: 0.8, max: 1.2 },
    thumbnail: "/demos/barbearia/thumb.svg",
    // Sem videoSlots: vídeo-no-título é opt-in por skin, e a barbearia não
    // porta o efeito (o material bruto dela não tinha esse recurso).
    // Serifas clássicas/vintage — o registro editorial da barbearia.
    fontesRecomendadas: ["playfair", "cormorant", "libre-baskerville", "merriweather", "lora", "cinzel"],
  },
  {
    id: "tatuagem-editorial",
    nicho: "tatuagem",
    nome: "Tatuagem Editorial Sombria",
    descricao: "Preto profundo e sangue: blackletter gótica, manifesto editorial e portfólio em masonry.",
    componente: TatuagemEditorial,
    themeDefault: TATUAGEM_THEME_DEFAULT,
    themePresets: TATUAGEM_THEME_PRESETS,
    demoDataExemplo: TATUAGEM_EXEMPLO,
    secoes: TATUAGEM_SECOES,
    heroEscalaLimites: { min: 0.7, max: 1.3 },
    thumbnail: "/demos/tatuagem/thumb.svg",
    // Fiel ao material bruto: vídeo rodando dentro das letras do wordmark.
    videoSlots: ["titulo"],
    // Góticas/brutalist/condensadas — o tom sombrio-editorial da skin.
    fontesRecomendadas: ["pirata", "archivo-black", "oswald", "bebas", "cinzel", "abril"],
  },
  {
    id: "lancheria-chapa-burger",
    nicho: "lancheria",
    nome: "Lancheria Chapa Burger",
    descricao:
      "Lanchonete artesanal bem-humorada: tipografia poster com contorno, cardápio com efeito de lente no hover e listas compactas de bebidas/acompanhamentos.",
    componente: LancheriaChapaBurger,
    themeDefault: LANCHERIA_THEME_DEFAULT,
    themePresets: LANCHERIA_THEME_PRESETS,
    demoDataExemplo: LANCHERIA_EXEMPLO,
    secoes: LANCHERIA_SECOES,
    heroEscalaLimites: { min: 0.7, max: 1.25 },
    thumbnail: "/demos/lancheria/thumb.svg",
    // Sem videoSlots: o material bruto não tem vídeo-no-título.
    // Displays arredondadas/apetitosas — o tom bem-humorado de lanchonete.
    fontesRecomendadas: ["fugaz", "archivo-black", "poppins", "montserrat", "bebas", "dm-sans"],
    // Comida flutuando nas laterais (bacon/queijo/bebida), fiel ao material bruto.
    decorativeFloats: LANCHERIA_DECORATIVE_FLOATS,
  },
];

export const DEFAULT_SKIN: SkinDefinition = SKINS[0];

export function getSkin(id: string | undefined): SkinDefinition | undefined {
  return SKINS.find((skin) => skin.id === id);
}

/** Tema do preset pedido; desconhecido/ausente cai no default da skin. */
export function getTheme(skin: SkinDefinition, themeId: string | undefined): Theme {
  return skin.themePresets.find((theme) => theme.id === themeId) ?? skin.themeDefault;
}
