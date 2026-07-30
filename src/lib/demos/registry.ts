import { BARBEARIA_EXEMPLO } from "@/components/demos/barbearia/exemplo";
import { BARBEARIA_SECOES } from "@/components/demos/barbearia/secoes";
import { BarbeariaEditorial } from "@/components/demos/barbearia/Skin";
import {
  BARBEARIA_THEME_DEFAULT,
  BARBEARIA_THEME_PRESETS,
} from "@/components/demos/barbearia/themes";
import { BARBEARIA2_EXEMPLO } from "@/components/demos/barbearia2/exemplo";
import { BARBEARIA2_SECOES } from "@/components/demos/barbearia2/secoes";
import { BarbeariaSul } from "@/components/demos/barbearia2/Skin";
import {
  BARBEARIA2_THEME_DEFAULT,
  BARBEARIA2_THEME_PRESETS,
} from "@/components/demos/barbearia2/themes";
import { IMOBILIARIA_EXEMPLO } from "@/components/demos/imobiliaria/exemplo";
import { IMOBILIARIA_SECOES } from "@/components/demos/imobiliaria/secoes";
import { ImobiliariaCurada } from "@/components/demos/imobiliaria/Skin";
import {
  IMOBILIARIA_THEME_DEFAULT,
  IMOBILIARIA_THEME_PRESETS,
} from "@/components/demos/imobiliaria/themes";
import { LANCHERIA_DECORATIVE_FLOATS } from "@/components/demos/lancheria/decorativeFloats";
import { LANCHERIA_EXEMPLO } from "@/components/demos/lancheria/exemplo";
import { LANCHERIA_SECOES } from "@/components/demos/lancheria/secoes";
import { LancheriaChapaBurger } from "@/components/demos/lancheria/Skin";
import {
  LANCHERIA_THEME_DEFAULT,
  LANCHERIA_THEME_PRESETS,
} from "@/components/demos/lancheria/themes";
import { MULTIMARCAS_EXEMPLO } from "@/components/demos/multimarcas/exemplo";
import { MULTIMARCAS_SECOES } from "@/components/demos/multimarcas/secoes";
import { MultimarcasVortice } from "@/components/demos/multimarcas/Skin";
import {
  MULTIMARCAS_THEME_DEFAULT,
  MULTIMARCAS_THEME_PRESETS,
} from "@/components/demos/multimarcas/themes";
import { PETSHOP_EXEMPLO } from "@/components/demos/petshop/exemplo";
import { PETSHOP_SECOES } from "@/components/demos/petshop/secoes";
import { PetshopFocinhoFeliz } from "@/components/demos/petshop/Skin";
import {
  PETSHOP_THEME_DEFAULT,
  PETSHOP_THEME_PRESETS,
} from "@/components/demos/petshop/themes";
import { TATUAGEM_EXEMPLO } from "@/components/demos/tatuagem/exemplo";
import { TATUAGEM_SECOES } from "@/components/demos/tatuagem/secoes";
import { TatuagemEditorial } from "@/components/demos/tatuagem/Skin";
import {
  TATUAGEM_THEME_DEFAULT,
  TATUAGEM_THEME_PRESETS,
} from "@/components/demos/tatuagem/themes";
import { TATUAGEM2_EXEMPLO } from "@/components/demos/tatuagem2/exemplo";
import { TATUAGEM2_SECOES } from "@/components/demos/tatuagem2/secoes";
import { TatuagemPigmentoVivo } from "@/components/demos/tatuagem2/Skin";
import {
  TATUAGEM2_THEME_DEFAULT,
  TATUAGEM2_THEME_PRESETS,
} from "@/components/demos/tatuagem2/themes";
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
    id: "barbearia2-sul",
    nicho: "barbearia",
    nome: "Barbearia Sul",
    descricao:
      "Editorial minimalista verde-musgo e latão: etiquetas mono, título hero centralizado com corte de navalha, serviços que expandem no hover, ritual em três atos e galeria arrastável em preto-e-branco.",
    componente: BarbeariaSul,
    themeDefault: BARBEARIA2_THEME_DEFAULT,
    themePresets: BARBEARIA2_THEME_PRESETS,
    demoDataExemplo: BARBEARIA2_EXEMPLO,
    secoes: BARBEARIA2_SECOES,
    heroEscalaLimites: { min: 0.75, max: 1.25 },
    thumbnail: "/demos/barbearia2/thumb.svg",
    // Sem videoSlots: vídeo-no-título é opt-in por skin, e o material bruto
    // desta não tem esse recurso (wordmark é texto simples, sem máscara).
    // Serifas editoriais/vintage — mesmo registro da barbearia (nicho irmão).
    fontesRecomendadas: ["playfair", "cormorant", "libre-baskerville", "lora", "cinzel"],
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
    id: "tatuagem-pigmento-vivo",
    nicho: "tatuagem",
    nome: "Tatuagem Pigmento Vivo",
    descricao:
      "Fundo claro e blobs coloridos: manifesto que acende palavra a palavra no scroll, portfólio em trilha horizontal e cartões com blob no hover.",
    componente: TatuagemPigmentoVivo,
    themeDefault: TATUAGEM2_THEME_DEFAULT,
    themePresets: TATUAGEM2_THEME_PRESETS,
    demoDataExemplo: TATUAGEM2_EXEMPLO,
    secoes: TATUAGEM2_SECOES,
    heroEscalaLimites: { min: 0.75, max: 1.25 },
    thumbnail: "/demos/tatuagem2/thumb.svg",
    // Sem videoSlots: o material bruto não tem vídeo-no-título (o hero
    // nem usa foto — só blobs de cor e um traço SVG).
    // Serif dramática + sans editorial — o par tipográfico do material bruto.
    fontesRecomendadas: ["dm-serif", "archivo", "playfair", "cormorant", "josefin"],
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
  {
    id: "imobiliaria-curada",
    nicho: "imobiliaria",
    nome: "Imobiliária Curada",
    descricao:
      "Imobiliária boutique editorial: serif calorosa + sans neutra, nav que troca de tema claro/escuro no scroll, manifesto revelado palavra a palavra, bento de imóveis com selo e vitrine de bairros arrastável.",
    componente: ImobiliariaCurada,
    themeDefault: IMOBILIARIA_THEME_DEFAULT,
    themePresets: IMOBILIARIA_THEME_PRESETS,
    demoDataExemplo: IMOBILIARIA_EXEMPLO,
    secoes: IMOBILIARIA_SECOES,
    heroEscalaLimites: { min: 0.75, max: 1.3 },
    thumbnail: "/demos/imobiliaria/thumb.svg",
    // Sem videoSlots: o material bruto não tem vídeo-no-título.
    // Serifs editoriais calorosas + sans neutra — o par tipográfico do material bruto.
    fontesRecomendadas: ["fraunces", "cormorant", "playfair", "dm-serif", "hanken-grotesk", "lora"],
  },
  {
    id: "multimarcas-vortice",
    nicho: "multimarcas",
    nome: "Multimarcas Vórtice",
    descricao:
      "Concessionária de seminovos premium: estoque filtrável por categoria, simulador de financiamento com odômetro de dígitos, velocímetro no preloader e carrossel de depoimentos arrastável.",
    componente: MultimarcasVortice,
    themeDefault: MULTIMARCAS_THEME_DEFAULT,
    themePresets: MULTIMARCAS_THEME_PRESETS,
    demoDataExemplo: MULTIMARCAS_EXEMPLO,
    secoes: MULTIMARCAS_SECOES,
    heroEscalaLimites: { min: 0.75, max: 1.25 },
    thumbnail: "/demos/multimarcas/thumb.svg",
    // Sem videoSlots: o material bruto não tem vídeo-no-título.
    // Serifas dramáticas/condensadas — o tom editorial-premium da skin.
    fontesRecomendadas: ["cinzel", "abril", "playfair", "oswald", "archivo-black", "montserrat"],
  },
  {
    id: "petshop-focinho-feliz",
    nicho: "petshop",
    nome: "Petshop Focinho Feliz",
    descricao:
      "Banho, tosa e day care num pastel bem-humorado: formas orgânicas tipo blob, badge de avaliação flutuante, fita de frases em marquee e contadores animados.",
    componente: PetshopFocinhoFeliz,
    themeDefault: PETSHOP_THEME_DEFAULT,
    themePresets: PETSHOP_THEME_PRESETS,
    demoDataExemplo: PETSHOP_EXEMPLO,
    secoes: PETSHOP_SECOES,
    heroEscalaLimites: { min: 0.75, max: 1.25 },
    thumbnail: "/demos/petshop/thumb.svg",
    // Sem videoSlots: o material bruto não tem vídeo-no-título.
    // Editorial itálica + sans arredondada — o par tipográfico do material bruto.
    fontesRecomendadas: ["instrument-serif", "poppins", "cormorant", "montserrat", "josefin", "dm-sans"],
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
