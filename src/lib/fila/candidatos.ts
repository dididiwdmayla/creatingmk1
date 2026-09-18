import type { AppDb } from "@/lib/firestore-like";
import { utcOffsetDoLead } from "@/lib/leads/janelaContato";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";
import type { FaixaHorario } from "@/lib/places/client";
import { normalizaNicho } from "@/lib/precificacao/calc";

import {
  FILA_ENVIOS_COLLECTION,
  TENTATIVAS_MAX,
  retidoPorEnvio,
  type FilaEnvioDoc,
} from "./envios";
import { MOTIVOS_FISICOS, motivoEhFisico, type MotivoFisico } from "./estado";
import { printUrlDoLead } from "./print";

/**
 * O POOL DE CANDIDATOS — a resposta ao único problema de escala desta fila.
 *
 * `/api/fila/proximo` é chamada DE MINUTO EM MINUTO, a noite toda, para
 * entregar no máximo `metaDiaria` mensagens. Os critérios de elegibilidade,
 * porém, não são consultáveis: a janela de contato é CALCULADA (faixas da
 * família × horário de funcionamento × fuso do lead — ver `barraDoDia`),
 * "tem demo" é presença de campo, e `telefoneInvalido` AUSENTE não casa com
 * `== false` em query nenhuma. Somando a isso que o `AppDb` deste repo não
 * tem query (`firestore-like.ts`: só `collection().get()`, a coleção
 * inteira), a rota ingênua varreria `/leads` 1440× por dia.
 *
 * Então a varredura acontece UMA VEZ a cada `POOL_TTL_MS` e o resultado fica
 * num doc só. A chamada que não vai entregar nada custa 4 leituras em vez de
 * centenas — e cresce em NADA quando a base de leads cresce.
 *
 * **Este doc é CACHE, nunca fonte de verdade.** Nada é entregue com base
 * nele: escolhido o candidato, a rota reserva a claim e RELÊ o doc do lead
 * para reconferir tudo com dado fresco (ver `/api/fila/proximo`). Pool velho
 * pode OFERECER um lead que não serve mais; nunca ENTREGAR. É o que deixa a
 * janela de 10 minutos ser barata sem ser mentirosa.
 *
 * Por que não `where(...).limit(N)` (se o `AppDb` ganhasse query): `limit`
 * sem `orderBy` ordena por `__name__`, então devolveria as MESMAS N docs em
 * toda chamada. Se essas N estivessem todas fora de janela, a rota diria
 * "sem leads elegíveis" para sempre enquanto o lead N+1 estava pronto —
 * exatamente o silêncio que faz sair 4 mensagens em vez de 15. Consertar
 * exigiria cursor rotativo persistido (`orderBy(documentId)` + `startAfter`),
 * quatro métodos novos na interface e no fake, e risco de índice faltando
 * derrubar a rota às duas da manhã.
 */
export const FILA_CANDIDATOS_COLLECTION = "filaCandidatos";
export const FILA_CANDIDATOS_DOC = "pool";

/** Idade máxima do pool antes de ser reconstruído. */
export const POOL_TTL_MS = 10 * 60 * 1000;

/**
 * Teto de entradas no doc (Firestore trava em 1 MiB e cada entrada custa uns
 * 400 bytes com as faixas). Ao estourar, ficam os de `criadoEm` mais ANTIGO —
 * quem esperou mais vai primeiro, a mesma ordem justa da seleção. O corte
 * fica registrado em `truncado` em vez de acontecer calado.
 */
export const POOL_MAX = 2000;

/**
 * Um candidato, reduzido ao que a filtragem em memória precisa. Guarda o
 * fuso e o nicho já RESOLVIDOS (não o endereço cru) porque resolver é a parte
 * cara, e ela só tem que acontecer uma vez por reconstrução.
 */
