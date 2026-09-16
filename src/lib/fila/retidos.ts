import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import {
  EPOCH_ISO,
  FILA_ENVIOS_COLLECTION,
  retencaoVenceEm,
  retidoPorEnvio,
  type FilaEnvioDoc,
} from "./envios";
import type { LinhaRetido } from "./estado";

/**
 * OS LEADS RETIDOS — a vitrine da retenção por claim não confirmada.
 *
 * A retenção (ver o bloco em `estado.ts`) tira o lead da fila sem que nada
 * no lead mude: o doc continua `status: "novo"`, com demo, com print, elegível
 * a olho nu. Sem esta lista ele pararia EM SILÊNCIO — e um estado que some
 * sem explicação é um estado que mente, a mesma razão de `filaParado`
 * aparecer na ficha e de `detalheEnvio` ter lista própria no painel.
 *
 * **Por que aqui e não em `/api/fila/diagnostico`.** Aquela rota é
 * declaradamente sem varredura (`lerPoolBruto`, um doc), e o retido não está
 * no pool — está exatamente fora dele. Achar os retidos exige varrer
 * `filaEnvios`, que é o custo que o diagnóstico existe para não pagar.
 *
 * **Uma varredura, uma verdade.** A contagem do funil e as linhas da lista
 * saem da MESMA chamada, e por isso não têm como discordar: duas fontes para
 * o mesmo número (uma congelada no pool, outra fresca) divergiriam em
 * silêncio justamente na tela que existe para não deixar nada em silêncio.
 *
 * **Sobre o custo de leitura:** o `AppDb` não tem query (ver
 * firestore-like.ts), então listar é varredura da coleção inteira. Está tudo
 * bem AQUI, e pelo mesmo motivo de `pendencias.ts`: /config é página de
 * admin aberta esporadicamente por uma pessoa — não é `/api/fila/proximo`,
 * que o celular bate 1440× por dia e por isso ganhou o pool. A varredura NÃO
 * lê `/leads` inteira atrás de nomes: filtra primeiro e só então lê, POR ID,
 * os poucos docs que sobraram.
 *
 * **Sem teto na lista**, diferente das listas da visão da fila: o número de
 * retidos é limitado pela própria fila (`metaDiaria` reservas por dia, uma
 * claim por reserva), então a lista é de punhados, não de milhares. Um teto
 * aqui esconderia justamente o lead que o operador quer liberar.
 */

export type { LinhaRetido } from "./estado";

function envioRef(db: AppDb, leadId: string) {
  return db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
}

/** O que a lista e a contagem do funil devolvem juntas — ver o cabeçalho. */
export interface RetidosFila {
  /**
   * Quantos leads estão retidos AGORA. É o número do funil, e é sempre
   * `linhas.length` — a lista não tem teto de propósito.
   */
  total: number;
  linhas: LinhaRetido[];
}

/**
 * Os leads retidos agora, do mais RECENTE para o mais antigo: a reserva mais
 * nova é a que o operador tem chance de conferir no WhatsApp (a conversa
 * ainda está no topo da lista dele), e é sobre ela que a decisão de liberar é
 * mais provável.
 *
 * `retencaoMs <= 0` (retenção desligada) devolve lista vazia sem varrer nada:
 * não há retenção nenhuma para mostrar.
 */
