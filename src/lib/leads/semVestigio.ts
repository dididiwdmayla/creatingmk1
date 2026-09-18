import { saoPauloDateKey } from "@/lib/costs/periodoUsuario";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import type { AppDb } from "@/lib/firestore-like";

import { getLead, listLeads, updateLeadExtras } from "./repo";
import type { Lead } from "./types";

/**
 * OS LEADS ANTIGOS SEM VESTÍGIO NENHUM DE CONTATO — a tela de revisão.
 *
 * **O relato.** `seloContato` existe desde 2026-08-05 e `registrosEnvio`
 * desde 2026-08-10. Quem foi abordado à mão antes disso não deixou rastro
 * nenhum: nem status, nem selo, nem registro. Esses leads são
 * irrecuperáveis por consulta — não há como saber, olhando o doc, se
 * alguém já falou com aquele negócio —, e ficam para sempre no caminho do
 * operador como se fossem prospects frescos.
 *
 * **Por que não varrer por data.** A data de criação do lead NÃO é a data
 * de contato. No mesmo conjunto antigo há leads que nunca foram abordados,
 * e cada um deles custou uma chamada paga ao Google Places e pode ter demo
 * e captura prontas. Apagar por data destruiria isso junto, sem volta. Daí
 * esta lista existir: o corte por data só REDUZ o conjunto ao que vale a
 * pena olhar; quem decide é o operador, lead a lead, com as colunas na
 * frente.
 *
 * **O recorte "sem vestígio" é o item inteiro.** Quem tem vestígio já é
 * corretamente excluído da fila automática por `motivoEstrutural`
 * (`contactadoForaDaFila`, em `lib/fila/candidatos.ts`) e está tratado.
 * Listá-lo aqui faria o operador revisar — e possivelmente apagar — lead
 * que já está resolvido. Por isso os três campos abaixo são lidos com a
 * MESMA regra daquele filtro, e não com uma segunda cópia dela.
 */

/**
 * Teto de linhas por busca. O operador trabalha em levas, e uma lista de
 * milhares de linhas não é revisável de qualquer jeito — o que ela faria é
 * pesar a página e convidar ao "selecionar tudo" sem olhar, que é
 * exatamente o gesto que esta tela existe para evitar. O corte fica
 * registrado em `truncado` em vez de acontecer calado (mesma postura de
 * `POOL_MAX` no pool da fila).
 */
export const SEM_VESTIGIO_MAX = 200;

/**
 * Teto de ids por chamada de ação. As ações são de lote, e um lote grande
 * demais estoura o tempo da serverless NO MEIO da destruição — o pior
 * resultado possível. A tela manda em levas sequenciais deste tamanho;
 * cada leva que passou já está gravada.
 */
export const SEM_VESTIGIO_LOTE_MAX = 50;

/** Data de corte padrão — o dia em que `registrosEnvio` passou a existir. */
export const CORTE_PADRAO = "2026-08-10";

