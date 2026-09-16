import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/firebase/admin";
import { autenticarDispositivo } from "@/lib/fila/auth";
import { candidatoEstavel, lerPool } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import {
  lerContadorFila,
  lerContadorFilaCompleto,
  snapshotDoContador,
  type FilaContadorCompleto,
} from "@/lib/fila/contadores";
import {
  TENTATIVAS_MAX,
  anotarRotacao,
  liberarClaim,
  retencaoMsDeHoras,
  reservarLead,
} from "@/lib/fila/envios";
import type { TipoTarefaFila } from "@/lib/fila/estado";
import { flushGruposMaduros } from "@/lib/fila/flushRespostas";
import { montarMensagemParaLead } from "@/lib/fila/mensagem";
import {
  dentroDaJanelaResposta,
  proximaTarefaResposta,
} from "@/lib/fila/respostaAutomatica";
import { printUrlDoLead } from "@/lib/fila/print";
import {
  motivoDeRitmo,
  motivoSemTarefaAgora,
  ordenarCandidatos,
  type MotivoSemTarefa,
} from "@/lib/fila/selecao";
import { lerTestePendente, marcarTesteEntregue } from "@/lib/fila/teste";
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
 *
 * **Resposta ACHATADA, de propósito** (nunca voltar a aninhar): quem consome
 * este JSON é uma macro do MacroDroid, que converte o corpo em dicionário e
 * lê cada campo por marcador de texto — e ela NÃO resolve chave aninhada tipo
 * `tarefa.id`; devolve o marcador literal em vez do valor. Um envelope
 * `{ tarefa: {...} }` fazia toda variável derivada virar lixo, a URL do print
 * virar string inválida, e o lead ser reportado como falha sem nada ter sido
 * enviado. Por isso: um objeto de UM nível só, com TODAS as chaves SEMPRE
 * presentes (chave ausente é o mesmo bug — o marcador some, a macro carrega
 * lixo sem perceber) e todo valor como string vazia (nunca `undefined`/`null`)
 * quando não há tarefa.
 *
 * **Duas tarefas, uma macro.** Esta rota entrega tanto a PROSPECÇÃO quanto a
 * RESPOSTA AUTOMÁTICA (`lib/fila/respostaAutomatica.ts`), e quem diz qual é a
 * chave `tipo`. Duas macros no aparelho disputariam a tela do mesmo celular, e
 * a proteção do MacroDroid contra execução sobreposta é POR MACRO — uma não
 * veria a outra. Então é uma macro só, com um desvio por `tipo`: em
 * "resposta" ela pula o passo do print (`printUrl` vem VAZIO — resposta não
 * leva print) e manda só o texto.
 *
 * A rota também é por onde sai a TAREFA DE TESTE (`lib/fila/teste.ts`):
 * requisito duro, porque cada alteração na macro custa reconfiguração manual
 * no celular. A macro pergunta a mesma coisa no mesmo lugar e só recebe,
 * naquela volta, a tarefa de teste em vez da normal — daí a chave `teste`,
 * booleana e sempre presente, e nenhuma outra mudança no contrato.
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

/**
 * Resposta achatada de `/proximo`: um nível só, chaves fixas, sempre todas
 * presentes — é o formato que o MacroDroid consegue ler (ver comentário do
 * arquivo). `temTarefa` e `teste` são os únicos booleanos; todo o resto é
 * string, e vazio (nunca omitido) quando o campo não se aplica.
 */
