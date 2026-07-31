import { cidadeDoEndereco } from "@/lib/leads/cidade";
import { resumirHorarios } from "@/lib/leads/horarios";
import { handleInstagram } from "@/lib/leads/instagram";
import type { Lead } from "@/lib/leads/types";
import { idiomaEfetivoDemo } from "./idioma";
import { CAMPOS_IDENTIDADE_DEMO } from "./patch";
import { DEFAULTS_HISTORICOS } from "./legado";
import type { DemoData, DemoDataPatch, DemoSecao } from "./types";

/**
 * Montagem do DemoData efetivo de um lead, em três camadas (a de cima vence):
 *
 *   1. exemplo do template (demoDataExemplo da skin) — a base completa;
 *   2. dados reais do lead (nome, endereço, telefone, whatsapp) — o que o
 *      Radar já sabe do negócio preenche os slots correspondentes;
 *   3. edições feitas na ficha (LeadDemo.dados) — palavra final do usuário.
 *
 * Funções puras: a rota /demo/[leadId] e a ficha usam a mesma montagem.
 */

/** Cópia sem chaves undefined — camada de cima só sobrescreve o que definiu. */
function definidos<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

const HERO_TITULO_LIMIAR = 20;

/**
 * Quebra `nome` em no máximo duas linhas ("\n" — mesma convenção de
 * `whitespace-pre-line` usada pelas skins no título hero). Nomes curtos
 * (ou de uma palavra só) ficam numa linha; nomes longos quebram no espaço
 * mais próximo do meio, sem partir palavra.
 */
export function quebrarTitulo(nome: string): string {
  const texto = nome.trim();
  const palavras = texto.split(/\s+/);
  if (texto.length <= HERO_TITULO_LIMIAR || palavras.length <= 1) return texto;

  const metade = texto.length / 2;
  let acumulado = 0;
  let corte = palavras.length - 1;
  for (let i = 0; i < palavras.length - 1; i++) {
    acumulado += palavras[i].length + 1;
    if (acumulado >= metade) {
      corte = i + 1;
      break;
    }
  }

  const linha1 = palavras.slice(0, corte).join(" ");
  const linha2 = palavras.slice(corte).join(" ");
  return `${linha1}\n${linha2}`;
}

/** Slots de DemoData que os dados já persistidos do lead preenchem. */
export function dadosDoLead(lead: Lead): Partial<DemoData> {
  const websiteUri = lead.detalhes?.site ?? lead.siteUrl;
  const idioma = idiomaEfetivoDemo(lead);
  return definidos({
    nome: lead.nome,
    endereco: lead.endereco,
    telefone: lead.detalhes?.telefone ?? lead.telefone,
    whatsapp: lead.detalhes?.telefoneIntl ?? lead.telefoneIntl,
    horarios: lead.horarios ? resumirHorarios(lead.horarios.faixas, idioma) : undefined,
    cidade: lead.endereco ? cidadeDoEndereco(lead.endereco).cidade : undefined,
    instagram: handleInstagram(websiteUri),
    secoes: { hero: { titulo: quebrarTitulo(lead.nome) } },
  });
}

function mergeSecoes(
  base: Record<string, DemoSecao>,
  patch: Record<string, DemoSecao> | undefined,
): Record<string, DemoSecao> {
  if (!patch) return base;
  const merged: Record<string, DemoSecao> = { ...base };
  for (const [chave, secao] of Object.entries(patch)) {
    // Mescla por campo dentro da seção; `itens` substitui a lista inteira
    // (mesclar item a item criaria listas meio-velhas, meio-novas).
    merged[chave] = { ...base[chave], ...definidos(secao) };
  }
  return merged;
}

/** Aplica um patch parcial sobre uma base completa de DemoData. */
export function aplicarPatch(base: DemoData, patch: DemoDataPatch | undefined): DemoData {
  if (!patch) return base;
  const { secoes, imagens, videos, servicos, depoimentos, ...campos } = patch;
  const temVideos = { ...base.videos, ...(definidos(videos ?? {}) as Record<string, string>) };
  return {
    ...base,
    ...definidos(campos),
    servicos: servicos ?? base.servicos,
    depoimentos: depoimentos ?? base.depoimentos,
    secoes: mergeSecoes(base.secoes, secoes),
    // definidos() remove as chaves undefined; o cast devolve o índice string.
    imagens: { ...base.imagens, ...(definidos(imagens ?? {}) as Record<string, string>) },
    ...(Object.keys(temVideos).length > 0 && { videos: temVideos }),
  };
}

/**
 * Remove do patch SALVO qualquer campo de identidade cujo valor seja
 * idêntico ao default histórico daquela skin (ver ./legado.ts) — demos
 * salvas antes desses campos virarem "ausente fica ausente" podem ter o
 * texto de exemplo antigo persistido como se fosse edição real; na
 * leitura, esse valor é tratado como se nunca tivesse sido setado (a demo
 * cai pro dado do lead/nome, não pro texto de exemplo congelado). Nunca
 * usado na escrita — só filtra o que já está salvo.
 */
function semDefaultsHistoricos(
  patch: DemoDataPatch | undefined,
  skinId: string | undefined,
): DemoDataPatch | undefined {
  if (!patch || !skinId) return patch;
  const legado = DEFAULTS_HISTORICOS[skinId];
  if (!legado) return patch;

  const limpo: DemoDataPatch = { ...patch };
  for (const campo of CAMPOS_IDENTIDADE_DEMO) {
    const chave = campo as keyof DemoDataPatch;
    if (limpo[chave] !== undefined && limpo[chave] === legado[chave as keyof typeof legado]) {
      delete limpo[chave];
    }
  }

  if (limpo.secoes?.hero?.titulo !== undefined && limpo.secoes.hero.titulo === legado.heroTitulo) {
    const restoHero = { ...limpo.secoes.hero };
    delete restoHero.titulo;
    limpo.secoes = { ...limpo.secoes, hero: restoHero };
  }

  return limpo;
}

/**
 * DemoData efetivo do lead: exemplo do template ← dados do lead ← edições.
 * `lead` opcional (a ficha monta a prévia dos campos antes de salvar).
 * `skinId` opcional: só é usado pra filtrar defaults históricos do patch
 * salvo (ver semDefaultsHistoricos) — ausente = sem filtragem (fixtures de
 * teste com DemoData avulso, sem skin real, continuam funcionando).
 */
export function montarDemoData(
  exemplo: DemoData,
  lead?: Lead,
  patch?: DemoDataPatch,
  skinId?: string,
): DemoData {
  const comLead = lead ? aplicarPatch(exemplo, dadosDoLead(lead)) : exemplo;
  return aplicarPatch(comLead, semDefaultsHistoricos(patch, skinId));
}
