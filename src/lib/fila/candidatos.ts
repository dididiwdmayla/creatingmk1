import type { AppDb } from "@/lib/firestore-like";
import { utcOffsetDoLead } from "@/lib/leads/janelaContato";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";
import type { FaixaHorario } from "@/lib/places/client";
import { normalizaNicho } from "@/lib/precificacao/calc";

import {
  FILA_ENVIOS_COLLECTION,
  TENTATIVAS_MAX,
  type FilaEnvioDoc,
} from "./envios";
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
}

export interface PoolCandidatos {
  geradoEm: string;
  candidatos: CandidatoFila[];
  /** Quantos leads a varredura leu — o custo da última reconstrução, explícito. */
  lidos: number;
  /** A base passou de POOL_MAX e o pool saiu cortado. */
  truncado: boolean;
}

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
 * `descartado` entra aqui e não estava na lista do pedido: um lead que o
 * operador descartou à mão não pode voltar por uma porta automática — o
 * descarte é suave (reversível, continua na base), mas é uma decisão humana
 * explícita de não falar com aquele negócio.
 */
export function candidatoEstavel(lead: Lead, envio: FilaEnvioDoc | undefined): boolean {
  if (lead.status !== "novo") return false;
  if (lead.descartado === true) return false;
  if (lead.telefoneInvalido === true) return false;
  if (!(lead.detalhes?.telefoneIntl ?? lead.telefoneIntl)) return false;
  if (!lead.demo) return false;
  if (lead.capturas?.estado !== "pronto") return false;
  // Print é obrigatório: "pronto" não garante que a tela de celular saiu.
  if (!printUrlDoLead(lead.capturas)) return false;
  // Sem fuso derivável não dá para saber que horas são lá — e mandar
  // mensagem às três da manhã é pior do que não mandar.
  if (utcOffsetDoLead(lead) === undefined) return false;
  // Só o que é PERMANENTE barra aqui (já enviado, número inválido, tentativas
  // esgotadas). Claim viva NÃO barra: ela dura 5 min e o pool dura 10, então
  // quem decide isso é a transação de `reservarLead`, na hora, sem cache.
  if (envio && envio.estado !== "reservado") {
    if (envio.estado !== "falhou" || envio.tentativas >= TENTATIVAS_MAX) return false;
  }
  return true;
}

function paraCandidato(lead: Lead): CandidatoFila {
  return {
    id: lead.placeId,
    nicho: lead.busca?.nicho ? normalizaNicho(lead.busca.nicho) : "",
    // `candidatoEstavel` já garantiu que não é undefined.
    offset: utcOffsetDoLead(lead) as number,
    faixas: lead.horarios?.faixas ?? [],
    criadoEm: lead.criadoEm,
  };
}

/**
 * A VARREDURA — a única leitura cara desta fila, e a razão de o pool existir.
 * Lê `/leads` e `/filaEnvios` inteiras uma vez e guarda só quem passa nos
 * critérios estáveis, na ordem justa (mais antigo primeiro).
 */
export async function construirPool(db: AppDb, now: Date = new Date()): Promise<PoolCandidatos> {
  const [leadsSnap, enviosSnap] = await Promise.all([
    db.collection(LEADS_COLLECTION).get(),
    db.collection(FILA_ENVIOS_COLLECTION).get(),
  ]);

  const envios = new Map<string, FilaEnvioDoc>(
    enviosSnap.docs.map((doc) => [doc.id, doc.data() as unknown as FilaEnvioDoc]),
  );

  const candidatos = leadsSnap.docs
    .map((doc) => doc.data() as unknown as Lead)
    .filter((lead) => candidatoEstavel(lead, envios.get(lead.placeId)))
    .map(paraCandidato)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));

  return {
    geradoEm: now.toISOString(),
    candidatos: candidatos.slice(0, POOL_MAX),
    lidos: leadsSnap.docs.length,
    truncado: candidatos.length > POOL_MAX,
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
 */
export async function lerPool(db: AppDb, now: Date = new Date()): Promise<PoolCandidatos> {
  const snap = await poolRef(db).get();
  const valido = poolValido(snap.exists ? snap.data() : undefined, now);
  if (valido) return valido;

  const novo = await construirPool(db, now);
  await poolRef(db).set(novo as unknown as Record<string, unknown>);
  return novo;
}