interface RespostaFila {
  temTarefa: boolean;
  /**
   * "prospeccao" ou "resposta" — o desvio da macro no aparelho. SEMPRE
   * PRESENTE nos dois casos, com e sem tarefa, pela mesma regra que vale
   * para todas as outras chaves (chave ausente faz o MacroDroid devolver o
   * marcador literal em vez de vazio; já custou um ciclo de depuração).
   *
   * E sempre um dos DOIS VALORES, nunca string vazia: o desvio é um se/senão
   * de dois ramos, e sem tarefa o ramo certo é o de prospecção — o que já
   * sabia lidar com "não tem nada para fazer agora". Um terceiro valor vazio
   * seria um caso a mais para a macro tratar, sem nada a ganhar.
   */
  tipo: TipoTarefaFila;
  /**
   * Esta volta trouxe uma TAREFA DE TESTE (ver `lib/fila/teste.ts`), não uma
   * prospecção real. Booleano, no mesmo espírito de `temTarefa`, e SEMPRE
   * PRESENTE nos dois casos — chave ausente faz o MacroDroid devolver o
   * marcador literal em vez de vazio, que foi a causa do bug do envelope
   * aninhado.
   */
  teste: boolean;
  id: string;
  leadId: string;
  nome: string;
  numero: string;
  texto: string;
  printUrl: string;
  expiraEm: string;
  motivo: MotivoSemTarefa | "";
}

function respostaComTarefa(
  tarefa: TarefaFila,
  opcoes: { teste?: boolean; tipo?: TipoTarefaFila } = {},
): NextResponse {
  const corpo: RespostaFila = {
    temTarefa: true,
    tipo: opcoes.tipo ?? "prospeccao",
    teste: opcoes.teste ?? false,
    id: tarefa.id,
    leadId: tarefa.leadId,
    nome: tarefa.nome,
    numero: tarefa.numero,
    texto: tarefa.texto,
    printUrl: tarefa.printUrl,
    expiraEm: tarefa.expiraEm,
    motivo: "",
  };
  return NextResponse.json(corpo);
}

