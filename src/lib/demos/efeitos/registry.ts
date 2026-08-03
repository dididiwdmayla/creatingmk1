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
    id: "filotaxia",
    nome: "Filotaxia",
    // Padrão de crescimento orgânico (sementes de girassol) — combina com
    // o lado "natureza" de petshop e o artesanal/orgânico da lancheria.
    nichosRecomendados: ["petshop", "lancheria"],
    // Portão de qualidade (ver a tabela em ARCHITECTURE.md): 40,8 fps em
    // `transicao` e 40,5 em `arco-iris`, contra o piso de 45 — e contra
    // 59,8 do próprio efeito em `tema`. A causa não é a superfície
    // repintada (8,4 Mpx/s, na referência da página): é recálculo de
    // estilo na thread principal, 93 spans com `radial-gradient` cuja cor
    // muda a 60 Hz, um a um. `iridescente` passou por 47,9 — perto do
    // piso, com 2 das 5 cargas abaixo dele —, então fica, mas é o próximo
    // a cair se a próxima rodada medir pior.
    modosDeCorReprovados: ["transicao", "arco-iris"],
    motivoModosReprovados:
      "abaixo de 45 fps no celular (40,8 e 40,5): a cor animada repinta os 93 pontos um a um",
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
 * Efeito REMOVIDO → o que assume as demos já salvas com ele. O destino pode
 * ser outro efeito (substituição) ou `"nenhum"` (removido SEM substituto:
 * a demo passa a não ter camada decorativa, de propósito).
 *
 * Uma demo publicada guarda o id escolhido em `LeadDemo.tema.fundoEfeito`
 * (Firestore) — apagar um efeito do registro sem mais nada deixaria o id
 * morto no banco, reprovado pela validação do PUT ("chave desconhecida") e
 * ressuscitando o efeito do PRESET no lugar dele. Este mapa é a migração, e
 * ela vive no REGISTRO, não no banco: o id antigo continua VÁLIDO em todo
 * lugar que consulta o registro (`aplicarTema`, a validação do PUT, o
 * seletor do editor) e resolve para o destino, sem job nenhum.
 *
 * - `geometrico-pulsante` → `ondas`: formava figuras legíveis (hexágonos
 *   concêntricos de linha contínua) e animava um `<svg>` do tamanho da
 *   viewport, o que travava o celular (ver "Regra de superfície" em
 *   ARCHITECTURE.md). Tinha substituto pronto com a mesma leitura.
 * - `veios` → `nenhum`: era o ÚNICO violador restante da regra de
 *   superfície (1 `<svg>` de viewport inteira, 93 nós, 8 animados, mais
 *   `stop-color` de 6 gradientes repintados a cada quadro nos modos de cor
 *   animados). Saiu sem substituto — nenhum efeito do registro tem a mesma
 *   leitura de traço, e inventar um não estava no pedido.
 */
export const EFEITOS_MIGRADOS: Readonly<Record<string, string>> = {
  "geometrico-pulsante": "ondas",
  veios: "nenhum",
};

/**
 * Id efetivo de um efeito: o próprio, o substituto se ele foi removido, ou
 * `"nenhum"` se foi removido sem substituto.
 */
export function idEfeitoAtual(id: string): string {
  return EFEITOS_MIGRADOS[id] ?? id;
}

/**
 * O id é aceitável em `Theme.fundoEfeito`/`TemaPatch.fundoEfeito`? Vale
 * `"nenhum"`, um id do registro e também o id de um efeito REMOVIDO — este
 * último resolve pra `idEfeitoAtual` e nunca pode ser recusado, senão o PUT
 * de uma demo antiga responderia 400 e o editor perderia a escolha dela.
 */
export function fundoEfeitoAceito(id: string): boolean {
  const atual = idEfeitoAtual(id);
  return atual === "nenhum" || getEfeito(atual) !== undefined;
}

export function getEfeito(id: string | undefined): EfeitoDefinition | undefined {
  if (id === undefined) return undefined;
  const atual = idEfeitoAtual(id);
  return EFEITOS.find((efeito) => efeito.id === atual);
}

/**
 * O modo de cor pedido vale neste efeito? `false` quando o par
 * efeito × modo reprovou no portão de qualidade (ver
 * `EfeitoDefinition.modosDeCorReprovados` e a tabela em ARCHITECTURE.md).
 *
 * Quem chama cai em `tema` — e NUNCA rejeita o dado: uma demo publicada
 * com esse par continua válida no PUT e continua abrindo no editor, ela só
 * deixa de animar a cor. Mesma filosofia de `EFEITOS_MIGRADOS`: a regra
 * mora no registro e é aplicada na RESOLUÇÃO, sem tocar no banco.
 */
export function modoDeCorPermitido(efeitoId: string | undefined, modo: string): boolean {
  const reprovados = getEfeito(efeitoId)?.modosDeCorReprovados;
  if (!reprovados) return true;
  return !(reprovados as readonly string[]).includes(modo);
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
