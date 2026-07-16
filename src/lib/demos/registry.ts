import { BARBEARIA_EXEMPLO } from "@/components/demos/barbearia/exemplo";
import { BARBEARIA_SECOES } from "@/components/demos/barbearia/secoes";
import { BarbeariaEditorial } from "@/components/demos/barbearia/Skin";
import {
  BARBEARIA_THEME_DEFAULT,
  BARBEARIA_THEME_PRESETS,
} from "@/components/demos/barbearia/themes";
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
