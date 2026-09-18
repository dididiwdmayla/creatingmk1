import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { getLead, updateLeadExtras } from "../repo";
import {
  CORTE_PADRAO,
  corteValido,
  demoAbertaPorFora,
  descartarEmLote,
  listarSemVestigio,
  SEM_VESTIGIO_MAX,
} from "../semVestigio";

/**
 * A tela de revisão dos leads antigos SEM VESTÍGIO NENHUM de contato
 * (painel da /config). O recorte é o item inteiro: quem tem qualquer
 * vestígio já está tratado pelo filtro da fila (`contactadoForaDaFila`) e
 * listá-lo aqui faria o operador revisar — e possivelmente apagar — lead já
 * resolvido.
 */

const BASE = {
  nome: "Lead Antigo",
  status: "novo",
  enriquecido: false,
  busca: { nicho: "dentista", regiao: "Porto Alegre RS", em: "2026-07-01T12:00:00.000Z" },
  criadoEm: "2026-07-01T12:00:00.000Z",
  atualizadoEm: "2026-07-01T12:00:00.000Z",
};

function semear(db: FakeFirestore, id: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, { placeId: id, ...BASE, ...extra });
}

/** Um doc de claim da fila — sempre nasce de uma reserva (ver `FilaEnvioDoc`). */
function semearEnvio(db: FakeFirestore, leadId: string, extra: Record<string, unknown> = {}) {
  db.seed(`filaEnvios/${leadId}`, {
    leadId,
    estado: "falhou",
    claimId: "c1",
    reservadoEm: "2026-07-02T23:00:00.000Z",
    expiraEm: "2026-07-02T23:05:00.000Z",
    dispositivo: "moto-g",
    tentativas: 1,
    ultimoErro: "sem whatsapp",
    enviadoEm: null,
    ...extra,
  });
}

const ids = (r: { linhas: Array<{ leadId: string }> }) => r.linhas.map((l) => l.leadId);

