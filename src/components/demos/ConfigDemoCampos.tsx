"use client";

import { EFEITOS } from "@/lib/demos/efeitos/registry";
import { skinsDoNicho } from "@/lib/demos/nicho";
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

/**
 * Config inicial: a primeira skin do registro que casa com `nicho` (ver
 * skinsDoNicho), na ordem do registro — nunca simplesmente `SKINS[0]`, que
 * abriria o diálogo de um grupo de petshop já com a barbearia selecionada.
 * Sem `nicho` (ex.: demo avulsa, que não vem de um grupo de busca) ou sem
 * skin nenhuma casando, cai no comportamento de sempre (`SKINS[0]`) — o
 * operador troca manualmente, e `ConfigDemoCampos` avisa quando é o caso
 * de "nenhuma skin atende este nicho" (ver `nicho`/`semSkinDoNicho` abaixo).
 */
export function configDemoInicial(nicho?: string): ConfigDemo {
  const casam = nicho ? skinsDoNicho(nicho) : [];
  const skin = casam[0] ?? SKINS[0];
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
  const skin=getSkin(skinId);
  return { ...config, skinId, themeId: skin?.themeDefault.id ?? "", ...(skin?.themeDefault.lancheria && {efeitoId:"nenhum",imagensModo:"foto"}) };
}

export function ConfigDemoCampos({
  config,
  onChange,
  desabilitado = false,
  nicho,
}: {
  config: ConfigDemo;
  onChange: (config: ConfigDemo) => void;
  desabilitado?: boolean;
  /**
   * Nicho do grupo de busca (ver GerarDemosLoteDialog) — só para avisar o
   * operador quando nenhuma skin do registro atende este nicho ainda
   * (skinsDoNicho vazio). Ausente = sem aviso (ex.: demo avulsa, que não
   * vem de um grupo).
   */
  nicho?: string;
}) {
  const skin = getSkin(config.skinId);
  const semSkinDoNicho = Boolean(nicho) && skinsDoNicho(nicho as string).length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      {semSkinDoNicho && (
        <p className="w-full text-xs text-critical">
          Nenhuma skin do registro atende o nicho &quot;{nicho}&quot; ainda — escolha uma abaixo
          manualmente.
        </p>
      )}
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
      {!skin?.themeDefault.lancheria && <><select
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
      </select></>}
    </div>
  );
}
