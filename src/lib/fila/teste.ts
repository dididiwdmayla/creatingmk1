import { randomBytes } from "node:crypto";

import type { AppDb } from "@/lib/firestore-like";

import { RESERVA_DURACAO_MS } from "./envios";

/**
 * A TAREFA DE TESTE — um disparo que o operador injeta na tela e que o
 * aparelho recebe na PRÓXIMA volta do ciclo normal, no lugar da tarefa real.
 *
 * **Por dentro de `/proximo`, nunca por rota nova.** O aparelho não muda:
 * cada alteração na macro custa reconfiguração manual no celular. Ela
 * continua perguntando a mesma coisa no mesmo lugar, com o mesmo contrato
 * achatado; só recebe, naquela volta, a tarefa de teste.
 *
 * **Coleção separada, e por que NÃO em `filaEnvios/{leadId}`.** Aquele doc é
 * por leadId e carrega o estado REAL do lead: claimId, tentativas,
 * `enviadoEm`, `detalheEnvio`. Dez testes no mesmo lead destruiriam o
 * histórico dele — o contrário do que este recurso promete. Aqui o id é da
 * CLAIM, não do lead, e o lead nunca é tocado.
 *
 * **Por que doc próprio e não dentro de `config/fila`.** Dentro sairia de
 * graça (`/proximo` já lê aquele doc toda chamada) — mas `saveFilaConfig`
 * grava o documento INTEIRO com `set`, então o admin ajustando a meta
 * destruiria uma tarefa pendente ao lado, e consumir a tarefa faria o
 * caminho do APARELHO escrever no doc que só o admin escreve. Seria
 * exatamente a corrida que a regra "alteração de configuração nunca invalida
 * claim já emitida" existe para não ter. O preço é +1 leitura por chamada
 * (~480/dia, trivial), e ele some quando há teste pendente: a entrega
 * acontece ANTES do portão de ritmo e pula a leitura do contador.
 *
 * **UM doc, três estados.** `pendente` → `entregue` → `confirmado`. Injetar
 * de novo sobrescreve: um aparelho, uma tarefa de teste por vez.
 */
export const FILA_TESTES_COLLECTION = "filaTestes";
export const FILA_TESTE_DOC = "atual";

/**
 * Quanto tempo a tarefa fica esperando o aparelho puxar. Sem prazo o
 * operador clica às 18h, se distrai, e às 2h da manhã a macro puxa e
 * dispara. Expirada, ela some sozinha — mesma regra da claim expirada da
 * fila real (`expiraEm` no passado = não existe), sem job de limpeza.
 */
export const TESTE_VALIDADE_MS = 15 * 60 * 1000;

/**
 * Prefixo do claimId de teste — o DESVIO DE CUSTO ZERO de `/confirmar`.
 *
 * A rota precisa saber que a claim é de teste ANTES de abrir a transação que
 * toca lead, contador e rotação, e essa checagem não pode ficar depois de
 * nenhuma escrita. Um prefixo resolve isso sem leitura nenhuma.
 *
 * Não colide com um claimId real: aqueles são `randomBytes(9)` em base64url,
 * SEMPRE 12 caracteres, e este tem 6 + 12 = 18. Mesmo que o alfabeto
 * base64url inclua `-`, o comprimento sozinho já separa os dois espaços.
 */
export const CLAIM_TESTE_PREFIXO = "teste-";

export type TesteEstado = "pendente" | "entregue" | "confirmado";

/** O que o aparelho reporta — os mesmos três resultados da fila real. */
export type TesteResultado = "enviado" | "invalido" | "falhou";

/**
 * O doc `filaTestes/atual`. Tudo que a tarefa precisa é congelado na
 * INJEÇÃO — nome, texto e print —, e não relido na entrega: assim `/proximo`
 * não paga leitura de lead nem as três coleções de `montarMensagemParaLead`
 * para servir um teste, e a tarefa não muda de conteúdo entre o clique e a
 * puxada.
 */
