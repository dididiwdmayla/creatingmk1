import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

/**
 * O LEAD FIXO DE TESTE — um alvo permanente e estável para validar o ciclo
 * do aparelho (puxar tarefa → abrir o WhatsApp → mandar texto e print →
 * confirmar) sem envolver nenhum negócio real.
 *
 * **Por que um lead de verdade e não um objeto sintético na rota:** o teste
 * só prova alguma coisa se percorrer o MESMO caminho da tarefa real —
 * `montarMensagemParaLead` (frases, precedência skin→grupo→global,
 * marcadores, link da demo com token) e `printUrlDoLead` (âncora principal,
 * celular, moldura caindo para a crua). Um mock na rota testaria a rota, não
 * o ciclo.
 *
 * **Por que ele parece um negócio comum:** o número de destino é sempre
 * sobrescrito por `numeroTeste`, mas a rede de segurança pode falhar — e se
 * um dia a mensagem escapar para o número errado, é muito melhor ela parecer
 * prospecção normal do que chegar assinada "LEAD TESTE 123".
 *
 * **Ele não entra em NENHUM agregado.** `Lead.leadDeTeste` é a marcação, e
 * quem exclui é a origem de cada varredura: `listLeads` (e com ela /leads,
 * /demos, /hoje, /mundo, a análise de grupo e a penetração por
 * nicho+cidade), `getMetrics`/`getMetricsPorUsuario` e `construirPool`. Um
 * lead de teste somado à penetração de site envenenaria, em silêncio, um
 * número usado como argumento de venda.
 *
 * **Nem no pool da fila real.** O alvo do disparo de teste é escolhido na
 * tela; se este lead fosse candidato normal, o aparelho mandaria mensagem
 * de verdade para ele à noite, sozinho.
 */

/**
 * Id do doc em `/leads`. NÃO tem forma de placeId do Google (`ChIJ…`) de
 * propósito: nenhuma busca pode devolvê-lo, então `upsertLeads` do cron
 * nunca vai sobrescrever este doc.
 */
export const LEAD_TESTE_ID = "radar-lead-teste";

/** Nicho com skin registrada (`barbearia-editorial`) — ver `lib/demos/registry.ts`. */
const LEAD_TESTE_NICHO = "barbearia";
const LEAD_TESTE_SKIN = "barbearia-editorial";
const LEAD_TESTE_TEMA = "norte";

/**
 * O expediente do negócio de teste: terça a sábado, 9h–19h. Existe para a
 * etapa "janela" do disparo de teste ter o que avaliar de verdade — um lead
 * aberto 24h barraria sempre, e um sem faixa nenhuma cairia na estimativa.
 */
const LEAD_TESTE_FAIXAS = [2, 3, 4, 5, 6].map((dia) => ({
  diaAbre: dia,
  horaAbre: 9,
  minAbre: 0,
  diaFecha: dia,
  horaFecha: 19,
  minFecha: 0,
}));

/** Instante fixo de criação — o doc é sempre o mesmo, inclusive na ordem justa da fila. */
const LEAD_TESTE_CRIADO_EM = "2026-01-01T00:00:00.000Z";

/**
 * O doc, tal como nasce. `telefoneIntl` é um número de teste RESERVADO
 * (prefixo 5555 do plano brasileiro, nunca atribuído a um assinante): o
 * disparo sobrescreve o destino por `numeroTeste` de qualquer jeito, mas um
 * lead sem telefone reprovaria na peneira estrutural e tornaria o alvo
 * padrão inútil justamente com os interruptores desligados.
 */
export function leadDeTesteInicial(): Lead {
  return {
    placeId: LEAD_TESTE_ID,
    nome: "Barbearia Dom Aurélio",
    endereco: "Rua Néo Alves Martins, 2820 — Zona 01, Maringá — PR, 87013-060",
    location: { lat: -23.4205, lng: -51.9331 },
    status: "novo",
    leadDeTeste: true,
    busca: {
      nicho: LEAD_TESTE_NICHO,
      regiao: "Maringá PR",
      em: LEAD_TESTE_CRIADO_EM,
      idioma: "pt-BR",
    },
    temSite: false,
    siteProprio: false,
    temTelefone: true,
    telefone: "(44) 3555-0142",
    telefoneIntl: "+55 44 3555-0142",
    enriquecido: false,
    horarios: {
      faixas: LEAD_TESTE_FAIXAS,
      utcOffsetMinutes: -180,
      obtidoEm: LEAD_TESTE_CRIADO_EM,
    },
    demo: {
      skinId: LEAD_TESTE_SKIN,
      themeId: LEAD_TESTE_TEMA,
      dados: {},
      criadoEm: LEAD_TESTE_CRIADO_EM,
      atualizadoEm: LEAD_TESTE_CRIADO_EM,
    },
    criadoEm: LEAD_TESTE_CRIADO_EM,
    atualizadoEm: LEAD_TESTE_CRIADO_EM,
  };
}

function docRef(db: AppDb) {
  return db.collection(LEADS_COLLECTION).doc(LEAD_TESTE_ID);
}

/**
 * O lead de teste, criando-o se ainda não existir. Idempotente e
 * **NÃO-DESTRUTIVA**: doc que já existe volta como está, sem merge nenhum.
 *
 * É isso que faz a captura ser gerada UMA vez e persistir: o operador abre
 * a ficha deste lead, manda gerar as capturas como em qualquer outro, e a
 * partir daí nada regenera nem invalida — `capturas.estado === "pronto"` não
 * tem ciclo de expiração (a regra de `semNoticia` só degrada `enfileirado` e
 * `rodando`), e os dois caminhos que apagariam a demo excluem este lead de
 * propósito (ver `DELETE /api/leads/[id]/demo` e o apagar em lote do grupo).
 *
 * Chamada pelo painel do disparo de teste, que é a única tela que precisa
 * dela — não há seed nem migração neste repo, e não é preciso haver.
 */
export async function garantirLeadDeTeste(db: AppDb): Promise<Lead> {
  const snap = await docRef(db).get();
  if (snap.exists) return snap.data() as unknown as Lead;

  const lead = leadDeTesteInicial();
  await docRef(db).set(lead as unknown as Record<string, unknown>);
  return lead;
}

/** O lead é o fixo de teste (ou qualquer outro marcado como tal)? */
export function ehLeadDeTeste(lead: Pick<Lead, "leadDeTeste"> | undefined): boolean {
  return lead?.leadDeTeste === true;
}
