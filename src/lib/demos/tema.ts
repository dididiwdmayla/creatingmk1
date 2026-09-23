import { barraCorValida } from "./barra/modos";
import { fundoEfeitoAceito, idEfeitoAtual } from "./efeitos/registry";
import { getFonte } from "./fontes";
import { getLedEstilo } from "./led/registry";
import { modoValido } from "./cores/modos";
import {
  ALINHAMENTOS,
  CLIQUE_ESTILOS,
  HOVER_ESTILOS,
  LED_PRESETS,
  type CoresModoValor,
  type TemaPatch,
  type Theme,
} from "./types";

/**
 * "nenhum" (desligado), um id do registro, ou o id de um efeito REMOVIDO —
 * este resolve pro destino da migração (ver `fundoEfeitoAceito` e
 * EFEITOS_MIGRADOS em ./efeitos/registry.ts).
 */
const fundoEfeitoValido = fundoEfeitoAceito;

/**
 * Modo de cor da camada decorativa (efeito/LED) — só passa adiante o que
 * tem modo conhecido; qualquer coisa fora do contrato vira `undefined`
 * (= "tema"), a mesma tolerância dos outros campos do patch.
 */
function coresModoValido(valor: CoresModoValor | undefined): CoresModoValor | undefined {
  if (!valor || !modoValido(valor.modo)) return undefined;
  return valor.modo === "tema" ? undefined : valor;
}

/**
 * Migração de um `TemaPatch` já salvo para os ids atuais do registro (hoje
 * só `fundoEfeito`, ver EFEITOS_MIGRADOS em ./efeitos/registry.ts).
 *
 * O render já lida com o id antigo sozinho — mas o EDITOR precisa disto:
 * sem a troca, o seletor "Efeito de fundo" não acharia botão nenhum
 * marcado (o id não está mais na lista) e o próximo Salvar reescreveria o
 * id morto no banco. Migrando na leitura, o primeiro save da demo já
 * grava o id novo.
 */
export function migrarTemaPatch(patch: TemaPatch): TemaPatch {
  if (!patch.fundoEfeito) return patch;
  const atual = idEfeitoAtual(patch.fundoEfeito);
  return atual === patch.fundoEfeito ? patch : { ...patch, fundoEfeito: atual };
}

/** Limites de escala do título hero quando a skin não declara os dela. */
const ESCALA_LIMITES_PADRAO = { min: 0.75, max: 1.7 };

/**
 * Entre-letras do título hero, em `em` somados ao que a skin já usa.
 * Negativo aperta (título display grande aguenta), positivo abre. O teto
 * é conservador de propósito: acima de 0.3em o título vira uma linha de
 * letras soltas e a máscara do vídeo passa a recortar mais fundo que
 * letra.
 */
export const ESPACAMENTO_HERO_LIMITES = { min: -0.05, max: 0.3 };

/**
 * Aplicação do TemaPatch (LeadDemo.tema) por cima do preset escolhido.
 * Funções puras: a rota pública /demo/[leadId] e o editor usam a mesma
 * montagem — o preview do editor é sempre fiel ao que será publicado.
 */

/** Raios de borda oferecidos pelo editor (do editorial reto ao bem suave). */
export const TEMA_RAIOS: readonly string[] = ["0px", "4px", "8px", "12px", "16px", "24px"];

/** #rgb ou #rrggbb (o editor grava sempre #rrggbb; leitura é tolerante). */
// HEX_RE, luminância, contraste e `inkPara` moram em ./contraste.ts (módulo
// puro, sem o registro de efeitos que este arquivo importa — as skins os
// usam em componentes de cliente). Reexportados aqui pelos chamadores antigos.
import { HEX_RE, inkPara } from "./contraste";

export { contrasteWcag, HEX_RE, inkPara, luminancia } from "./contraste";

/**
 * Tema efetivo do lead: preset ← ajustes do TemaPatch. Sem patch, o
 * próprio preset. `limitesHero` vem de SkinDefinition.heroEscalaLimites
 * (ausente = limites padrão) — usado só pra recortar `heroTitulo.escala`.
 */
