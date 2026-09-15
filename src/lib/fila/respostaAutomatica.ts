import { randomBytes } from "node:crypto";

import type { AppDb } from "@/lib/firestore-like";

import {
  FILA_CONTADORES_COLLECTION,
  contadorComResposta,
  diaOperacionalKey,
  horaSaoPaulo,
} from "./contadores";
import { RESERVA_DURACAO_MS } from "./envios";
import {
  FILA_RESPOSTAS_COLLECTION,
  RESPOSTA_TENTATIVAS_MAX,
  type FilaEnvioResultado,
  type FilaRespostaDoc,
  type RespostaTarefaDoc,
  type RespostaTarefaEstado,
} from "./estado";

/**
 * A RESPOSTA AUTOMÁTICA — o rascunho que deixa de esperar aprovação e vira
 * tarefa de envio na fila do aparelho (`config/fila.respostaAutomatica`,
 * padrão false).
 *
 * Este arquivo guarda o RITMO HUMANO da coisa: o atraso sorteado antes de a
 * resposta ficar disponível e a janela de horário do OPERADOR em que ela
 * pode sair. Os dois existem pela mesma razão, e ela não é técnica — uma
 * resposta que chega em dois segundos, ou às quatro da manhã, denuncia a
 * automação mais que qualquer texto que a IA escreva.
 */

/**
 * Sorteia o atraso, em segundos, de UMA resposta — o tempo entre o rascunho
 * ficar pronto e a tarefa ficar disponível para o aparelho puxar.
 *
 * SORTEADO por resposta, e não fixo: um intervalo sempre igual (12 minutos
 * cravados em toda conversa) é tão reconhecível quanto responder na hora.
 * Os dois extremos entram no sorteio (`min` e `max` inclusive).
 *
 * Faixa invertida usa o MAIOR dos dois como teto em vez de estourar: cada
 * campo do painel salva no próprio blur, então existe um instante em que o
 * mínimo já subiu e o máximo ainda não — e esse instante não pode derrubar
 * a fila. `aleatorio` é injetável só para o teste poder congelar o sorteio.
 */
export function sortearAtrasoSegundos(
  minSegundos: number,
  maxSegundos: number,
  aleatorio: () => number = Math.random,
): number {
  const min = Math.max(0, Math.trunc(minSegundos));
  const max = Math.max(min, Math.trunc(maxSegundos));
  return min + Math.floor(aleatorio() * (max - min + 1));
}

/**
 * Está dentro da JANELA DE RESPOSTA agora? Medida no relógio do OPERADOR
 * (America/Sao_Paulo, via `horaSaoPaulo`), nunca no do lead.
 *
 * É outra pergunta que a `janelaContato` da prospecção: aquela é "quando é
 * bom abordar ESTE negócio" (faixas da família × horário de funcionamento ×
 * fuso do lead); esta é "a que horas um humano responderia". Reusar a
 * primeira aqui responderia certo a pergunta errada.
 *
 * - `inicio === fim` → aberto o dia inteiro (a janela não restringe nada).
 * - `inicio < fim` → faixa normal, `inicio` inclusive e `fim` exclusivo
 *   (fim 22 = a última resposta sai 22h59, não 22h00 em ponto).
 * - `inicio > fim` → atravessa a meia-noite (22 → 6 é a madrugada inteira).
 */
export function dentroDaJanelaResposta(now: Date, inicio: number, fim: number): boolean {
  const de = horaNormalizada(inicio);
  const ate = horaNormalizada(fim);
  if (de === ate) return true;
  const hora = horaSaoPaulo(now);
  return de < ate ? hora >= de && hora < ate : hora >= de || hora < ate;
}

function horaNormalizada(hora: number): number {
  return Math.min(23, Math.max(0, Math.trunc(hora)));
}

/* ── A FILA das respostas automáticas ─────────────────────────────────── */