export async function listarRetidos(
  db: AppDb,
  now: Date,
  retencaoMs: number,
): Promise<RetidosFila> {
  if (retencaoMs <= 0) return { total: 0, linhas: [] };

  const snap = await db.collection(FILA_ENVIOS_COLLECTION).get();
  const retidos = snap.docs
    .map((d) => ({ leadId: d.id, doc: d.data() as unknown as FilaEnvioDoc }))
    .filter(({ doc }) => retidoPorEnvio(doc, now, retencaoMs));

  // Só agora, e só destes: um por id, nunca uma varredura de /leads.
  const linhas = await Promise.all(
    retidos.map(async ({ leadId, doc }): Promise<LinhaRetido> => {
      const lead = await getLead(db, leadId);
      return {
        leadId,
        // Lead excluído não apaga a retenção — some o nome, fica o id. Mesma
        // regra da pendência de print: retenção que desaparece sozinha é
        // estado que mente.
        nome: lead?.nome ?? "",
        reservadoEm: doc.reservadoEm,
        // `retidoPorEnvio` acima já garantiu que não é undefined.
        venceEm: retencaoVenceEm(doc, now, retencaoMs) as string,
        dispositivo: doc.dispositivo,
      };
    }),
  );

  linhas.sort(
    // Desempate por leadId: a ordem não pode depender de em que ordem o
    // Firestore devolveu os docs (mesma regra da seleção da fila).
    (a, b) => b.reservadoEm.localeCompare(a.reservadoEm) || a.leadId.localeCompare(b.leadId),
  );
  return { total: linhas.length, linhas };
}

/** Por que a liberação foi recusada — estruturado, para a linha poder DIZER. */
export type RecusaLiberacao = "claim_ativa";

export type LiberacaoRetido =
  | { ok: true }
  | {
      ok: false;
      motivo: RecusaLiberacao;
      /** Instante em que a claim viva morre sozinha — a tela mostra a hora. */
      expiraEm: string;
    };

/**
 * LIBERAÇÃO MANUAL: o operador conferiu que o envio realmente não saiu e
 * devolve o lead à fila antes de a janela vencer.
 *
 * É a semântica de `liberarClaim` — `expiraEm` no passado (`EPOCH_ISO`) —, e
 * não um campo novo nem um estado novo: a invariante `expiraEm <= reservadoEm`
 * JÁ significa "claim devolvida de propósito, nada saiu", que é exatamente o
 * que o operador está afirmando. Reusar a distinção que a retenção já lê é o
 * que garante que liberar de fato libera (e não cria um segundo conceito de
 * "livre" capaz de divergir do primeiro).
 *
 * **`reservadoEm` fica INTACTO**: é o rastro de que houve um envio provável
 * ali, e o que a ficha e o `registrosEnvio` do lead ainda podem precisar. O
 * que muda é só a disponibilidade.
 *
 * **NUNCA atropela claim ativa.** Claim não expirada quer dizer que o
 * aparelho pode estar com a tela aberta no WhatsApp NESTE segundo: liberar
 * ali produziria a segunda reserva do mesmo lead e a mensagem duplicada que
 * a retenção inteira existe para evitar. A recusa é estruturada (não um
 * booleano) porque a tela precisa dizer o motivo e a hora — recusa muda sem
 * explicação é o que faz o operador clicar de novo.
 *
 * Transação porque a decisão é sobre o estado da claim e não pode ser tomada
 * sobre um doc lido antes: entre o `get` e o `set`, `/proximo` pode ter
 * re-reservado o lead (retenção vencida no intervalo) — e aí a claim que a
 * transação vê é a NOVA, viva, e a liberação é corretamente recusada.
 *
 * Lead que não está retido é 404, e o doc ausente não é criado: um leadId
 * errado não pode plantar lixo em `filaEnvios` (mesma regra de
 * `marcarPendenciaResolvida`).
 */
export async function liberarRetido(
  db: AppDb,
  leadId: string,
  now: Date,
  retencaoMs: number,
): Promise<LiberacaoRetido> {
  return db.runTransaction(async (tx) => {
    const ref = envioRef(db, leadId);
    const atual = (await tx.get(ref)).data() as unknown as FilaEnvioDoc | undefined;

    if (atual?.estado === "reservado" && new Date(atual.expiraEm).getTime() > now.getTime()) {
      return { ok: false as const, motivo: "claim_ativa" as const, expiraEm: atual.expiraEm };
    }
    if (!atual || !retidoPorEnvio(atual, now, retencaoMs)) {
      throw new NotFoundError(`Lead "${leadId}" não está retido por envio não confirmado.`);
    }

    tx.set(ref, { ...atual, expiraEm: EPOCH_ISO } as unknown as Record<string, unknown>);
    return { ok: true as const };
  });
}
