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

function respostaComTarefa(tarefa: TarefaFila, teste = false): NextResponse {
  const corpo: RespostaFila = {
    temTarefa: true,
    teste,
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
          true,
        );
      }
    }

    const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
    const ritmo = motivoDeRitmo(config, contador);
    if (ritmo) return semTarefa(ritmo);

    const [app, pool] = await Promise.all([loadConfig(db), lerPool(db, now)]);
    const { escolhido, diagnostico } = ordenarCandidatos(
      pool.candidatos,
      config,
      app.janelasContato,
      now,
    );

    for (const candidato of escolhido) {
      const tarefa = await tentarEntregar(db, candidato.id, dispositivo, now);
      if (tarefa) return respostaComTarefa(tarefa);
    }

    // Distinção deliberada: "fora_de_janela" é todo mundo dormindo — volte
    // mais tarde e vai sair. "sem_leads_elegiveis" é não existir lead pronto
    // (ou os que existiam estarem todos reservados) — nenhuma espera resolve,
    // alguém precisa gerar demo e capturas. Colapsar os dois apagaria a
    // única informação que diz qual providência tomar.
    const foraDeJanela =
      diagnostico.janela.razoavel + diagnostico.janela.ruim + diagnostico.janela.semNivel;
    return semTarefa(
      escolhido.length === 0 && foraDeJanela > 0 ? "fora_de_janela" : "sem_leads_elegiveis",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