export function aplicarTema(
  preset: Theme,
  patch: TemaPatch | undefined,
  limitesHero: { min: number; max: number } = ESCALA_LIMITES_PADRAO,
): Theme {
  if (!patch) return preset;
  if (preset.lancheria) {
    const quente = patch.quente && HEX_RE.test(patch.quente) ? patch.quente : preset.paleta.quente!;
    const frio = patch.frio && HEX_RE.test(patch.frio) ? patch.frio : preset.paleta.frio!;
    return { ...preset, paleta: { ...preset.paleta, quente, frio, destaque: quente,
      destaqueInk: inkPara(quente), acentoSecundario: frio, textoSuave: frio },
      // A identidade estrutural e as fontes pertencem à skin. Overrides genéricos
      // antigos não viram alterações silenciosas de mecânica ou da tipografia.
      intro: preset.lancheria.intro && (patch.intro ?? true),
      // A CAMADA DECORATIVA, porém, é da Forja e não da skin: efeito de
      // fundo, LED e cor da barra são siblings, não tocam na tipografia
      // nem na mecânica do pacote, e valem sobre qualquer variante.
      // Mesmíssima resolução do ramo genérico abaixo.
      fundoEfeito:
        patch.fundoEfeito && fundoEfeitoValido(patch.fundoEfeito)
          ? patch.fundoEfeito
          : preset.fundoEfeito,
      led: patch.led && LED_PRESETS.includes(patch.led) ? patch.led : preset.led,
      ledEstilo:
        patch.ledEstilo && getLedEstilo(patch.ledEstilo) ? patch.ledEstilo : preset.ledEstilo,
      ...(coresModoValido(patch.efeitoCores) && { efeitoCores: coresModoValido(patch.efeitoCores) }),
      ...(coresModoValido(patch.ledCores) && { ledCores: coresModoValido(patch.ledCores) }),
      ...(barraCorValida(patch.barraCor) && { barraCor: barraCorValida(patch.barraCor) }),
    };
  }

  const fonteDisplay = getFonte(patch.fonteDisplay);
  const fonteCorpo = getFonte(patch.fonteCorpo);
  const fonteHero = getFonte(patch.heroTitulo?.fonte);
  const destaqueValido = patch.destaque && HEX_RE.test(patch.destaque);
  const escalaPedida = patch.heroTitulo?.escala;
  const escala =
    typeof escalaPedida === "number" && !Number.isNaN(escalaPedida)
      ? Math.min(limitesHero.max, Math.max(limitesHero.min, escalaPedida))
      : preset.heroTitulo.escala;
  const espacamentoPedido = patch.heroTitulo?.espacamento;
  const espacamento =
    typeof espacamentoPedido === "number" && !Number.isNaN(espacamentoPedido)
      ? Math.min(
          ESPACAMENTO_HERO_LIMITES.max,
          Math.max(ESPACAMENTO_HERO_LIMITES.min, espacamentoPedido),
        )
      : preset.heroTitulo.espacamento;

  return {
    ...preset,
    paleta: destaqueValido
      ? {
          ...preset.paleta,
          destaque: patch.destaque as string,
          destaqueInk: inkPara(patch.destaque as string),
        }
      : preset.paleta,
    fontes: {
      ...preset.fontes,
      ...(fonteDisplay && { display: fonteDisplay.css }),
      ...(fonteCorpo && { corpo: fonteCorpo.css }),
    },
    raio: patch.raio && TEMA_RAIOS.includes(patch.raio) ? patch.raio : preset.raio,
    densidade: patch.densidade ?? preset.densidade,
    animacao: patch.animacao ?? preset.animacao,
    intro: patch.intro ?? preset.intro,
    hover: patch.hover && HOVER_ESTILOS.includes(patch.hover) ? patch.hover : preset.hover,
    clique:
      patch.clique && CLIQUE_ESTILOS.includes(patch.clique) ? patch.clique : preset.clique,
    // O id SALVO é preservado aqui (é o que está no banco) — quem traduz um
    // efeito removido é a resolução, `resolverEfeitoFundo`. Aceitá-lo é o
    // que impede a demo de cair no efeito do PRESET, que ninguém escolheu.
    fundoEfeito:
      patch.fundoEfeito && fundoEfeitoValido(patch.fundoEfeito)
        ? patch.fundoEfeito
        : preset.fundoEfeito,
    heroTitulo: {
      fonte: fonteHero ? fonteHero.css : preset.heroTitulo.fonte,
      escala,
      espacamento,
      alinhamento:
        patch.heroTitulo?.alinhamento && ALINHAMENTOS.includes(patch.heroTitulo.alinhamento)
          ? patch.heroTitulo.alinhamento
          : preset.heroTitulo.alinhamento,
    },
    led: patch.led && LED_PRESETS.includes(patch.led) ? patch.led : preset.led,
    ledEstilo:
      patch.ledEstilo && getLedEstilo(patch.ledEstilo) ? patch.ledEstilo : preset.ledEstilo,
    // Modos de cor da camada decorativa: só existem como escolha do
    // editor (nenhum preset declara), então o patch é a única fonte.
    ...(coresModoValido(patch.efeitoCores) && { efeitoCores: coresModoValido(patch.efeitoCores) }),
    ...(coresModoValido(patch.ledCores) && { ledCores: coresModoValido(patch.ledCores) }),
    // Cor da barra do navegador: mesma forma dos modos de cor acima —
    // nenhum preset declara, então o patch é a única fonte, e o modo
    // default (`automatico`) é representado pela AUSÊNCIA do campo.
    ...(barraCorValida(patch.barraCor) && { barraCor: barraCorValida(patch.barraCor) }),
  };
}