export interface CandidatoFila {
  /** placeId — o id do doc em /leads. */
  id: string;
  /** `busca.nicho` normalizado; "" quando o lead não veio de busca nenhuma. */
  nicho: string;
  /** Deslocamento UTC em minutos, já resolvido por `utcOffsetDoLead`. */
  offset: number;
  /** Horário de funcionamento; vazio = desconhecido (a janela então estima). */
  faixas: FaixaHorario[];
  /** Ordem justa da fila: quem entrou na base primeiro é atendido primeiro. */
  criadoEm: string;
  /**
   * SELEÇÃO MANUAL do operador (`Lead.filaManual`) — ausente = false.
   *
   * Um BOOLEANO, e nada mais: esta entrada é compacta de propósito (o doc do
   * pool tem teto de 1 MiB e `POOL_MAX` de 2000 entradas), e é ela que a
   * rota que o celular bate 1440× por dia carrega. Quem precisa de nome ou
   * de motivo lê o doc do lead POR ID, e só das linhas que a tela mostra.
   *
   * Opcional (em vez de sempre presente) para o doc que já está gravado
   * continuar válido sem migração: pool antigo não tem a chave, e `!== true`
   * lê isso como "não é manual", que é o correto.
   */
  manual?: boolean;
}

/**
 * Os filtros ESTRUTURAIS, na ordem real de avaliação de `motivoEstrutural` —
 * a mesma ordem em que um lead que falha em vários ao mesmo tempo é
 * contado só uma vez, pelo primeiro que barrou. Ver "diagnóstico da fila"
 * em `lib/fila/selecao.ts` para as etapas seguintes (nicho e janela).
 */
export const MOTIVOS_ESTRUTURAIS = [
  "status",
  "contactadoForaDaFila",
  "descartado",
  "telefoneInvalido",
  "semTelefone",
  "semDemo",
  "capturaNaoPronta",
  "semFuso",
] as const;

export type MotivoEstrutural = (typeof MOTIVOS_ESTRUTURAIS)[number];

/**
 * Trava, em tempo de COMPILAÇÃO, que toda ausência de peça listada no módulo
 * client-safe é de fato uma peneira estrutural daqui. As duas listas vivem
 * separadas por necessidade (`estado.ts` não pode arrastar `node:crypto` para
 * o navegador), e separadas sem guarda elas divergiriam em silêncio — um
 * motivo renomeado aqui faria o lead pendente sumir da tela sem erro nenhum.
 * Há também um teste conferindo o mesmo em tempo de execução.
 */
const _MOTIVOS_FISICOS_SAO_ESTRUTURAIS: readonly MotivoEstrutural[] = MOTIVOS_FISICOS;
void _MOTIVOS_FISICOS_SAO_ESTRUTURAIS;

/** Quantos leads pararam em cada filtro estrutural na última reconstrução do pool. */
export type DiagnosticoEstrutural = Record<MotivoEstrutural, number>;

export function estruturalVazio(): DiagnosticoEstrutural {
  return {
    status: 0,
    contactadoForaDaFila: 0,
    descartado: 0,
    telefoneInvalido: 0,
    semTelefone: 0,
    semDemo: 0,
    capturaNaoPronta: 0,
    semFuso: 0,
  };
}

export interface PoolCandidatos {
  geradoEm: string;
  candidatos: CandidatoFila[];
  /**
   * Quantos leads a varredura CONSIDEROU — o custo da última reconstrução,
   * explícito. O lead fixo de teste não entra nesta conta (nem em nenhuma
   * outra): ele não é um negócio da base.
   */
  lidos: number;
  /** A base passou de POOL_MAX e o pool saiu cortado. */
  truncado: boolean;
  /** Diagnóstico da etapa estrutural desta mesma varredura — ver `motivoEstrutural`. */
  estrutural: DiagnosticoEstrutural;
  /**
   * Os leads marcados à mão (`Lead.filaManual`) que pararam numa AUSÊNCIA DE
   * PEÇA (`MOTIVOS_FISICOS`) — o operador escolheu aquele negócio e ele não
   * pode sumir em silêncio, mesmo não sendo entregável.
   *
   * Apurados NA MESMA passada de `construirPool`: são leads que reprovam em
   * `motivoEstrutural`, então nunca serão candidatos, e achá-los depois
   * custaria de novo a varredura cara que o pool existe para evitar. Ordem
   * justa (`criadoEm`, desempate por id), a mesma dos candidatos.
   */
  manuaisPendentes: PendenteManual[];
  /**
   * Quantos são ao todo — `manuaisPendentes` é cortado em
   * `MANUAIS_PENDENTES_MAX` e este número não. Sem ele, um corte apareceria
   * como "são só estes", que é a mentira calada que `truncado` existe para
   * não deixar acontecer do lado dos candidatos.
   */
  manuaisPendentesTotal: number;
}