export interface FilaTesteDoc {
  /** `teste-XXXXXXXXXXXX` — cunhado na injeção, não na entrega. */
  claimId: string;
  estado: TesteEstado;
  /** O lead ALVO. Ele nunca é escrito por este caminho; está aqui para a tela e para o rastro. */
  leadId: string;
  nome: string;
  /** Destino real do disparo: `config/fila.numeroTeste`, nunca o telefone do lead. */
  numero: string;
  texto: string;
  printUrl: string;
  criadoEm: string;
  /** `criadoEm + TESTE_VALIDADE_MS`. Só significa alguma coisa enquanto `pendente`. */
  expiraEm: string;
  /** Admin que injetou. */
  criadoPor: string;
  /** Quais etapas o operador mandou pular — o rastro do diagnóstico. */
  pulou: EtapaTeste[];
  entregueEm: string | null;
  confirmadoEm: string | null;
  resultado: TesteResultado | null;
  /** Texto livre que o aparelho mandou junto do resultado. */
  detalhe: string;
}

/**
 * As quatro etapas da seleção, na ORDEM REAL de avaliação — a mesma de
 * `/proximo` e do funil da visão (ritmo → estrutural → nicho → janela).
 */
export const ETAPAS_TESTE = ["ritmo", "estruturais", "nicho", "janela"] as const;
export type EtapaTeste = (typeof ETAPAS_TESTE)[number];

export function ehClaimDeTeste(claimId: string): boolean {
  return claimId.startsWith(CLAIM_TESTE_PREFIXO);
}

function gerarClaimIdTeste(): string {
  return CLAIM_TESTE_PREFIXO + randomBytes(9).toString("base64url");
}

function testeRef(db: AppDb) {
  return db.collection(FILA_TESTES_COLLECTION).doc(FILA_TESTE_DOC);
}

async function lerDoc(db: AppDb): Promise<FilaTesteDoc | undefined> {
  const snap = await testeRef(db).get();
  return snap.exists ? (snap.data() as unknown as FilaTesteDoc) : undefined;
}

/** A tarefa pendente EXPIROU sem o aparelho puxar? */
export function testeExpirado(doc: FilaTesteDoc, now: Date): boolean {
  return new Date(doc.expiraEm).getTime() <= now.getTime();
}

/**
 * A tarefa de teste esperando ser puxada, ou `undefined`. Expirada conta
 * como inexistente e NÃO é apagada: nada depende disso, e o doc vira o
 * rastro de que houve um teste que o aparelho nunca buscou (a tela mostra
 * isso). Sobrescrever é trabalho da próxima injeção.
 */
export async function lerTestePendente(
  db: AppDb,
  now: Date,
): Promise<FilaTesteDoc | undefined> {
  const doc = await lerDoc(db);
  if (!doc || doc.estado !== "pendente" || testeExpirado(doc, now)) return undefined;
  return doc;
}

/** O estado atual do disparo de teste, seja qual for — é o que a tela desenha. */
export async function lerTesteAtual(db: AppDb): Promise<FilaTesteDoc | undefined> {
  return lerDoc(db);
}

export interface InjecaoTeste {
  leadId: string;
  nome: string;
  numero: string;
  texto: string;
  printUrl: string;
  criadoPor: string;
  pulou: EtapaTeste[];
}

/**
 * Grava a tarefa. Sobrescreve o que houver — inclusive uma pendente que
 * ninguém puxou, ou uma entregue que ninguém confirmou: há UM aparelho, e
 * duas tarefas de teste vivas ao mesmo tempo não significariam nada.
 */