function semTarefa(motivo: MotivoSemTarefa): NextResponse {
  const corpo: RespostaFila = {
    temTarefa: false,
    // Sem tarefa, o ramo da macro é o de prospecção — ver `tipo` acima.
    tipo: "prospeccao",
    teste: false,
    id: "",
    leadId: "",
    nome: "",
    numero: "",
    texto: "",
    printUrl: "",
    expiraEm: "",
    motivo,
  };
  return NextResponse.json(corpo);
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
  retencaoMs: number,
): Promise<TarefaFila | undefined> {
  const reserva = await reservarLead(db, leadId, dispositivo, now, {
    tentativasMax: TENTATIVAS_MAX,
    retencaoMs,
  });
  // Reserva viva de outro ciclo, estado terminal que o pool não viu, ou lead
  // RETIDO por claim não confirmada. Este último é o caso que o pool sozinho
  // não pega: ele dura 10 min e a claim 5, então nos ~4 minutos seguintes a
  // uma expiração o pool ainda oferece o lead — e é aqui, no doc fresco, que
  // a retenção o recusa. Ver `leadDisponivel`.
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
    const app = await loadConfig(db);

    // Flush do agrupamento de respostas — TODA chamada de /proximo varre
    // grupos maduros de mensagens recebidas (ver "Fila de respostas" em
    // ARCHITECTURE.md) e libera o rascunho, antes de qualquer portão de
    // ritmo: é o polling desta rota, a cada 180s, que garante que nenhum
    // grupo fica preso (a janela de silêncio é sempre menor). Isolado por
    // completo (`flushGruposMaduros` nunca lança) — falha na geração de um
    // rascunho não pode alterar nem atrasar perceptivelmente esta resposta.
    await flushGruposMaduros(db, now, config, app);

    // A TAREFA DE TESTE vem ANTES do portão de ritmo, de propósito: quem
    // decidiu que ela podia sair foi o operador na tela, que pode ter
    // mandado PULAR a etapa de ritmo justamente para ver o resto do
    // pipeline. Reaplicar o portão aqui engoliria o teste em silêncio — que
    // é o contrário do que o recurso promete. Entregar é one-shot
    // (transação em `marcarTesteEntregue`); perder a corrida cai na fila
    // normal, sem virar erro.
    const pendente = await lerTestePendente(db, now);
    if (pendente) {
      const entregue = await marcarTesteEntregue(db, pendente.claimId, now);
      if (entregue) {
        return respostaComTarefa(
          {
            id: pendente.claimId,
            leadId: pendente.leadId,
            nome: pendente.nome,
            // NUNCA o telefone do lead: é `config/fila.numeroTeste`, congelado
            // na injeção. Vale inclusive para o lead fixo de teste — a
            // sobrescrita é a rede de segurança de quando o alvo é real.
            numero: pendente.numero,
            texto: pendente.texto,
            printUrl: pendente.printUrl,
            expiraEm: entregue.expiraEm,
          },
          { teste: true },
        );
      }
    }

    // A RESPOSTA AUTOMÁTICA vem ANTES do portão de ritmo porque ela não
    // disputa com a prospecção: não consome `metaDiaria`, não respeita
    // `intervaloMinimoSegundos` e não conta no `tetoPorHora`. Aqueles três
    // existem para disfarçar disparo em rajada para quem NUNCA falou com
    // você; responder quem te escreveu é outra coisa, e uma noite movimentada
    // de respostas não pode comer a cota de prospecção do dia.
    //
    // Os portões dela são PRÓPRIOS, e são três:
    //
    // 1. a PAUSA continua valendo (`config.ativo`) — é o botão vermelho do
    //    aparelho, e ele para tudo que o celular faria, não só a prospecção;
    // 2. a JANELA de horário do OPERADOR (`dentroDaJanelaResposta`), que é
    //    outra pergunta que a `janelaContato` do lead;
    // 3. o TETO diário próprio, contra `respostasEnviadas`.
    //
    // O atraso sorteado já está embutido em `disponivelEm` (ver
    // `criarTarefaResposta`), então aqui ele não aparece: tarefa que ainda
    // não venceu simplesmente não está disponível.
    let contadorCompleto: FilaContadorCompleto | undefined;
    if (
      config.ativo &&
      config.respostaAutomatica &&
      dentroDaJanelaResposta(now, config.respostaJanelaInicio, config.respostaJanelaFim)
    ) {
      contadorCompleto = await lerContadorFilaCompleto(db, now, config.inicioDiaOperacionalHora);
      if (contadorCompleto.respostasEnviadas < config.respostasAutomaticasMaxDia) {
        const resposta = await proximaTarefaResposta(db, dispositivo, now);
        if (resposta) {
          return respostaComTarefa(
            {
              id: resposta.claimId,
              leadId: resposta.leadId,
              nome: resposta.nome,
              numero: resposta.numero,
              texto: resposta.texto,
              // Resposta não leva print: a conversa já está aberta, e a peça
              // que vende já foi na abordagem. VAZIO, nunca omitido.
              printUrl: "",
              expiraEm: resposta.expiraEm,
            },
            { tipo: "resposta" },
          );
        }
      }
    }

    // O contador do dia já pode ter sido lido pelo bloco acima — é o MESMO
    // doc que o portão de ritmo precisa, e lê-lo duas vezes na mesma chamada
    // seria pagar de novo por nada.
    const contador = contadorCompleto
      ? snapshotDoContador(contadorCompleto)
      : await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
    const ritmo = motivoDeRitmo(config, contador);
    if (ritmo) return semTarefa(ritmo);

    const retencaoMs = retencaoMsDeHoras(config.retencaoEnvioHoras);
    const pool = await lerPool(db, now, { retencaoMs });
    const { escolhido, diagnostico } = ordenarCandidatos(
      pool.candidatos,
      config,
      app.janelasContato,
      now,
    );

    for (const candidato of escolhido) {
      const tarefa = await tentarEntregar(db, candidato.id, dispositivo, now, retencaoMs);
      if (tarefa) return respostaComTarefa(tarefa);
    }

    // Distinção deliberada: "fora_de_janela" é todo mundo dormindo — volte
    // mais tarde e vai sair. "sem_leads_elegiveis" é não existir lead pronto
    // (ou os que existiam estarem todos reservados) — nenhuma espera resolve,
    // alguém precisa gerar demo e capturas. Colapsar os dois apagaria a
    // única informação que diz qual providência tomar. Extraído para
    // `motivoSemTarefaAgora` (lib/fila/selecao.ts) para `GET /api/fila/resumo`
    // reusar a mesma distinção sem duplicá-la.
    return semTarefa(motivoSemTarefaAgora(escolhido.length, diagnostico));
  } catch (error) {
    return handleRouteError(error);
  }
}