describe("listarSemVestigio — o recorte", () => {
  it("lista o lead novo, antigo e sem vestígio nenhum", async () => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    const r = await listarSemVestigio(db, CORTE_PADRAO);
    expect(ids(r)).toEqual(["limpo"]);
    expect(r).toMatchObject({ corte: CORTE_PADRAO, total: 1, truncado: false });
  });

  /**
   * Os três campos de vestígio, um por um — são os MESMOS que
   * `motivoEstrutural` lê para barrar o lead na fila automática. Qualquer
   * um deles sozinho tira o lead da tela.
   */
  it.each([
    ["seloContato", { seloContato: { userId: "ana", em: "2026-07-05T10:00:00.000Z" } }],
    ["registrosEnvio", { registrosEnvio: [{ em: "2026-07-05T10:00:00.000Z" }] }],
    ["contato.primeiroContatoEm", { contato: { primeiroContatoEm: "2026-07-05T10:00:00.000Z" } }],
  ])("lead com %s NÃO aparece", async (_rotulo, vestigio) => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    semear(db, "comVestigio", vestigio);
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["limpo"]);
  });

  /**
   * O vestígio que NÃO mora no doc do lead: a claim da fila. O envio
   * confirmado carimba `seloContato`, mas a claim que expira sem
   * confirmação não carimba nada — e a retenção trata esse caso como
   * "provavelmente a mensagem saiu". Sem esta cláusula, o lead entraria
   * aqui como limpo e poderia ser destruído.
   */
  it("lead com doc em filaEnvios NÃO aparece, mesmo sem vestígio no doc do lead", async () => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    semear(db, "reservado");
    semearEnvio(db, "reservado");
    const r = await listarSemVestigio(db, CORTE_PADRAO);
    expect(ids(r)).toEqual(["limpo"]);
    // E o doc do lead continua limpo — é só a claim que o barra.
    const lead = await getLead(db, "reservado");
    expect(lead?.seloContato).toBeUndefined();
    expect(lead?.status).toBe("novo");
  });

  it("lead criado DEPOIS do corte não aparece", async () => {
    const db = new FakeFirestore();
    semear(db, "antigo");
    semear(db, "novo", {
      criadoEm: "2026-08-11T12:00:00.000Z",
      atualizadoEm: "2026-08-11T12:00:00.000Z",
    });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["antigo"]);
  });

  /**
   * O corte é a chave de calendário em America/Sao_Paulo, não UTC — mesmo
   * precedente de `buscas/agrupar.ts` ("uma busca rodada às 22h do dia 31 é
   * de julho pra quem a rodou"). 2026-08-10T01:00Z é 09/08 às 22h em
   * Brasília: para quem operou, é véspera do corte, e entra.
   */
  it("o dia do corte é o de São Paulo, não o UTC", async () => {
    const db = new FakeFirestore();
    semear(db, "vespera-em-sp", {
      criadoEm: "2026-08-10T01:00:00.000Z",
      atualizadoEm: "2026-08-10T01:00:00.000Z",
    });
    semear(db, "no-dia-do-corte", {
      criadoEm: "2026-08-10T15:00:00.000Z",
      atualizadoEm: "2026-08-10T15:00:00.000Z",
    });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["vespera-em-sp"]);
  });

  it("lead que não está em 'novo' não aparece, nem sem vestígio nenhum", async () => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    semear(db, "fechado", { status: "fechado" });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["limpo"]);
  });

  it("descartado não aparece — já está fora do caminho", async () => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    semear(db, "jaDescartado", { descartado: true });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["limpo"]);
  });

  it("o lead fixo de teste nunca aparece", async () => {
    const db = new FakeFirestore();
    semear(db, "limpo");
    semear(db, "teste", { leadDeTeste: true });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["limpo"]);
  });

  it("ordena do mais antigo para o mais novo", async () => {
    const db = new FakeFirestore();
    semear(db, "meio", { criadoEm: "2026-06-15T12:00:00.000Z" });
    semear(db, "velho", { criadoEm: "2026-05-01T12:00:00.000Z" });
    semear(db, "recente", { criadoEm: "2026-07-20T12:00:00.000Z" });
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["velho", "meio", "recente"]);
  });

  it("corta em SEM_VESTIGIO_MAX e diz que cortou", async () => {
    const db = new FakeFirestore();
    for (let i = 0; i < SEM_VESTIGIO_MAX + 5; i += 1) {
      semear(db, `lead-${String(i).padStart(4, "0")}`);
    }
    const r = await listarSemVestigio(db, CORTE_PADRAO);
    expect(r.total).toBe(SEM_VESTIGIO_MAX + 5);
    expect(r.truncado).toBe(true);
    expect(r.linhas).toHaveLength(SEM_VESTIGIO_MAX);
  });
});

describe("as colunas da linha", () => {
  it("demo, captura pronta e nicho saem do doc do lead", async () => {
    const db = new FakeFirestore();
    semear(db, "completo", {
      busca: { nicho: "barbearia", regiao: "Canoas RS", em: "2026-07-01T12:00:00.000Z" },
      demo: { skinId: "barbearia-editorial", themeId: "creme", dados: {}, criadoEm: "x", atualizadoEm: "x" },
      capturas: { estado: "pronto", imagens: [] },
    });
    semear(db, "cru");
    const linhas = (await listarSemVestigio(db, CORTE_PADRAO)).linhas;
    expect(linhas.find((l) => l.leadId === "completo")).toMatchObject({
      nicho: "barbearia",
      temDemo: true,
      capturaPronta: true,
    });
    expect(linhas.find((l) => l.leadId === "cru")).toMatchObject({
      nicho: "dentista",
      temDemo: false,
      capturaPronta: false,
    });
  });

  it("captura ainda rodando não conta como pronta", async () => {
    const db = new FakeFirestore();
    semear(db, "rodando", { capturas: { estado: "rodando", imagens: [] } });
    expect((await listarSemVestigio(db, CORTE_PADRAO)).linhas[0].capturaPronta).toBe(false);
  });
});