export async function injetarTeste(
  db: AppDb,
  dados: InjecaoTeste,
  now: Date,
): Promise<FilaTesteDoc> {
  const doc: FilaTesteDoc = {
    claimId: gerarClaimIdTeste(),
    estado: "pendente",
    leadId: dados.leadId,
    nome: dados.nome,
    numero: dados.numero,
    texto: dados.texto,
    printUrl: dados.printUrl,
    criadoEm: now.toISOString(),
    expiraEm: new Date(now.getTime() + TESTE_VALIDADE_MS).toISOString(),
    criadoPor: dados.criadoPor,
    pulou: dados.pulou,
    entregueEm: null,
    confirmadoEm: null,
    resultado: null,
    detalhe: "",
  };
  await testeRef(db).set(doc as unknown as Record<string, unknown>);
  return doc;
}

/**
 * ONE-SHOT: marca a tarefa como entregue e devolve o `expiraEm` que vai na
 * resposta ao aparelho.
 *
 * Transação porque a garantia é "entregue UMA vez": duas chamadas de
 * `/proximo` no mesmo segundo (a macro repetindo o pedido, um retry de rede)
 * não podem as duas levar a mesma tarefa — seria a mensagem duplicada que a
 * fila inteira existe para evitar. Devolve `null` quando outra chamada
 * chegou primeiro, e aí `/proximo` segue para a fila normal.
 *
 * O `expiraEm` da resposta é `entregue + RESERVA_DURACAO_MS`, a MESMA janela
 * de uma claim real: a chave significa a mesma coisa nos dois caminhos. O
 * `expiraEm` do doc continua sendo o prazo de PUXADA, que a partir daqui já
 * não vale para nada.
 */
export async function marcarTesteEntregue(
  db: AppDb,
  claimId: string,
  now: Date,
): Promise<{ expiraEm: string } | null> {
  return db.runTransaction(async (tx) => {
    const ref = testeRef(db);
    const atual = (await tx.get(ref)).data() as unknown as FilaTesteDoc | undefined;
    if (!atual || atual.claimId !== claimId || atual.estado !== "pendente") return null;
    if (testeExpirado(atual, now)) return null;

    tx.set(ref, { ...atual, estado: "entregue", entregueEm: now.toISOString() } as unknown as Record<
      string,
      unknown
    >);
    return { expiraEm: new Date(now.getTime() + RESERVA_DURACAO_MS).toISOString() };
  });
}

export interface ConfirmacaoTeste {
  estado: TesteEstado;
  resultado: TesteResultado;
  /** A mesma claim já tinha sido confirmada: 200 sem reescrever nada. */
  repetida: boolean;
}

/**
 * Registra o resultado de uma claim de teste. **Nenhum efeito colateral**: o
 * lead não muda de status, o contador do dia não anda, a rotação de frases
 * não gira, nenhum selo de contato é gravado e `filaEnvios` não é tocada.
 * O mesmo lead pode ser testado dez vezes sem consequência.
 *
 * Transação de um doc só, pela mesma razão de `confirmarClaim`: confirmação
 * repetida (a rede cai DEPOIS de a mensagem sair, e o aparelho reenvia) tem
 * que devolver sucesso sem regravar. `null` = a claim não é a atual, e a
 * rota responde 409 como no caminho real.
 */
export async function confirmarTeste(
  db: AppDb,
  claimId: string,
  resultado: TesteResultado,
  detalhe: string | null,
  now: Date,
): Promise<ConfirmacaoTeste | null> {
  return db.runTransaction(async (tx) => {
    const ref = testeRef(db);
    const atual = (await tx.get(ref)).data() as unknown as FilaTesteDoc | undefined;
    if (!atual || atual.claimId !== claimId) return null;

    if (atual.estado === "confirmado") {
      return {
        estado: atual.estado,
        resultado: atual.resultado ?? resultado,
        repetida: true,
      };
    }

    tx.set(ref, {
      ...atual,
      estado: "confirmado",
      resultado,
      detalhe: detalhe ?? "",
      confirmadoEm: now.toISOString(),
    } as unknown as Record<string, unknown>);
    return { estado: "confirmado" as const, resultado, repetida: false };
  });
}
