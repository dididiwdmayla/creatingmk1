import type { EfeitoDefinition, EfeitoIntensidade } from "./types";

/**
 * Registro de efeitos visuais da Forja de Demos. Para adicionar um efeito:
 * crie o pacote em ./<id>/ (componente "use client", ver contrato em
 * ./types.ts), registre o import dinâmico em ./dynamicComponents.ts e
 * acrescente a entrada aqui. Ver ARCHITECTURE.md.
 *
 * Só metadado (id/nome/nichos) — nunca o componente em si, pra este
 * módulo poder ser importado (ex.: o seletor "Efeito de fundo" da aba
 * Tema do editor) sem puxar o código de nenhum efeito.
 */
export const EFEITOS: EfeitoDefinition[] = [
  {
    id: "aura",
    nome: "Aura",
    nichosRecomendados: ["barbearia", "tatuagem", "imobiliaria", "multimarcas"],
  },
  {
    id: "grao",
    nome: "Grão",
    nichosRecomendados: ["barbearia", "tatuagem", "lancheria", "petshop"],
  },
  {
    id: "gradiente",
    nome: "Gradiente animado",
    // Nichos que já usavam "gradiente" como Theme.fundoEfeito antes deste
    // registro existir (ver themes.ts de cada skin) — preserva o mesmo
    // "recomendado" pros presets que já ligavam o efeito.
    nichosRecomendados: ["imobiliaria", "multimarcas"],
  },
  {
    id: "particulas",
    nome: "Partículas",
    // Ids de SkinDefinition.nicho (não de skin) — "barbearia2-sul" e
    // "tatuagem-pigmento-vivo" declaram nicho "barbearia"/"tatuagem",
    // os mesmos das skins "-editorial" (ver src/lib/demos/registry.ts).
    nichosRecomendados: ["barbearia", "lancheria", "multimarcas", "petshop", "tatuagem"],
  },
  {
    id: "veios",
    nome: "Veios",
    // Traços orgânicos com pulso viajando (ver veios/geometria.ts) — lê
    // como linha de tatuagem/circuito; imobiliária pelo traço tipo mapa.
    nichosRecomendados: ["tatuagem", "imobiliaria"],
  },
  {
    id: "filotaxia",
    nome: "Filotaxia",
    // Padrão de crescimento orgânico (sementes de girassol) — combina com
    // o lado "natureza" de petshop e o artesanal/orgânico da lancheria.
    nichosRecomendados: ["petshop", "lancheria"],
  },
  {
    id: "ondas",
    nome: "Ondas",
    // Substituiu "geometrico-pulsante" (ver EFEITOS_MIGRADOS abaixo) e
    // herdou os nichos dele: anel que se expande do centro lê como
    // sonar/eco — o mesmo lado tech/premium de multimarcas (showroom) e
    // imobiliária (empreendimentos modernos).
    nichosRecomendados: ["multimarcas", "imobiliaria"],
  },
  {
    id: "faiscas",
    nome: "Faíscas",
    // Faísca de lâmina/máquina (barbearia/tatuagem) e de oficina (multimarcas).
    nichosRecomendados: ["barbearia", "tatuagem", "multimarcas"],
  },
  {
    id: "varredura-de-luz",
    nome: "Varredura de luz",
    // Brilho dourado/cromado — nichos que já têm presets "dourado" (ver
    // themes.ts de cada um: "Ouro da meia-noite", "Noturno Dourado",
    // "Grafite (preto e dourado)").
    nichosRecomendados: ["barbearia", "imobiliaria", "multimarcas"],
  },
];

/**
 * Efeito REMOVIDO → o substituto que assume as demos já salvas com ele.
 *
 * Uma demo publicada guarda o id escolhido em `LeadDemo.tema.fundoEfeito`
 * (Firestore) — apagar um efeito do registro sem mais nada faria toda demo
 * que o usava simplesmente ficar sem fundo (`resolverEfeitoFundo` devolve
 * `undefined` para id desconhecido, de propósito). Este mapa é a migração:
 * o id antigo continua VÁLIDO em todo lugar que consulta o registro
 * (`aplicarTema`, a validação do PUT, o seletor do editor) e resolve para
 * o efeito novo, sem tocar em nada no banco.
 *
 * `geometrico-pulsante` → `ondas`: o antigo formava figuras legíveis
 * (hexágonos concêntricos de linha contínua) e animava um `<svg>` do
 * tamanho da viewport, o que travava o celular (ver "Regra de superfície"
 * em ARCHITECTURE.md).
 */
export const EFEITOS_MIGRADOS: Readonly<Record<string, string>> = {
  "geometrico-pulsante": "ondas",
};

/** Id efetivo de um efeito: o próprio, ou o substituto se ele foi removido. */
export function idEfeitoAtual(id: string): string {
  return EFEITOS_MIGRADOS[id] ?? id;
}

export function getEfeito(id: string | undefined): EfeitoDefinition | undefined {
  if (id === undefined) return undefined;
  const atual = idEfeitoAtual(id);
  return EFEITOS.find((efeito) => efeito.id === atual);
}

/**
 * Intensidade default quando a demo não tem uma escolha explícita
 * persistida (`TemaPatch.fundoEfeitoIntensidade`): mais presente (2) se o
 * nicho da skin está entre os recomendados do efeito, mais discreta (1)
 * caso contrário — ver "Adicione controle de intensidade" no editor
 * (aba Tema) e a rota pública /demo/[leadId].
 */
export function intensidadePadrao(
  efeito: EfeitoDefinition,
  nicho: string,
): Exclude<EfeitoIntensidade, 0> {
  return efeito.nichosRecomendados.includes(nicho) ? 2 : 1;
}

/** Efeito de fundo já resolvido — pronto pra passar direto ao componente dinâmico. */
export interface EfeitoFundoResolvido {
  efeito: EfeitoDefinition;
  intensidade: EfeitoIntensidade;
}

/**
 * Resolve o efeito de fundo efetivo de uma demo: `fundoEfeitoId` (já
 * validado/resolvido pelo preset ← TemaPatch em `aplicarTema`, ver
 * ./tema.ts) + a intensidade persistida (`TemaPatch.fundoEfeitoIntensidade`)
 * ou o default do nicho quando ausente. `undefined` = nada a renderizar —
 * cobre tanto "nenhum" quanto um id que não existe mais no registro (ex.:
 * um efeito removido depois de uma demo antiga tê-lo escolhido; a demo
 * simplesmente some do fundo, sem erro).
 */
export function resolverEfeitoFundo(
  fundoEfeitoId: string,
  intensidadePersistida: EfeitoIntensidade | undefined,
  nicho: string,
): EfeitoFundoResolvido | undefined {
  const efeito = getEfeito(fundoEfeitoId);
  if (!efeito) return undefined;
  const intensidade = intensidadePersistida ?? intensidadePadrao(efeito, nicho);
  return { efeito, intensidade };
}