/**
 * Um lead marcado à mão que ainda não tem a peça que o envio exige. Só id e
 * motivo: o nome vem de leitura POR ID, e só das linhas que a tela mostra —
 * a mesma regra que mantém a entrada do candidato compacta.
 */
export interface PendenteManual {
  id: string;
  motivo: MotivoFisico;
}

/**
 * Teto da lista de pendentes dentro do doc do pool. Baixo de propósito: cada
 * entrada aqui nasce de um clique humano na ficha, então a ordem de grandeza
 * é de punhados — e o doc é o mesmo que o celular lê a cada ciclo. O total
 * real continua em `manuaisPendentesTotal`.
 */
export const MANUAIS_PENDENTES_MAX = 20;

function poolRef(db: AppDb) {
  return db.collection(FILA_CANDIDATOS_COLLECTION).doc(FILA_CANDIDATOS_DOC);
}

/**
 * Critérios ESTÁVEIS de elegibilidade — os que não dependem da hora nem da
 * config, e por isso podem ser decididos na reconstrução e congelados no
 * pool. A janela e `nichosPermitidos` ficam de fora de propósito: a primeira
 * muda a cada minuto, a segunda muda quando o admin mexe em /config, e
 * congelar qualquer uma das duas faria o pool mentir até a próxima varredura.
 *
 * Devolve o MOTIVO específico (para o diagnóstico) em vez de um booleano —
 * `candidatoEstavel` é a versão booleana, derivada desta.
 *
 * `descartado` entra aqui e não estava na lista do pedido original: um lead
 * que o operador descartou à mão não pode voltar por uma porta automática —
 * o descarte é suave (reversível, continua na base), mas é uma decisão
 * humana explícita de não falar com aquele negócio.
 *
 * `contactadoForaDaFila` cobre o mesmo tipo de furo: o clique manual no botão
 * de WhatsApp (ficha e /hoje) grava `seloContato` e soma em `registrosEnvio`
 * (`registrarSeloContato`, `lib/leads/repo.ts`) SEM tocar `status` — só o
 * botão "Contactado", à parte, faz isso. Sem esta checagem, um lead
 * contactado à mão continuava "novo" para sempre e voltava candidato à fila
 * automática todo santo dia, como se nada tivesse acontecido. `contato.
 * primeiroContatoEm` entra pelo mesmo motivo: é o carimbo da transição
 * "novo → contactado" (`STATUS_STAMPS`, `lib/leads/repo.ts`), e um doc
 * gravado por fora dessa regra (migração, edição direta) não pode escapar
 * pela falta dela.
 *
 * ESSA CHECAGEM VEM DEPOIS DE `status`, e a ordem importa: o envio
 * confirmado PELA fila também grava selo e registro (`confirmarEnvio`,
 * `lib/fila/confirmar.ts`), na MESMA transação que move `status` para
 * "contactado" — os dois nascem juntos, atomicamente. Checando `status`
 * primeiro, esse lead já sai por "status"; só quem tem selo/registro/carimbo
 * SEM status ter mudado (o caso do clique manual) cai em
 * `contactadoForaDaFila`. Checar na ordem inversa rotularia o envio
 * automático como "contactado fora da fila", o que seria falso.
 */
export function motivoEstrutural(lead: Lead): MotivoEstrutural | undefined {
  if (lead.status !== "novo") return "status";
  if (
    lead.seloContato !== undefined ||
    (lead.registrosEnvio?.length ?? 0) > 0 ||
    lead.contato?.primeiroContatoEm !== undefined
  ) {
    return "contactadoForaDaFila";
  }
  if (lead.descartado === true) return "descartado";
  if (lead.telefoneInvalido === true) return "telefoneInvalido";
  if (!(lead.detalhes?.telefoneIntl ?? lead.telefoneIntl)) return "semTelefone";
  if (!lead.demo) return "semDemo";
  if (lead.capturas?.estado !== "pronto") return "capturaNaoPronta";
  // Print é obrigatório: "pronto" não garante que a tela de celular saiu.
  // Mesmo balde de "capturaNaoPronta" — as duas dizem a mesma coisa pro
  // operador: a peça que vende ainda não existe.
  if (!printUrlDoLead(lead.capturas)) return "capturaNaoPronta";
  // Sem fuso derivável não dá para saber que horas são lá — e mandar
  // mensagem às três da manhã é pior do que não mandar.
  if (utcOffsetDoLead(lead) === undefined) return "semFuso";
  return undefined;
}

