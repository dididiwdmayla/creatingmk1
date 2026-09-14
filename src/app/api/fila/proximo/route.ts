import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/firebase/admin";
import { autenticarDispositivo } from "@/lib/fila/auth";
import { candidatoEstavel, lerPool } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import { lerContadorFila } from "@/lib/fila/contadores";
import {
  TENTATIVAS_MAX,
  anotarRotacao,
  liberarClaim,
  reservarLead,
} from "@/lib/fila/envios";
import { montarMensagemParaLead } from "@/lib/fila/mensagem";
import { printUrlDoLead } from "@/lib/fila/print";
import { motivoDeRitmo, ordenarCandidatos, type MotivoSemTarefa } from "@/lib/fila/selecao";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";
import { handleRouteError } from "@/lib/http";

/**
 * `GET /api/fila/proximo` — UMA tarefa, ou o motivo de não ter nenhuma.
 *
 * O celular é um executor burro: pergunta, envia, reporta. Toda decisão
 * (pausa, cota, ritmo, horário, reserva) mora aqui. A rota é chamada de
 * minuto em minuto a noite toda, então a ordem dos portões é a ordem do
 * CUSTO: pausa e ritmo custam 2 leituras de doc e barram a esmagadora
 * maioria das chamadas; só quem passa delas paga a leitura do pool de
 * candidatos (ver `lib/fila/candidatos.ts` para por que existe um pool).
 *
 * A reserva acontece DENTRO desta chamada e ANTES de montar a mensagem: a
 * claim trava o lead primeiro, para que nenhum trabalho seja feito sobre um
 * lead que outro ciclo já levou. Reserva que falha por concorrência não vira
 * erro — cai no próximo candidato.
 */

/** Cabeçalho com que o aparelho se identifica; ausente = o único que existe hoje. */
const HEADER_DISPOSITIVO = "x-radar-device";
const DISPOSITIVO_PADRAO = "android";

export interface TarefaFila {
  /** O claimId — é com ele que o celular confirma depois. */
  id: string;
  leadId: string;
  nome: string;
  /** Dígitos puros com DDI, pronto para o WhatsApp. */
  numero: string;
  texto: string;
  printUrl: string;
  expiraEm: string;
}

function semTarefa(motivo: MotivoSemTarefa): NextResponse {
  return NextResponse.json({ tarefa: null, motivo });
}

/**
 * Tenta entregar UM candidato. Devolve `undefined` quando ele não serve mais
 * (e aí quem chama passa para o próximo), sem nunca virar erro.
 *
 * A RELEITURA do doc do lead é o que torna o pool seguro: ele pode ter até
 * dez minutos, então tudo que ele congelou é reconferido aqui contra dado
 * fresco antes de a tarefa sair. Pool velho pode oferecer um lead que não
 * serve mais; nunca entregá-lo.
 */
async function tentarEntregar(
  db: AppDb,
  leadId: string,
  dispositivo: string,
  now: Date,
): Promise<TarefaFila | undefined> {
  const reserva = await reservarLead(db, leadId, dispositivo, now, {
    tentativasMax: TENTATIVAS_MAX,
  });
  // Reserva viva de outro ciclo, ou estado terminal que o pool não viu.
  if (!reserva) return undefined;

  const lead = await getLead(db, leadId);
  // `candidatoEstavel` com `undefined` no envio: o estado da fila já foi
  // decidido pela reserva acima (que é transacional); aqui o que se reconfere
  // é o LEAD — status, telefone, demo, capturas, descarte, número inválido.
  const printUrl = lead && candidatoEstavel(lead, undefined) ? printUrlDoLead(lead.capturas) : undefined;
  if (!lead || !printUrl) {
    await liberarClaim(db, leadId, reserva.claimId);
    return undefined;
  }

  const mensagem = await montarMensagemParaLead(db, lead);
  if (!mensagem.telefone) {
    await liberarClaim(db, leadId, reserva.claimId);
    return undefined;
  }

  // A frase que o lead vai receber fica gravada na claim: entre entregar a
  // tarefa e o celular confirmar, a rotação compartilhada pode ter girado por
  // um envio manual de alguém do time.
  await anotarRotacao(db, leadId, reserva.claimId, mensagem.rotacaoSkinId);

  return {
    id: reserva.claimId,
    leadId,
    nome: lead.nome,
    numero: mensagem.telefone,
    texto: mensagem.texto,
    printUrl,
    expiraEm: reserva.expiraEm,
  };
}

export async function GET(req: Request) {
  const barrado = autenticarDispositivo(req);
  if (barrado) return barrado;

  try {
    const db = getDb();
    const now = new Date();
    const dispositivo = req.headers.get(HEADER_DISPOSITIVO)?.trim() || DISPOSITIVO_PADRAO;

    const config = await loadFilaConfig(db);
    const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
    const ritmo = motivoDeRitmo(config, contador);
    if (ritmo) return semTarefa(ritmo);

    const [app, pool] = await Promise.all([loadConfig(db), lerPool(db, now)]);
    const { elegiveis, foraDeJanela } = ordenarCandidatos(
      pool.candidatos,
      config,
      app.janelasContato,
      now,
    );

    for (const candidato of elegiveis) {
      const tarefa = await tentarEntregar(db, candidato.id, dispositivo, now);
      if (tarefa) return NextResponse.json({ tarefa });
    }

    // Distinção deliberada: "fora_de_janela" é todo mundo dormindo — volte
    // mais tarde e vai sair. "sem_leads_elegiveis" é não existir lead pronto
    // (ou os que existiam estarem todos reservados) — nenhuma espera resolve,
    // alguém precisa gerar demo e capturas. Colapsar os dois apagaria a
    // única informação que diz qual providência tomar.
    return semTarefa(
      elegiveis.length === 0 && foraDeJanela > 0 ? "fora_de_janela" : "sem_leads_elegiveis",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
