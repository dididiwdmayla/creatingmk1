import { describe, expect, it } from "vitest";

import { confirmarEnvio } from "@/lib/fila/confirmar";
import { DEFAULT_FILA_CONFIG } from "@/lib/fila/config";
import { reservarLead } from "@/lib/fila/envios";
import { CANAL_INDIVIDUAL, processarMensagemRecebida } from "@/lib/fila/mensagemRecebida";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import {
  changeStatus,
  deleteDemo,
  getLead,
  registrarSeloContato,
  saveDemo,
  saveDetails,
  saveHorarios,
  updateLeadExtras,
  upsertLeads,
} from "../repo";
import type { Lead } from "../types";

/**
 * A CORRIDA NO DOC DO LEAD — ver "Escritas transacionais no lead" em
 * ARCHITECTURE.md.
 *
 * As escritas de `leads/repo.ts` eram leitura-modificação-escrita SEM
 * transação, gravando o doc INTEIRO. Se outra escrita caísse entre a leitura
 * e a gravação — o confirmar da fila movendo o lead para "contactado" com
 * selo e registro, por exemplo —, a gravação do doc velho a apagava: o lead
 * voltava a "novo", o selo sumia, e a fila podia mandar de novo.
 *
 * Cada teste intercala a escrita concorrente exatamente entre a leitura e a
 * gravação (`FakeFirestore.aoLer`) e cobra que as DUAS sobrevivem. O fake
 * agora detecta conflito como o Firestore real: com a escrita dentro de uma
 * transação, ela roda de novo sobre o doc novo.
 */

const AGORA = new Date("2026-03-10T10:00:00Z");
const LEAD = "ChIJa";

function leadBase(): Lead {
  return {
    placeId: LEAD,
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    buscaId: ["b1"],
    demo: {
      skinId: "barbearia-editorial",
      themeId: "padrao",
      dados: {},
      criadoEm: "2026-03-02T00:00:00.000Z",
      atualizadoEm: "2026-03-02T00:00:00.000Z",
    },
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  } as unknown as Lead;
}

/**
 * O lead com uma claim reservada e, intercalada na PRÓXIMA leitura do doc do
 * lead, a confirmação "enviado" da fila — que move para "contactado" e grava
 * selo e registro.
 */
async function comConfirmarNoMeio(): Promise<FakeFirestore> {
  const db = new FakeFirestore();
  db.seed(`leads/${LEAD}`, leadBase() as unknown as Record<string, unknown>);
  const reserva = await reservarLead(db, LEAD, "android", AGORA);
  db.aoLer(`leads/${LEAD}`, () =>
    confirmarEnvio(db, LEAD, reserva!.claimId, "enviado", {
      userId: "radar-device",
      inicioDiaOperacionalHora: 0,
      now: AGORA,
    }),
  );
  return db;
}

async function exigirContatoDaFila(db: FakeFirestore) {
  const lead = await getLead(db, LEAD);
  expect(lead?.status).toBe("contactado");
  expect(lead?.seloContato).toMatchObject({ userId: "radar-device" });
  expect(lead?.registrosEnvio?.length ?? 0).toBeGreaterThanOrEqual(1);
  return lead!;
}

describe("o confirmar da fila no meio de uma escrita do repo NÃO é apagado", () => {
  it("REPRODUÇÃO: upsert de busca (o caso do diagnóstico)", async () => {
    const db = await comConfirmarNoMeio();

    await upsertLeads(
      db,
      [{ placeId: LEAD, nome: "Barbearia do Zé", temSite: false }] as never,
      { nicho: "barbearia", regiao: "Maringá" },
      "b2",
      AGORA,
    );

    const lead = await exigirContatoDaFila(db);
    expect(lead.buscaId).toEqual(["b1", "b2"]); // e o upsert também valeu
  });

  it("REPRODUÇÃO: extras da ficha (favorito)", async () => {
    const db = await comConfirmarNoMeio();
    await updateLeadExtras(db, LEAD, { favorito: true }, AGORA);
    expect((await exigirContatoDaFila(db)).favorito).toBe(true);
  });

  it("REPRODUÇÃO: clique manual no WhatsApp (selo e registro)", async () => {
    const db = await comConfirmarNoMeio();
    await registrarSeloContato(db, LEAD, "membro-1", AGORA);
    // Os dois registros sobrevivem: o da fila e o do clique.
    expect((await exigirContatoDaFila(db)).registrosEnvio).toHaveLength(2);
  });

  it("REPRODUÇÃO: mudança de status manual", async () => {
    const db = await comConfirmarNoMeio();
    // Com o doc novo, o lead já está "contactado": a transição pedida
    // (novo → contactado) não é mais válida e é recusada — em vez de gravar
    // por cima do selo.
    await changeStatus(db, LEAD, "contactado", AGORA, "membro-1").catch(() => undefined);
    await exigirContatoDaFila(db);
  });

  it("REPRODUÇÃO: salvar a demo", async () => {
    const db = await comConfirmarNoMeio();
    await saveDemo(db, LEAD, { skinId: "barbearia-classica", themeId: "padrao", dados: {} }, AGORA, "membro-1");
    expect((await exigirContatoDaFila(db)).demo?.skinId).toBe("barbearia-classica");
  });

  it("REPRODUÇÃO: excluir a demo", async () => {
    const db = await comConfirmarNoMeio();
    await deleteDemo(db, LEAD, AGORA);
    expect((await exigirContatoDaFila(db)).demo).toBeUndefined();
  });

  it("REPRODUÇÃO: enriquecer (detalhes) e horários", async () => {
    const db = await comConfirmarNoMeio();
    await saveDetails(db, LEAD, { site: undefined } as never, AGORA, "membro-1");
    expect((await exigirContatoDaFila(db)).enriquecido).toBe(true);

    const db2 = await comConfirmarNoMeio();
    await saveHorarios(db2, LEAD, { faixas: [], utcOffsetMinutes: -180 } as never, AGORA);
    await exigirContatoDaFila(db2);
  });
});

describe("a resposta recebida não grava por cima de uma edição concorrente", () => {
  it("REPRODUÇÃO: nota do operador entre a varredura e a gravação de 'respondeu' sobrevive", async () => {
    const db = new FakeFirestore();
    db.seed(`leads/${LEAD}`, { ...(leadBase() as unknown as Record<string, unknown>), status: "contactado" });
    // A varredura de /leads acha o lead; antes de gravar "respondeu", o
    // operador salva uma nota (intercalada na checagem da chave repetida).
    db.aoLer(`leads/${LEAD}/respostas/hash-1`, () => updateLeadExtras(db, LEAD, { notas: "ligar à tarde" }, AGORA));

    await processarMensagemRecebida(
      db,
      {
        remetente: "+55 44 99154-3803",
        texto: "Oi!",
        canal: CANAL_INDIVIDUAL,
        recebidoEm: AGORA.toISOString(),
        chave: "hash-1",
      },
      AGORA,
      DEFAULT_FILA_CONFIG,
    );

    const lead = await getLead(db, LEAD);
    expect(lead?.status).toBe("respondeu");
    expect(lead?.notas).toBe("ligar à tarde");
  });
});