/**
 * `filaRespostasTarefas/{id}` — as respostas ESPERANDO o aparelho. Coleção
 * PRÓPRIA e pequena por natureza, como `/filaRespostasPendentes`: só o que
 * ainda não saiu.
 *
 * **Por que não guardar a claim no próprio `filaRespostas`**, que já tem um
 * doc por rascunho: aquela coleção é REGISTRO e acumula um doc por grupo de
 * mensagens PARA SEMPRE (resolver marca o estado, nunca apaga). `/proximo` é
 * chamada de minuto em minuto, e o `AppDb` deste repo não tem query — varrer
 * `filaRespostas` ali seria a base inteira de conversas já respondidas lida
 * 480× por dia, crescendo a cada resposta, exatamente o custo que o pool de
 * `candidatos.ts` existe para não pagar. Esta coleção some com o rascunho
 * que sai: varrê-la é ler quase nada, e não cresce com o histórico.
 *
 * Com `respostaAutomatica` desligada (o padrão) nem essa leitura acontece —
 * a rota nem chega aqui.
 */
export const FILA_RESPOSTAS_TAREFAS_COLLECTION = "filaRespostasTarefas";

/**
 * Prefixo do claimId de resposta — o mesmo DESVIO DE CUSTO ZERO da tarefa de
 * teste em `/api/fila/confirmar`: a rota precisa saber qual caminho seguir
 * ANTES de abrir a transação que toca lead, contador e rotação de frases.
 *
 * O claimId carrega o id do rascunho (`resp-<id>.<token>`) porque, diferente
 * de `filaEnvios`, aqui o `leadId` do corpo não endereça o doc: um lead pode
 * ter várias respostas ao longo do tempo. Assim a confirmação encontra a
 * tarefa sem varrer nada. O `.` separa os dois de forma não ambígua — nem o
 * uuid do id nem o base64url do token o contêm.
 */
export const CLAIM_RESPOSTA_PREFIXO = "resp-";

export type {
  RespostaTarefaDoc,
  RespostaTarefaEstado,
} from "./estado";
export { RESPOSTA_TENTATIVAS_MAX } from "./estado";

export function ehClaimDeResposta(claimId: string): boolean {
  return claimId.startsWith(CLAIM_RESPOSTA_PREFIXO);
}

/** O id do rascunho embutido no claimId, ou `undefined` se a forma não bate. */
export function idDaClaimDeResposta(claimId: string): string | undefined {
  if (!ehClaimDeResposta(claimId)) return undefined;
  const resto = claimId.slice(CLAIM_RESPOSTA_PREFIXO.length);
  const corte = resto.indexOf(".");
  if (corte <= 0 || corte === resto.length - 1) return undefined;
  return resto.slice(0, corte);
}

function gerarClaimIdResposta(id: string): string {
  return `${CLAIM_RESPOSTA_PREFIXO}${id}.${randomBytes(9).toString("base64url")}`;
}

function tarefaRef(db: AppDb, id: string) {
  return db.collection(FILA_RESPOSTAS_TAREFAS_COLLECTION).doc(id);
}

function asTarefa(data: Record<string, unknown> | undefined): RespostaTarefaDoc | undefined {
  return data as RespostaTarefaDoc | undefined;
}

function comoDoc(doc: RespostaTarefaDoc): Record<string, unknown> {
  return { ...doc };
}

