import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { loadFilaConfig } from "@/lib/fila/config";
import { lerContadorFila } from "@/lib/fila/contadores";
import { LEAD_TESTE_ID, garantirLeadDeTeste } from "@/lib/fila/leadTeste";
import { montarMensagemParaLead } from "@/lib/fila/mensagem";
import { printUrlDoLead } from "@/lib/fila/print";
import { TESTE_VALIDADE_MS, injetarTeste, lerTesteAtual } from "@/lib/fila/teste";
import { avaliarTeste, etapasValidas } from "@/lib/fila/testeEtapas";
import { getLead } from "@/lib/leads/repo";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * O DISPARO DE TESTE — `GET` mostra o estado, `POST` injeta a tarefa que o
 * aparelho vai puxar na próxima volta de `/proximo`.
 *
 * **Admin, como todo o painel "Fila de envio".** Não é sigilo de dado: esta
 * rota faz o celular do admin acordar a tela e mandar mensagem. É comando
 * sobre hardware alheio, igual à pausa e à meta. Vive sob `/api/fila/*`, o
 * prefixo que `src/proxy.ts` isenta da sessão (porque é lá que o aparelho
 * bate com a `RADAR_DEVICE_KEY`), então faz a própria checagem completa de
 * sessão + papel — exatamente como `/api/fila/diagnostico`. A
 * `RADAR_DEVICE_KEY` **não abre esta rota**: aquele segredo é do aparelho e
 * só serve às rotas de execução.
 *
 * **Rota própria, e não mais um campo em `/api/fila/diagnostico`.** Aquela
 * rota é o FUNIL, e as listas dela saem todas da mesma chamada de
 * `ordenarCandidatos` de propósito. O disparo de teste tem outro ciclo de
 * vida (recarrega depois de injetar, não junto da config) e é escrita, não
 * leitura — misturar os dois faria o funil recalcular a cada clique no botão.
 */

/** Teto do corpo: o operador escolhe um lead, não manda uma lista. */
const LEAD_ID_MAX = 256;

/** Estado do disparo de teste, para a tela desenhar sem uma segunda chamada. */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const config = await loadFilaConfig(db);
    // Criar aqui é o que torna o alvo padrão real sem seed nem migração:
    // abrir o painel basta. Não sobrescreve nada — a captura que o operador
    // gerou à mão sobrevive (ver `garantirLeadDeTeste`).
    const leadDeTeste = await garantirLeadDeTeste(db);
    const atual = await lerTesteAtual(db);

    return NextResponse.json({
      numeroTeste: config.numeroTeste,
      leadDeTeste: {
        leadId: leadDeTeste.placeId,
        nome: leadDeTeste.nome,
        /** Tem demo e captura com print? É o que decide se o alvo padrão serve hoje. */
        pronto: Boolean(leadDeTeste.demo) && Boolean(printUrlDoLead(leadDeTeste.capturas)),
      },
      atual: atual ?? null,
      /** Quanto tempo a tarefa injetada espera o aparelho puxar. */
      validadeMs: TESTE_VALIDADE_MS,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Injeta a tarefa de teste, ou diz QUAL ETAPA barrou.
 *
 * Corpo: `{ leadId?, pular?: ["ritmo" | "estruturais" | "nicho" | "janela"] }`.
 * Sem `leadId`, o alvo é o lead fixo de teste — ele é o PADRÃO, não o único.
 *
 * Barrar é resultado legítimo de um pedido válido (é o diagnóstico que a tela
 * pediu), não erro: responde 200 com `injetada: false` e a etapa nominal. 4xx
 * fica para pedido malformado — leadId inexistente, etapa que não existe.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);

    const corpo = await readJsonBody(req);
    const { leadId, pular } = corpo as { leadId?: unknown; pular?: unknown };

    if (leadId !== undefined && (typeof leadId !== "string" || leadId.length > LEAD_ID_MAX)) {
      throw new ValidationError(["leadId deve ser o id de um lead"]);
    }
    const etapas = etapasValidas(pular);
    if (!etapas) {
      throw new ValidationError(["pular deve ser uma lista de: ritmo, estruturais, nicho, janela"]);
    }

    const alvo = (typeof leadId === "string" && leadId.trim()) || LEAD_TESTE_ID;
    const lead = alvo === LEAD_TESTE_ID ? await garantirLeadDeTeste(db) : await getLead(db, alvo);
    if (!lead) throw new NotFoundError(`Lead "${alvo}" não encontrado.`);

    const now = new Date();
    const config = await loadFilaConfig(db);
    const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
    const app = await loadConfig(db);

    const barreira = avaliarTeste({
      lead,
      config,
      contador,
      janelas: app.janelasContato,
      now,
      pular: etapas,
    });
    if (barreira) {
      return NextResponse.json({ injetada: false, leadId: lead.placeId, nome: lead.nome, ...barreira });
    }

    // `avaliarTeste` já garantiu print e demo; a mensagem é montada AGORA e
    // congelada na tarefa. Montar aqui (e não na entrega) é o que deixa
    // `/proximo` servir o teste sem ler lead nem as três coleções de frases
    // — e é o que impede a tarefa de mudar de conteúdo entre o clique e a
    // puxada. `montarMensagemParaLead` é leitura pura: não gira rotação.
    const mensagem = await montarMensagemParaLead(db, lead);
    const teste = await injetarTeste(
      db,
      {
        leadId: lead.placeId,
        nome: lead.nome,
        // O destino é sempre o da config, nunca `mensagem.telefone`.
        numero: config.numeroTeste,
        texto: mensagem.texto,
        printUrl: printUrlDoLead(lead.capturas) as string,
        criadoPor: usuario.id,
        pulou: etapas,
      },
      now,
    );

    return NextResponse.json({ injetada: true, teste });
  } catch (error) {
    return handleRouteError(error);
  }
}