/**
 * Só o que é PERMANENTE barra aqui (já enviado, número inválido, tentativas
 * esgotadas) — mais a RETENÇÃO, que é temporária mas datada. Claim VIVA não
 * barra: ela dura 5 min e o pool dura 10, então quem decide isso é a
 * transação de `reservarLead`, na hora, sem cache.
 *
 * `retencaoMs` (0 = desligada) barra o lead cuja claim expirou SEM
 * CONFIRMAÇÃO enquanto a janela corre — ver o bloco da retenção em
 * `estado.ts`. Aqui ela é PRÉ-FILTRO, não a proteção: quem impede a
 * mensagem repetida é `leadDisponivel`, na transação da reserva, porque o
 * pool é cache e pode estar até `POOL_TTL_MS` atrasado. O papel deste filtro
 * é outro, e também necessário: manter o funil e as listas do painel
 * honestos, e não dar a vaga de candidato a quem não pode receber nada.
 *
 * Que o cache atrase é seguro justamente por causa dessa divisão — o portão
 * duro relê o doc fresco, então nem um pool velho nem uma janela recém
 * aumentada no painel conseguem liberar um lead retido.
 *
 * O resto fica FORA do diagnóstico estrutural de propósito: por construção,
 * "enviado" já reprova antes em `status` (a confirmação move
 * `novo → contactado` na mesma transação, com selo e registro incluídos) e
 * "inválido" já reprova antes em `telefoneInvalido` (mesma transação). O
 * único caso que sobra — tentativas esgotadas — já tem vitrine própria
 * (`filaParado`, na ficha do lead); duplicá-lo no pool confundiria duas
 * fontes da mesma informação. A RETENÇÃO é a exceção deliberada a esse
 * precedente: ela não tem vitrine em lugar nenhum, e um lead que para por
 * ela pararia em silêncio — por isso ela é contada e listada no painel (ver
 * `lib/fila/retidos.ts`).
 *
 * Essa garantia (selo e registro sempre vêm com `status` já mudado) só vale
 * para quem passou pela CONFIRMAÇÃO da fila — as duas escritas são atômicas,
 * na mesma transação. O clique manual do botão de WhatsApp na ficha
 * (`registrarSeloContato`) grava o MESMO selo e registro sem tocar `status`
 * nenhum, e sem doc de envio nenhum — por isso ele não passa por aqui: quem
 * pega esse caso é `motivoEstrutural` (`contactadoForaDaFila`), na etapa
 * anterior.
 */
function envioImpedePool(
  envio: FilaEnvioDoc | undefined,
  now: Date,
  retencaoMs: number,
): boolean {
  if (!envio) return false;
  if (envio.estado === "reservado") return retidoPorEnvio(envio, now, retencaoMs);
  if (envio.estado === "falhou") return envio.tentativas >= TENTATIVAS_MAX;
  return true;
}

/**
 * `now`/`retencaoMs` são opcionais porque o chamador de `/proximo` usa esta
 * função para reconferir só o LEAD (o estado da fila já foi decidido pela
 * transação da reserva, e ele passa `undefined` no envio). Sem envio, os
 * dois não têm o que fazer.
 */
export function candidatoEstavel(
  lead: Lead,
  envio: FilaEnvioDoc | undefined,
  now: Date = new Date(),
  retencaoMs = 0,
): boolean {
  return motivoEstrutural(lead) === undefined && !envioImpedePool(envio, now, retencaoMs);
}

function paraCandidato(lead: Lead): CandidatoFila {
  return {
    id: lead.placeId,
    nicho: lead.busca?.nicho ? normalizaNicho(lead.busca.nicho) : "",
    // `candidatoEstavel` já garantiu que não é undefined.
    offset: utcOffsetDoLead(lead) as number,
    faixas: lead.horarios?.faixas ?? [],
    criadoEm: lead.criadoEm,
    // Chave OMITIDA quando não é manual (e não `manual: false`): são até
    // POOL_MAX entradas no mesmo doc de 1 MiB, e a ausência já significa
    // exatamente isso em todo mundo que a lê.
    ...(lead.filaManual === true && { manual: true }),
  };
}

