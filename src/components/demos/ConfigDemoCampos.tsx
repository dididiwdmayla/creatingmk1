"use client";

import { EFEITOS } from "@/lib/demos/efeitos/registry";
import { SKINS, getSkin } from "@/lib/demos/registry";
import { IMAGENS_MODOS, type ImagensModo } from "@/lib/demos/types";

/**
 * Os quatro seletores que definem uma demo nova — skin, preset de tema,
 * efeito de fundo e modo de imagem.
 *
 * Um componente só porque são exatamente os mesmos nos dois lugares que
 * criam demo sem passar pelo editor: o diálogo de geração EM LOTE (a
 * partir de um grupo de busca) e o de demo AVULSA (a partir de /demos).
 * Duas cópias divergiriam no primeiro efeito novo que entrasse no
 * registro.
 */

export const SELECT_CONFIG_CLASS =
  "rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent";

const MODO_LABEL: Record<ImagensModo, string> = {
  foto: "Foto (fotos de produção do template)",
  grafico: "Gráfico (ilustração/SVG do template)",
};

export interface ConfigDemo {
  skinId: string;
  themeId: string;
  /** Id de um efeito do registro, ou "nenhum". */
  efeitoId: string;
  imagensModo: ImagensModo;
}

/** Config inicial: a primeira skin do registro no preset default dela. */
export function configDemoInicial(): ConfigDemo {
  const skin = SKINS[0];
  return {
    skinId: skin?.id ?? "",
    themeId: skin?.themeDefault.id ?? "",
    efeitoId: "nenhum",
    imagensModo: "foto",
  };
}

/**
 * Trocar de skin reseta o preset: um `themeId` só é válido dentro da skin
 * que o declara, e o PUT recusa preset de outra skin (400).
 */
export function trocarSkin(config: ConfigDemo, skinId: string): ConfigDemo {
  return { ...config, skinId, themeId: getSkin(skinId)?.themeDefault.id ?? "" };
}

export function ConfigDemoCampos({
  config,
  onChange,
  desabilitado = false,
}: {
  config: ConfigDemo;
  onChange: (config: ConfigDemo) => void;
  desabilitado?: boolean;
}) {
  const skin = getSkin(config.skinId);
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={config.skinId}
        onChange={(event) => onChange(trocarSkin(config, event.target.value))}
        aria-label="Skin (template)"
        className={SELECT_CONFIG_CLASS}
        disabled={desabilitado}
      >
        {SKINS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <select
        value={config.themeId}
        onChange={(event) => onChange({ ...config, themeId: event.target.value })}
        aria-label="Preset de tema"
        className={SELECT_CONFIG_CLASS}
        disabled={desabilitado}
      >
        {skin?.themePresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.nome}
          </option>
        ))}
      </select>
      <select
        value={config.efeitoId}
        onChange={(event) => onChange({ ...config, efeitoId: event.target.value })}
        aria-label="Efeito de fundo"
        className={SELECT_CONFIG_CLASS}
        disabled={desabilitado}
      >
        <option value="nenhum">Sem efeito de fundo</option>
        {EFEITOS.map((efeito) => (
          <option key={efeito.id} value={efeito.id}>
            {efeito.nome}
          </option>
        ))}
      </select>
      <select
        value={config.imagensModo}
        onChange={(event) =>
          onChange({ ...config, imagensModo: event.target.value as ImagensModo })
        }
        aria-label="Modo de imagem"
        className={SELECT_CONFIG_CLASS}
        disabled={desabilitado}
      >
        {IMAGENS_MODOS.map((modo) => (
          <option key={modo} value={modo}>
            {MODO_LABEL[modo]}
          </option>
        ))}
      </select>
    </div>
  );
}