function instante(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * A tarefa pode ser entregue AGORA? O atraso sorteado é o primeiro corte —
 * antes dele nada sai, seja qual for o estado.
 *
 * Reserva expirada volta a valer, a MESMA regra da fila de envio ("reservado
 * com `claimExpiraEm` no passado é livre"): é o que devolve a resposta à
 * fila sozinha quando o aparelho trava, sem job de limpeza. A reserva que
 * expira não gasta tentativa — só a falha REPORTADA gasta.
 */
export function tarefaDisponivel(doc: RespostaTarefaDoc, now: Date): boolean {
  if (instante(doc.disponivelEm) > now.getTime()) return false;
  if (doc.estado === "aguardando") return true;
  if (doc.estado === "reservado") return instante(doc.claimExpiraEm) <= now.getTime();
  if (doc.estado === "falhou") return doc.tentativas < RESPOSTA_TENTATIVAS_MAX;
  return false;
}

/**
 * A tarefa está NA MÃO DO APARELHO agora (claim viva). É o estado que o
 * painel não pode fechar: mudança de config nunca invalida claim emitida, e
 * fechar o rascunho aqui produziria a mensagem duplicada que esta fila
 * inteira existe para evitar.
 */
export function tarefaNoAparelho(doc: RespostaTarefaDoc, now: Date): boolean {
  return doc.estado === "reservado" && instante(doc.claimExpiraEm) > now.getTime();
}

/**
 * A resposta ainda está no CAMINHO AUTOMÁTICO — ou seja, o painel não
 * mostra o rascunho enquanto o interruptor estiver ligado. Falsa quando a
 * tarefa acabou (`enviado`), quando o operador a fechou (`encerrada`), e
 * quando a máquina desistiu: `invalido` ou tentativas esgotadas, os dois
 * casos em que a decisão volta para o humano.
 */
export function tarefaAutomaticaViva(doc: RespostaTarefaDoc): boolean {
  if (doc.estado === "enviado" || doc.estado === "invalido" || doc.estado === "encerrada") {
    return false;
  }
  if (doc.estado === "falhou" && doc.tentativas >= RESPOSTA_TENTATIVAS_MAX) return false;
  return true;
}

export interface NovaTarefaResposta {
  /** O MESMO id do rascunho em `filaRespostas`. */
  id: string;
  leadId: string;
  nome: string;
  numero: string;
  texto: string;
  /** Segundos de atraso já SORTEADOS por quem chama (ver `sortearAtrasoSegundos`). */
  atrasoSegundos: number;
}

/**
 * Cria a tarefa de uma resposta recém-rascunhada. Chamada pelo flush, e só
 * quando os dois interruptores permitem (ver `flushRespostas.ts`) — a
 * EXISTÊNCIA desta tarefa é o registro de que aquele rascunho entrou no
 * caminho automático; não há campo espelhando isso no rascunho, que teria
 * que ser mantido em sincronia com ela.
 */
export async function criarTarefaResposta(
  db: AppDb,
  dados: NovaTarefaResposta,
  now: Date,
): Promise<RespostaTarefaDoc> {
  const doc: RespostaTarefaDoc = {
    id: dados.id,
    leadId: dados.leadId,
    nome: dados.nome,
    numero: dados.numero,
    texto: dados.texto,
    estado: "aguardando",
    disponivelEm: new Date(now.getTime() + dados.atrasoSegundos * 1000).toISOString(),
    criadoEm: now.toISOString(),
    claimId: null,
    claimExpiraEm: null,
    dispositivo: "",
    entregueEm: null,
    enviadoEm: null,
    tentativas: 0,
    ultimoErro: null,
  };
  await tarefaRef(db, dados.id).set(comoDoc(doc));
  return doc;
}

/** Todas as tarefas de resposta — a coleção inteira (ver o custo, acima). */
export async function listarTarefasResposta(db: AppDb): Promise<RespostaTarefaDoc[]> {
  const snap = await db.collection(FILA_RESPOSTAS_TAREFAS_COLLECTION).get();
  return snap.docs.map((doc) => asTarefa(doc.data()) as RespostaTarefaDoc);
}

/** A tarefa de um rascunho específico, se ela existe. */
export async function lerTarefaResposta(
  db: AppDb,
  id: string,
): Promise<RespostaTarefaDoc | undefined> {
  const snap = await tarefaRef(db, id).get();
  return snap.exists ? asTarefa(snap.data()) : undefined;
}

/**
 * Reserva UMA tarefa para o aparelho. Transacional pela mesma razão de
 * `reservarLead`: duas chamadas de `/proximo` no mesmo segundo não podem as
 * duas levar a mesma resposta. `null` = já não está disponível (outra
 * chamada ganhou a corrida, ou o atraso ainda corre), nunca erro.
 */
export async function reservarTarefaResposta(
  db: AppDb,
  id: string,
  dispositivo: string,
  now: Date,
): Promise<{ claimId: string; expiraEm: string } | null> {
  return db.runTransaction(async (tx) => {
    const ref = tarefaRef(db, id);
    const atual = asTarefa((await tx.get(ref)).data());
    if (!atual || !tarefaDisponivel(atual, now)) return null;

    const claimId = gerarClaimIdResposta(id);
    const claimExpiraEm = new Date(now.getTime() + RESERVA_DURACAO_MS).toISOString();
    tx.set(
      ref,
      comoDoc({
        ...atual,
        estado: "reservado",
        claimId,
        claimExpiraEm,
        dispositivo,
        entregueEm: now.toISOString(),
      }),
    );
    return { claimId, expiraEm: claimExpiraEm };
  });
}

export interface TarefaRespostaEntregue {
  claimId: string;
  id: string;
  leadId: string;
  nome: string;
  numero: string;
  texto: string;
  expiraEm: string;
}

/**
 * A próxima resposta a sair, já reservada — ou `null`.
 *
 * Ordem: a que está disponível há mais tempo primeiro (`disponivelEm`
 * crescente), desempate por id para a ordem não depender de em que ordem o
 * Firestore devolveu os docs — a mesma regra justa da seleção de leads.
 * Reserva que falha por concorrência não vira erro: cai na próxima.
 */
export async function proximaTarefaResposta(
  db: AppDb,
  dispositivo: string,
  now: Date,
): Promise<TarefaRespostaEntregue | null> {
  const candidatas = (await listarTarefasResposta(db))
    .filter((tarefa) => tarefaDisponivel(tarefa, now))
    .sort(
      (a, b) => a.disponivelEm.localeCompare(b.disponivelEm) || a.id.localeCompare(b.id),
    );

  for (const tarefa of candidatas) {
    const reserva = await reservarTarefaResposta(db, tarefa.id, dispositivo, now);
    if (!reserva) continue;
    return {
      claimId: reserva.claimId,
      id: tarefa.id,
      leadId: tarefa.leadId,
      nome: tarefa.nome,
      numero: tarefa.numero,
      texto: tarefa.texto,
      expiraEm: reserva.expiraEm,
    };
  }
  return null;
}

export interface ConfirmacaoResposta {
  /** O estado em que a tarefa ficou — os mesmos três resultados da fila real. */
  estado: Exclude<RespostaTarefaEstado, "aguardando" | "reservado" | "encerrada">;
  /** A mesma claim já tinha sido confirmada: 200 sem reescrever nada. */
  repetida: boolean;
  tentativas: number;
  /**
   * A resposta saiu do caminho automático e o rascunho voltou para o
   * painel — tentativas esgotadas ou "invalido". NUNCA no caminho de
   * sucesso: ali a tarefa acabou porque cumpriu o que tinha para fazer.
   */
  parado: boolean;
}

/**
 * Confirma uma tarefa de RESPOSTA — o outro lado de `confirmarEnvio`, e
 * deliberadamente muito mais curto que ele.
 *
 * **"enviado" move TRÊS docs, ou nenhum** (uma transação só): a tarefa
 * (`enviado` + `enviadoEm`), o rascunho em `filaRespostas` (`usada` +
 * `textoUsado` com o texto que de fato saiu) e o contador do dia
 * operacional, SÓ na coluna `respostasEnviadas`.
 *
 * O que ele NÃO faz é a parte importante: não move o status do lead (o lead
 * já está em "respondeu" desde que a mensagem dele chegou), não grava selo
 * de contato, não gira a rotação de frases (a resposta não sai de frase
 * nenhuma) e não encosta em `enviados`/`envios`/`ultimoEventoEm` — a meta
 * diária, o teto por hora e o intervalo mínimo são portões da PROSPECÇÃO.
 *
 * - **"falhou"**: tentativa gasta e a tarefa volta à fila. Esgotadas as
 *   `RESPOSTA_TENTATIVAS_MAX`, ela sai do caminho automático e o rascunho
 *   reaparece no painel — a máquina desistiu, a decisão volta ao humano.
 * - **"invalido"**: a tarefa encerra e o rascunho volta ao painel, mas o
 *   lead **não** ganha `telefoneInvalido`. Aquele número acabou de mandar
 *   mensagem; tirar o lead da fila de prospecção para sempre por causa de
 *   uma conversa que a macro não conseguiu abrir seria dano permanente a
 *   partir de um sinal fraco.
 *
 * `null` = a claim não é a atual (ou a tarefa sumiu), e a rota responde 409
 * como no caminho real. Confirmação repetida da MESMA claim devolve sucesso
 * sem reescrever nada — inclusive sem tocar o contador.
 *
 * **Todas as leituras antes de todas as escritas**, como em `confirmarEnvio`:
 * o Firestore real recusa `get` depois de `set` e o fake deixaria passar.
 */
export async function confirmarTarefaResposta(
  db: AppDb,
  claimId: string,
  resultado: FilaEnvioResultado,
  detalhe: string | null,
  now: Date,
  inicioDiaOperacionalHora: number,
): Promise<ConfirmacaoResposta | null> {
  const id = idDaClaimDeResposta(claimId);
  if (!id) return null;

  return db.runTransaction(async (tx) => {
    // ── Leituras ────────────────────────────────────────────────────────
    const ref = tarefaRef(db, id);
    const atual = asTarefa((await tx.get(ref)).data());
    if (!atual || atual.claimId !== claimId) return null;

    if (atual.estado !== "reservado") {
      // Repetição da MESMA claim já confirmada: sucesso sem reescrever nada.
      // A rede pode cair DEPOIS de a resposta ter saído, e aí o aparelho
      // reenvia o confirmar; repetir não pode contar duas vezes.
      return {
        estado: (atual.estado === "aguardando" || atual.estado === "encerrada"
          ? "falhou"
          : atual.estado) as ConfirmacaoResposta["estado"],
        repetida: true,
        tentativas: atual.tentativas,
        parado: atual.estado !== "enviado" && !tarefaAutomaticaViva(atual),
      };
    }

    const refRascunho = db.collection(FILA_RESPOSTAS_COLLECTION).doc(id);
    const rascunho =
      resultado === "enviado"
        ? ((await tx.get(refRascunho)).data() as unknown as FilaRespostaDoc | undefined)
        : undefined;

    const refContador = db
      .collection(FILA_CONTADORES_COLLECTION)
      .doc(diaOperacionalKey(now, inicioDiaOperacionalHora));
    const contador = resultado === "enviado" ? (await tx.get(refContador)).data() : undefined;

    // ── Escritas ────────────────────────────────────────────────────────
    const tentativas = resultado === "falhou" ? atual.tentativas + 1 : atual.tentativas;
    const proxima: RespostaTarefaDoc = {
      ...atual,
      estado: resultado,
      tentativas,
      // A claim morre junto com a confirmação: a tarefa que volta à fila é
      // reservada de novo, com claimId novo. Guardar o `claimExpiraEm` velho
      // faria `tarefaNoAparelho` mentir por cinco minutos.
      claimExpiraEm: null,
      ultimoErro: resultado === "enviado" ? null : detalhe,
      enviadoEm: resultado === "enviado" ? now.toISOString() : atual.enviadoEm,
    };
    tx.set(ref, comoDoc(proxima));

    if (resultado === "enviado" && rascunho) {
      // `textoUsado` é o texto que de fato saiu — aqui, o rascunho
      // congelado na tarefa, porque ninguém editou nada no caminho
      // automático. Merge: fechar a pendência não encosta nas mensagens do
      // lead nem no rascunho original.
      tx.set(
        refRascunho,
        { estado: "usada", textoUsado: atual.texto, resolvidoEm: now.toISOString() },
        { merge: true },
      );
    }

    if (resultado === "enviado") {
      tx.set(refContador, contadorComResposta(contador) as unknown as Record<string, unknown>);
    }

    return {
      estado: resultado,
      repetida: false,
      tentativas,
      parado: resultado !== "enviado" && !tarefaAutomaticaViva(proxima),
    };
  });
}

/**
 * O operador fechou o rascunho pelo painel (usou ou descartou) enquanto a
 * resposta ainda estava na fila automática: a tarefa ENCERRA, e o aparelho
 * nunca a recebe.
 *
 * Transacional e com uma recusa: tarefa JÁ NA MÃO DO APARELHO
 * (`tarefaNoAparelho`) não pode ser encerrada — devolve `false` e quem chama
 * vira 409. Sem isso, o operador marcando "usada" no mesmo segundo em que o
 * celular puxa a tarefa produziria a mensagem duplicada que esta fila
 * inteira existe para evitar. Tarefa inexistente é sucesso: o rascunho
 * simplesmente nunca foi automático.
 */
export async function encerrarTarefaResposta(
  db: AppDb,
  id: string,
  now: Date,
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const ref = tarefaRef(db, id);
    const atual = asTarefa((await tx.get(ref)).data());
    if (!atual) return true;
    if (tarefaNoAparelho(atual, now)) return false;
    if (!tarefaAutomaticaViva(atual)) return true;

    tx.set(ref, comoDoc({ ...atual, estado: "encerrada", claimExpiraEm: null }));
    return true;
  });
}
