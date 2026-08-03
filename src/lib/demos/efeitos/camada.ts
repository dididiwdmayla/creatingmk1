import { resolverModoCores, type ModoCoresResolvido } from "../cores/modos";
import type { AuraCoresValor, CoresModoValor, ThemePaleta } from "../types";
import { paletaParaAura } from "./aura/cores";

/**
 * Resolução da CAMADA de efeito (cores que o efeito vai receber + o CSS
 * que as anima), num único lugar puro — a rota pública `/demo/[leadId]`, o
 * preview do editor e o harness `/interno/demo-qa` chamam esta função e
 * mais nada, então os três nunca divergem (a regra que já valia pro
 * `resolverEfeitoFundo`).
 *
 * Ordem de precedência das cores:
 *
 *   1. `efeitoCores` com modo != "tema" — o controle GENÉRICO, vale pra
 *      qualquer efeito do registro (ver ../cores/modos.ts);
 *   2. `auraCores` — o controle específico da aura, anterior a este; só
 *      entra no modo "tema", pra não mudar nenhuma demo já publicada que
 *      tenha escolhido cores de aura;
 *   3. a paleta do tema, como sempre.
 *
 * O `prefixo` das custom properties é fixo ("efeito"), separado do do LED
 * ("led"): os dois podem estar em modos diferentes na mesma página.
 */
export const PREFIXO_CORES_EFEITO = "efeito";

export interface CamadaEfeitoResolvida {
  /** Paleta a passar como `EfeitoProps.cores` (pode conter `var(...)`). */
  cores: ThemePaleta;
  /** `@property` + `@keyframes` do modo animado; "" quando não há. */
  coresCss: string;
  /** Animação a aplicar no elemento que carrega as custom properties. */
  coresAnimacao?: ModoCoresResolvido["animacao"];
}

export function resolverCamadaEfeito({
  paleta,
  efeitoId,
  efeitoCores,
  auraCores,
}: {
  paleta: ThemePaleta;
  /** Id do efeito ativo (undefined = nenhum) — só a aura lê `auraCores`. */
  efeitoId: string | undefined;
  efeitoCores: CoresModoValor | undefined;
  auraCores: AuraCoresValor | undefined;
}): CamadaEfeitoResolvida {
  const modo = resolverModoCores(
    efeitoCores,
    [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario],
    PREFIXO_CORES_EFEITO,
  );

  // Modo "tema" (inclusive quando o pedido caiu de volta nele por dado
  // insuficiente): a aura mantém o controle próprio dela.
  if (modo.efetivo === "tema") {
    return {
      cores: efeitoId === "aura" ? paletaParaAura(paleta, auraCores) : paleta,
      coresCss: "",
    };
  }

  return {
    cores: {
      ...paleta,
      destaque: modo.cores[0],
      acentoSecundario: modo.cores[1],
      acentoTerciario: modo.cores[2],
    },
    coresCss: modo.css,
    coresAnimacao: modo.animacao,
  };
}