/**
 * A VARREDURA — a única leitura cara desta fila, e a razão de o pool existir.
 * Lê `/leads` e `/filaEnvios` inteiras uma vez e guarda só quem passa nos
 * critérios estáveis, na ordem justa (mais antigo primeiro).
 *
 * O diagnóstico estrutural (`estrutural`) é apurado NA MESMA passada — uma
 * segunda varredura só para contar duplicaria a leitura cara que o pool
 * existe pra evitar. Um lead barrado por `motivoEstrutural` conta ali; um
 * barrado só por `envioImpedePool` (tentativas esgotadas) não conta em
 * lugar nenhum — ver o comentário de `envioImpedePool`.
 */
export async function construirPool(
  db: AppDb,
  now: Date = new Date(),
  opcoes: { retencaoMs?: number } = {},
): Promise<PoolCandidatos> {
  const [leadsSnap, enviosSnap] = await Promise.all([
    db.collection(LEADS_COLLECTION).get(),
    db.collection(FILA_ENVIOS_COLLECTION).get(),
  ]);

  const envios = new Map<string, FilaEnvioDoc>(
    enviosSnap.docs.map((doc) => [doc.id, doc.data() as unknown as FilaEnvioDoc]),
  );

  const estrutural = estruturalVazio();
  const candidatos: CandidatoFila[] = [];
  // Ordenados junto com os candidatos, e pela MESMA regra justa — ver abaixo.
  const pendentes: Array<PendenteManual & { criadoEm: string }> = [];
  let lidos = 0;
  for (const doc of leadsSnap.docs) {
    const lead = doc.data() as unknown as Lead;
    // O LEAD FIXO DE TESTE não existe para esta varredura — nem como
    // candidato, nem em `lidos`, nem numa das sete contagens estruturais.
    // Não é só higiene de número: candidato ele mandaria mensagem DE
    // VERDADE sozinho, à noite, para o telefone do doc. O alvo do disparo
    // de teste é escolhido na tela e chega por id, nunca pelo pool (ver
    // `lib/fila/leadTeste.ts`).
    if (lead.leadDeTeste === true) continue;
    lidos += 1;
    const motivo = motivoEstrutural(lead);
    if (motivo) {
      estrutural[motivo] += 1;
      // O lead que o operador ESCOLHEU não some em silêncio quando o que
      // falta é uma PEÇA (demo, print, telefone, fuso): ele sai da fila de
      // entrega — `/proximo` nunca o vê, porque ele não vira candidato —, mas
      // continua visível como pendência, com o motivo. As demais peneiras
      // (status, contactado fora da fila, descartado, número sem WhatsApp)
      // não entram: ali não falta peça, houve decisão.
      if (lead.filaManual === true && motivoEhFisico(motivo)) {
        pendentes.push({ id: lead.placeId, motivo, criadoEm: lead.criadoEm });
      }
      continue;
    }
    if (envioImpedePool(envios.get(lead.placeId), now, opcoes.retencaoMs ?? 0)) continue;
    candidatos.push(paraCandidato(lead));
  }
  candidatos.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
  // A MESMA ordem justa dos candidatos, e não uma ordenação nova: pendente
  // não disputa vaga com ninguém (não está na fila de entrega), então o que
  // resta é só "quem espera há mais tempo aparece primeiro".
  pendentes.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));

  return {
    geradoEm: now.toISOString(),
    candidatos: candidatos.slice(0, POOL_MAX),
    lidos,
    truncado: candidatos.length > POOL_MAX,
    estrutural,
    manuaisPendentes: pendentes
      .slice(0, MANUAIS_PENDENTES_MAX)
      .map(({ id, motivo }) => ({ id, motivo })),
    manuaisPendentesTotal: pendentes.length,
  };
}

function poolValido(data: Record<string, unknown> | undefined, now: Date): PoolCandidatos | undefined {
  if (!data || typeof data.geradoEm !== "string" || !Array.isArray(data.candidatos)) return undefined;
  const idade = now.getTime() - new Date(data.geradoEm).getTime();
  // Pool com data no FUTURO (relógio que andou para trás, doc escrito à mão)
  // conta como vencido: melhor pagar uma varredura do que servir de um cache
  // que não dá para datar.
  if (!Number.isFinite(idade) || idade < 0 || idade > POOL_TTL_MS) return undefined;
  return data as unknown as PoolCandidatos;
}

