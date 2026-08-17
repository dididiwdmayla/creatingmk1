import { dispararCapturas } from "@/lib/github/dispatch";
import type { AppDb } from "@/lib/firestore-like";

import { parseAlvo } from "./alvo.mjs";
import { emAndamento, type LeadCapturas } from "./estado";

/**
 * Enfileira a geração de capturas de um ou mais ALVOS: marca o estado no
 * doc de cada um e dispara o workflow no GitHub Actions.
 *
 * Um alvo é uma demo de lead (id cru) ou uma demo avulsa (`avulsa:<id>`) —
 * ver ./alvo.mjs. As duas guardam o estado no MESMO campo `capturas`, com
 * o mesmo contrato, então tudo aqui é igual menos a coleção do doc.
 *
 * A ordem importa. Marcar ANTES de disparar é o que faz o pedido existir
 * mesmo que o operador feche a aba no mesmo segundo — e é o que dá ao
 * workflow o `execucaoId` que ele vai carregar de volta. Se o disparo
 * falhar, o estado é desfeito para `falhou` com o motivo: um alvo
 * "enfileirado" para um workflow que nunca foi chamado é exatamente o
 * estado que mente.
 */

export interface ResultadoEnfileiramento {
  execucaoId: string;
  /** Alvos que entraram na fila (no mesmo formato em que chegaram). */
  enfileirados: string[];
  /** Alvos ignorados — sem demo salva, inexistentes, ou já gerando. */
  pulados: Array<{ placeId: string; motivo: string }>;
}

/** O que o enfileiramento precisa saber de um doc, seja de qual coleção for. */
interface DocComDemo {
  demo?: { skinId?: string };
  capturas?: LeadCapturas;
}

/** Registro sem demo não tem o que capturar — a rota pública responde 404. */
function podeCapturar(doc: DocComDemo | undefined): boolean {
  return Boolean(doc?.demo?.skinId);
}

async function lerAlvo(db: AppDb, alvo: string): Promise<DocComDemo | undefined> {
  const parsed = parseAlvo(alvo);
  if (!parsed) return undefined;
  const snap = await db.collection(parsed.colecao).doc(parsed.id).get();
  return snap.exists ? (snap.data() as unknown as DocComDemo) : undefined;
}

async function gravarEstado(
  db: AppDb,
  alvo: string,
  capturas: LeadCapturas,
  atualizadoEm: string,
): Promise<void> {
  const parsed = parseAlvo(alvo);
  if (!parsed) return;
  await db.collection(parsed.colecao).doc(parsed.id).set({ capturas, atualizadoEm }, { merge: true });
}

/**
 * Já existe uma geração em andamento para este alvo? Usado para não
 * empilhar runs por clique repetido — "refazer" durante um run em
 * andamento é uma decisão explícita do operador (`forcar`), não um efeito
 * colateral de dois cliques.
 */
export function jaEstaGerando(capturas: LeadCapturas | undefined): boolean {
  return emAndamento(capturas?.estado);
}

export async function enfileirarCapturas(
  db: AppDb,
  alvos: string[],
  opcoes: {
    userId?: string;
    /** Ignora um andamento em curso (o botão "Refazer"). */
    forcar?: boolean;
    agora?: () => string;
    novoId?: () => string;
  } = {},
): Promise<ResultadoEnfileiramento> {
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());
  const execucaoId = novoId();
  const pedidoEm = agora();

  const enfileirados: string[] = [];
  const pulados: ResultadoEnfileiramento["pulados"] = [];

  for (const alvo of alvos) {
    if (!parseAlvo(alvo)) {
      pulados.push({ placeId: alvo, motivo: "id inválido" });
      continue;
    }
    const doc = await lerAlvo(db, alvo);
    if (!doc) {
      pulados.push({ placeId: alvo, motivo: "não encontrado" });
      continue;
    }
    if (!podeCapturar(doc)) {
      pulados.push({ placeId: alvo, motivo: "sem demo salva" });
      continue;
    }
    if (!opcoes.forcar && jaEstaGerando(doc.capturas)) {
      pulados.push({ placeId: alvo, motivo: "já está gerando" });
      continue;
    }

    const capturas: LeadCapturas = {
      estado: "enfileirado",
      execucaoId,
      pedidoEm,
      ...(opcoes.userId ? { pedidoPor: opcoes.userId } : {}),
      // As imagens da rodada anterior somem junto com o pedido novo: o
      // workflow apaga o prefixo no Storage antes de subir as novas, então
      // manter as URLs velhas aqui deixaria a tela exibindo imagem que já
      // não existe.
    };
    await gravarEstado(db, alvo, capturas, pedidoEm);
    enfileirados.push(alvo);
  }

  if (enfileirados.length === 0) {
    return { execucaoId, enfileirados, pulados };
  }

  try {
    await dispararCapturas({ leads: enfileirados, execucao: execucaoId });
  } catch (erro) {
    // Desfaz: sem isto os alvos ficariam "enfileirado" esperando um
    // workflow que ninguém chamou, até o limite de silêncio expirar.
    const motivo = erro instanceof Error ? erro.message : "falha ao disparar a geração";
    for (const alvo of enfileirados) {
      await gravarEstado(
        db,
        alvo,
        { estado: "falhou", execucaoId, pedidoEm, erro: motivo, geradoEm: agora() },
        agora(),
      );
    }
    throw erro;
  }

  return { execucaoId, enfileirados, pulados };
}

/**
 * Estado das capturas de vários alvos — a resposta do polling da ficha, do
 * lote e de /demos. Devolve só o campo `capturas`, que é o que muda
 * enquanto a geração roda; carregar o doc inteiro a cada poucos segundos
 * seria pagar caro por um dado que não mudou. A chave da resposta é o alvo
 * COMO VEIO (com o prefixo, quando houver), pra quem pediu conseguir casar
 * a resposta sem reconstruir o formato.
 */
export async function estadoDasCapturas(
  db: AppDb,
  alvos: string[],
): Promise<Record<string, LeadCapturas | null>> {
  const saida: Record<string, LeadCapturas | null> = {};
  for (const alvo of alvos) {
    saida[alvo] = (await lerAlvo(db, alvo))?.capturas ?? null;
  }
  return saida;
}