/**
 * A coluna "demo aberta por fora". O ponto central: ter TOKEN não prova
 * nada — `garantirEnviosCanais` gera um por canal no `saveDemo` e faz
 * self-heal na leitura, então todo lead com demo tem token. O que prova é a
 * VISITA não-interna.
 */
describe("demoAbertaPorFora — o que é e o que não é sinal", () => {
  const demo = {
    skinId: "barbearia-editorial",
    themeId: "creme",
    dados: {},
    criadoEm: "2026-07-01T12:00:00.000Z",
    atualizadoEm: "2026-07-01T12:00:00.000Z",
    envios: [
      { token: "tok-link", geradoEm: "2026-07-01T12:00:00.000Z", canal: "link" },
      { token: "tok-wa", geradoEm: "2026-07-01T12:00:00.000Z", canal: "whatsapp" },
    ],
  };

  it("NÃO acende só por existir token em demo.envios", async () => {
    const db = new FakeFirestore();
    semear(db, "comToken", { demo });
    const linha = (await listarSemVestigio(db, CORTE_PADRAO)).linhas[0];
    expect(linha.temDemo).toBe(true);
    expect(linha.abertaPorFora).toBe(false);
  });

  it("acende com visita NÃO-interna", async () => {
    const db = new FakeFirestore();
    semear(db, "aberta", {
      demo,
      demoVisitas: [
        { id: "v1", em: "2026-07-03T10:00:00.000Z", interna: false, canal: "link" },
      ],
    });
    expect((await listarSemVestigio(db, CORTE_PADRAO)).linhas[0].abertaPorFora).toBe(true);
  });

  it("visita INTERNA (preview do time) não acende", async () => {
    const db = new FakeFirestore();
    semear(db, "sopreview", {
      demo,
      demoVisitas: [{ id: "v1", em: "2026-07-03T10:00:00.000Z", interna: true, canal: "link" }],
    });
    expect((await listarSemVestigio(db, CORTE_PADRAO)).linhas[0].abertaPorFora).toBe(false);
  });

  it("uma externa no meio de internas basta", () => {
    expect(
      demoAbertaPorFora({
        demoVisitas: [
          { id: "a", em: "x", interna: true },
          { id: "b", em: "y", interna: false },
          { id: "c", em: "z", interna: true },
        ],
      } as never),
    ).toBe(true);
  });
});

describe("descartarEmLote — a ação padrão, reversível", () => {
  it("marca descartado, some da lista e é reversível pela ficha", async () => {
    const db = new FakeFirestore();
    semear(db, "a");
    semear(db, "b");
    semear(db, "c");

    expect(await descartarEmLote(db, ["a", "b"])).toBe(2);
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["c"]);

    const descartado = await getLead(db, "a");
    expect(descartado?.descartado).toBe(true);
    // Nada mais foi tocado: o lead continua inteiro na base.
    expect(descartado?.status).toBe("novo");
    expect(descartado?.nome).toBe("Lead Antigo");

    // "Restaurar lead" na ficha é o MESMO patch, com false — e o lead volta.
    await updateLeadExtras(db, "a", { descartado: false });
    expect((await getLead(db, "a"))?.descartado).toBe(false);
    expect(ids(await listarSemVestigio(db, CORTE_PADRAO))).toEqual(["a", "c"]);
  });

  it("tolera id inexistente sem derrubar a leva", async () => {
    const db = new FakeFirestore();
    semear(db, "a");
    expect(await descartarEmLote(db, ["a", "fantasma"])).toBe(1);
    expect((await getLead(db, "a"))?.descartado).toBe(true);
  });
});

describe("corteValido", () => {
  it("aceita só YYYY-MM-DD de calendário real", () => {
    expect(corteValido("2026-08-10")).toBe(true);
    expect(corteValido(CORTE_PADRAO)).toBe(true);
    expect(corteValido("2026-02-30")).toBe(false);
    expect(corteValido("10/08/2026")).toBe(false);
    expect(corteValido("2026-8-1")).toBe(false);
    expect(corteValido("")).toBe(false);
  });
});