/**
 * O pool para ESTE instante: o persistido quando ainda está dentro do TTL,
 * senão uma varredura nova, já gravada. Preguiçoso de propósito — sem cron,
 * sem job de manutenção: quem paga a varredura é a primeira chamada que
 * chega na seleção depois do pool vencer, e as chamadas barradas pelos
 * portões baratos (pausa, meta, teto, intervalo) nunca chegam aqui.
 *
 * `retencaoMs` é a política em vigor NA HORA DA RECONSTRUÇÃO — o doc é
 * compartilhado, então os dois chamadores (`/api/fila/proximo` e
 * `montarResumoFila`) passam o mesmo valor da config, senão quem
 * reconstruísse primeiro decidiria pelo outro. Que o valor fique congelado
 * até o TTL vencer é aceitável pela mesma razão de sempre: o pool só
 * OFERECE, e quem ENTREGA (`reservarLead`) relê o doc fresco com a política
 * fresca. Uma janela recém aumentada no painel vale na reserva no mesmo
 * segundo, mesmo que o pool ainda não saiba dela.
 */
export async function lerPool(
  db: AppDb,
  now: Date = new Date(),
  opcoes: { retencaoMs?: number } = {},
): Promise<PoolCandidatos> {
  const snap = await poolRef(db).get();
  const valido = poolValido(snap.exists ? snap.data() : undefined, now);
  if (valido) return valido;

  const novo = await construirPool(db, now, opcoes);
  await poolRef(db).set(novo as unknown as Record<string, unknown>);
  return novo;
}

/** `estrutural` de um doc lido cru — normaliza doc pré-migração (campo ausente) ou corrompido para zero, nunca `undefined`. */
function estruturalDoDoc(data: unknown): DiagnosticoEstrutural {
  const saida = estruturalVazio();
  if (typeof data !== "object" || data === null) return saida;
  for (const motivo of MOTIVOS_ESTRUTURAIS) {
    const valor = (data as Record<string, unknown>)[motivo];
    if (typeof valor === "number" && Number.isFinite(valor)) saida[motivo] = valor;
  }
  return saida;
}

/**
 * `manuaisPendentes` de um doc lido cru — descarta entrada malformada e
 * motivo que não é físico, em vez de deixar lixo virar linha na tela. Doc
 * pré-migração (campo ausente) vira lista vazia, nunca `undefined`.
 */
function pendentesDoDoc(data: unknown): PendenteManual[] {
  if (!Array.isArray(data)) return [];
  const saida: PendenteManual[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const { id, motivo } = item as { id?: unknown; motivo?: unknown };
    if (typeof id !== "string" || !id) continue;
    if (typeof motivo !== "string" || !motivoEhFisico(motivo)) continue;
    saida.push({ id, motivo });
  }
  return saida;
}

/**
 * O pool tal como está agora — sem checar TTL, sem reconstruir. Existe só
 * para `/api/fila/diagnostico`: o painel lê os números do último rebuild
 * numa leitura só, e NUNCA dispara a varredura cara de `/leads` — que é
 * exatamente o custo que o pool existe para evitar. `undefined` = pool
 * nunca construído (ninguém bateu em `/proximo` ainda).
 *
 * As contagens são por isso um retrato — podem ter até `POOL_TTL_MS` de
 * idade, ou mais se `/proximo` também não estiver sendo chamado; é para
 * isso que `geradoEm` viaja junto, explícito.
 */
export async function lerPoolBruto(db: AppDb): Promise<PoolCandidatos | undefined> {
  const snap = await poolRef(db).get();
  if (!snap.exists) return undefined;
  const data = snap.data();
  if (!data || typeof data.geradoEm !== "string" || !Array.isArray(data.candidatos)) return undefined;
  const manuaisPendentes = pendentesDoDoc(data.manuaisPendentes);
  return {
    geradoEm: data.geradoEm,
    candidatos: data.candidatos as CandidatoFila[],
    lidos: typeof data.lidos === "number" ? data.lidos : 0,
    truncado: data.truncado === true,
    estrutural: estruturalDoDoc(data.estrutural),
    manuaisPendentes,
    // Total ausente ou menor que a lista (doc pré-migração, doc escrito à
    // mão) cai para o tamanho da lista: "e mais -1 pendentes" não quer dizer
    // nada, e o número nunca pode ser MENOR do que o que já está na tela.
    manuaisPendentesTotal:
      typeof data.manuaisPendentesTotal === "number" &&
      Number.isFinite(data.manuaisPendentesTotal)
        ? Math.max(data.manuaisPendentesTotal, manuaisPendentes.length)
        : manuaisPendentes.length,
  };
}