/** "YYYY-MM-DD", e nada além disso: a chave de calendário é comparada como string. */
const CORTE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function corteValido(corte: string): boolean {
  if (!CORTE_RE.test(corte)) return false;
  const data = new Date(`${corte}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === corte;
}

/**
 * Uma linha da tela de revisão. Só o que a decisão exige — o operador
 * decide por "vale a pena guardar?", e é isso que as colunas respondem.
 */
export interface LinhaSemVestigio {
  leadId: string;
  nome: string;
  /** `busca.nicho` — "" quando o lead não veio de busca nenhuma. */
  nicho: string;
  criadoEm: string;
  temDemo: boolean;
  /** `capturas.estado === "pronto"` — a peça de prospecção existe. */
  capturaPronta: boolean;
  /**
   * A demo foi ABERTA por alguém de fora — ver `demoAbertaPorFora`. É o
   * melhor sinal de "não apague este" que o banco sabe dar.
   */
  abertaPorFora: boolean;
}

export interface RevisaoSemVestigio {
  /** A chave de calendário usada de fato (ecoada para a tela não adivinhar). */
  corte: string;
  /** Quantos leads o recorte encontrou — ANTES do teto. */
  total: number;
  /** `total` passou de `SEM_VESTIGIO_MAX` e a lista saiu cortada. */
  truncado: boolean;
  linhas: LinhaSemVestigio[];
}

/**
 * VESTÍGIO NO PRÓPRIO DOC DO LEAD — os três campos, na mesma leitura de
 * `motivoEstrutural`:
 *
 * - `seloContato`: carimbado ao CLICAR no botão de WhatsApp (ficha e /hoje),
 *   independente do fluxo de status;
 * - `registrosEnvio`: um por clique, o histórico do mesmo botão;
 * - `contato.primeiroContatoEm`: o carimbo da transição "novo → contactado",
 *   que pega o doc gravado por fora da regra (migração, edição direta).
 */
export function temVestigioDeContato(lead: Lead): boolean {
  return (
    lead.seloContato !== undefined ||
    (lead.registrosEnvio?.length ?? 0) > 0 ||
    lead.contato?.primeiroContatoEm !== undefined
  );
}

/**
 * A DEMO FOI ABERTA POR ALGUÉM DE FORA — e é só isto que o banco sabe
 * sobre "o link chegou a alguém".
 *
 * **Ter token NÃO é sinal de nada.** `garantirEnviosCanais` gera um token
 * de cada canal no `saveDemo` e faz self-heal na leitura da ficha (ver
 * `lib/demos/envio.ts`): TODO lead com demo tem token, mesmo que ninguém
 * jamais tenha tocado no botão. Uma coluna baseada em `demo.envios`
 * marcaria 100% dos leads com demo e não informaria nada.
 *
 * O que de fato fica registrado é a VISITA: `registrarVisitaDemo` grava
 * uma entrada por carregamento de `/demo/{leadId}` com `?t=` válido, e
 * `interna: false` quer dizer que o navegador não tinha nem sessão nem
 * marcador de dispositivo — ou seja, não era preview do time (ver
 * `classificarVisitaInterna` em `lib/device.ts`).
 *
 * **O falso-negativo é real e vai escrito na tela**: "Copiar link" não
 * grava nada, então um link copiado, colado numa conversa e nunca aberto é
 * invisível aqui. Na prática o buscador de prévia do WhatsApp também abre
 * a URL, então um link COLADO costuma acender esta coluna mesmo sem o lead
 * clicar — mas costumar não é garantir, e a tela diz isso em vez de
 * prometer o que não pode cumprir.
 */
export function demoAbertaPorFora(lead: Lead): boolean {
  return (lead.demoVisitas ?? []).some((visita) => !visita.interna);
}

/**
 * O lead é candidato à revisão? Puro, para o teste poder cobrar cada
 * cláusula sozinha. `temEnvioNaFila` vem de fora porque mora em outra
 * coleção (ver `listarSemVestigio`).
 */
export function elegivelParaRevisao(
  lead: Lead,
  corte: string,
  temEnvioNaFila: boolean,
): boolean {
  if (lead.status !== "novo") return false;
  if (temVestigioDeContato(lead)) return false;
  if (temEnvioNaFila) return false;
  // Descartado já está fora do caminho: listá-lo seria pedir revisão de
  // trabalho já feito, e a ação padrão ("tirar da fila") nele é no-op. É
  // também o que faz o descarte SUMIR o lead da lista — o retorno visual
  // correto de uma ação que não apaga nada.
  if (lead.descartado === true) return false;
  return saoPauloDateKey(new Date(lead.criadoEm)) < corte;
}

function linhaDoLead(lead: Lead): LinhaSemVestigio {
  return {
    leadId: lead.placeId,
    nome: lead.nome,
    nicho: lead.busca?.nicho ?? "",
    criadoEm: lead.criadoEm,
    temDemo: lead.demo !== undefined,
    capturaPronta: lead.capturas?.estado === "pronto",
    abertaPorFora: demoAbertaPorFora(lead),
  };
}

/**
 * A varredura. Uma leitura de `/leads` (via `listLeads`, que já exclui o
 * lead fixo de teste na origem) e uma de `filaEnvios` — e é o custo que
 * esta tela paga POR BUSCA PEDIDA, nunca ao abrir a /config: o painel só
 * busca quando o operador aperta "Procurar" (ver `LeadsSemVestigio.tsx`).
 *
 * **DOC EM `filaEnvios` É VESTÍGIO.** Todo doc daquela coleção nasce de uma
 * RESERVA da fila (`reservadoEm` + `dispositivo` são obrigatórios). O envio
 * confirmado carimba `seloContato` na mesma transação — mas a claim que
 * expira SEM confirmação não carimba nada, e a retenção trata exatamente
 * esse caso como "provavelmente a mensagem saiu" (ver
 * `claimExpiradaSemConfirmacao` em `lib/fila/estado.ts`). Pelo recorte dos
 * três campos do lead, esse lead entraria aqui como "sem vestígio nenhum" e
 * poderia ser destruído — sendo justamente um que provavelmente recebeu
 * mensagem. Lead que a fila já trabalhou tem vitrine própria (retidos,
 * print pendente, `filaParado` na ficha) e não é assunto desta tela.
 *
 * Ordem: do mais ANTIGO para o mais novo. O conjunto que motivou a tela é o
 * antigo, e é por ele que a revisão começa.
 */
export async function listarSemVestigio(
  db: AppDb,
  corte: string,
): Promise<RevisaoSemVestigio> {
  const [leads, enviosSnap] = await Promise.all([
    listLeads(db, { status: "novo" }),
    db.collection(FILA_ENVIOS_COLLECTION).get(),
  ]);
  const naFila = new Set(enviosSnap.docs.map((doc) => doc.id));

  const elegiveis = leads
    .filter((lead) => elegivelParaRevisao(lead, corte, naFila.has(lead.placeId)))
    .sort(
      // Desempate por id: a ordem não pode depender de em que ordem o
      // Firestore devolveu os docs (mesma regra da seleção da fila).
      (a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.placeId.localeCompare(b.placeId),
    );

  return {
    corte,
    total: elegiveis.length,
    truncado: elegiveis.length > SEM_VESTIGIO_MAX,
    linhas: elegiveis.slice(0, SEM_VESTIGIO_MAX).map(linhaDoLead),
  };
}

/**
 * TIRAR DA FILA em lote — a ação PADRÃO da tela, e a reversível.
 *
 * Usa o `descartado` que já existe: o lead continua na base inteiro (demo,
 * captura, telefone, o que a busca paga trouxe), vai para o fim da lista de
 * /leads com listra, sai do pool da fila automática (`motivoEstrutural` o
 * barra em `descartado`) e volta com um clique em "Restaurar lead" na
 * ficha. Nada é destruído, então nada aqui precisa de confirmação.
 *
 * Sequencial pelo mesmo motivo do lote da exclusão, e TOLERA lead ausente:
 * duas abas do painel podem mandar o mesmo lote, e um id que já não existe
 * não é motivo para derrubar a leva inteira no meio.
 */
export async function descartarEmLote(db: AppDb, leadIds: string[]): Promise<number> {
  let descartados = 0;
  for (const leadId of leadIds) {
    if (!(await getLead(db, leadId))) continue;
    await updateLeadExtras(db, leadId, { descartado: true });
    descartados += 1;
  }
  return descartados;
}
