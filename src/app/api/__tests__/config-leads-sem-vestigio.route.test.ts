import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLead } from "@/lib/leads/repo";
import { SEM_VESTIGIO_LOTE_MAX } from "@/lib/leads/semVestigio";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET } from "../config/leads-sem-vestigio/route";
import { POST as DESCARTAR } from "../config/leads-sem-vestigio/descartar/route";
import { POST as EXCLUIR } from "../config/leads-sem-vestigio/excluir/route";

/**
 * A tela de revisão dos leads antigos SEM VESTÍGIO NENHUM de contato, e as
 * duas ações dela. Mesma divisão do resto dos painéis da /config: ADMIN nos
 * três verbos, GET incluído — a lista é a matéria-prima de uma ação
 * destrutiva, e quem não pode apagar não precisa da lista de candidatos.
 *
 * Também sob `/api/config/`, e não `/api/fila/`: aquele prefixo inteiro
 * passa SEM sessão de usuário (é o celular com Bearer, ver src/proxy.ts).
 */

let db: FakeFirestore;
const arquivos = new Set<string>();

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({
  getDemoStorage: () => ({
    async save(path: string) {
      arquivos.add(path);
    },
    async deleteByPrefix(prefix: string) {
      for (const path of [...arquivos]) if (path.startsWith(prefix)) arquivos.delete(path);
    },
    publicUrl: (path: string) => `https://storage.example/${path}`,
  }),
}));

const CORTE = "2026-08-10";

function semearLead(id: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    busca: { nicho: "dentista", regiao: "Porto Alegre RS", em: "2026-07-01T12:00:00.000Z" },
    criadoEm: "2026-07-01T12:00:00.000Z",
    atualizadoEm: "2026-07-01T12:00:00.000Z",
    ...extra,
  });
}

function semearEnvio(leadId: string) {
  db.seed(`filaEnvios/${leadId}`, {
    leadId,
    estado: "falhou",
    claimId: "c1",
    reservadoEm: "2026-07-02T23:00:00.000Z",
    expiraEm: "2026-07-02T23:05:00.000Z",
    dispositivo: "android",
    tentativas: 3,
    ultimoErro: "sem whatsapp",
    enviadoEm: null,
  });
}

const getRequest = (cookie?: string, corte?: string) =>
  new Request(
    `http://localhost/api/config/leads-sem-vestigio${corte ? `?corte=${corte}` : ""}`,
    { headers: { ...(cookie && { cookie }) } },
  );

const postRequest = (caminho: string, corpo: unknown, cookie?: string) =>
  new Request(`http://localhost/api/config/leads-sem-vestigio/${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(corpo),
  });

const admin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });
const membro = () => cookieDeSessao(db, { id: "membro-1", papel: "membro" });

beforeEach(() => {
  db = new FakeFirestore();
  arquivos.clear();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/config/leads-sem-vestigio", () => {
  it("sem sessão → 401", async () => {
    semearLead("A");
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403, sem vazar uma linha da lista", async () => {
    semearLead("A");
    const res = await GET(getRequest(await membro()));
    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("forbidden");
    expect(corpo.linhas).toBeUndefined();
    expect(corpo.total).toBeUndefined();
  });

  it("devolve as colunas da revisão, com o corte ecoado", async () => {
    semearLead("A", {
      demo: {
        skinId: "barbearia-editorial",
        themeId: "creme",
        dados: {},
        criadoEm: "2026-07-01T12:00:00.000Z",
        atualizadoEm: "2026-07-01T12:00:00.000Z",
        envios: [{ token: "tok", geradoEm: "2026-07-01T12:00:00.000Z", canal: "link" }],
      },
      capturas: { estado: "pronto", imagens: [] },
      demoVisitas: [{ id: "v1", em: "2026-07-03T10:00:00.000Z", interna: false, canal: "link" }],
    });

    const res = await GET(getRequest(await admin(), CORTE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      corte: CORTE,
      total: 1,
      truncado: false,
      linhas: [
        {
          leadId: "A",
          nome: "Lead A",
          nicho: "dentista",
          criadoEm: "2026-07-01T12:00:00.000Z",
          temDemo: true,
          capturaPronta: true,
          abertaPorFora: true,
        },
      ],
    });
  });

  it("lead com vestígio, lead depois do corte e lead reservado pela fila ficam de fora", async () => {
    semearLead("limpo");
    semearLead("comSelo", { seloContato: { userId: "ana", em: "2026-07-05T10:00:00.000Z" } });
    semearLead("novo", { criadoEm: "2026-09-01T12:00:00.000Z" });
    semearLead("naFila");
    semearEnvio("naFila");

    const res = await GET(getRequest(await admin(), CORTE));

    const corpo = await res.json();
    expect(corpo.linhas.map((l: { leadId: string }) => l.leadId)).toEqual(["limpo"]);
  });

  /**
   * Corte inválido é 400, nunca fallback silencioso para o padrão: cair no
   * padrão sem avisar mostraria uma lista que não é a que o operador pediu
   * — e é sobre essa lista que ele aperta "excluir em definitivo".
   */
  it("corte malformado → 400, não o padrão em silêncio", async () => {
    semearLead("A");
    const res = await GET(getRequest(await admin(), "10-08-2026"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});

describe("POST .../descartar", () => {
  it("sem sessão → 401; membro → 403, e nenhum lead é tocado", async () => {
    semearLead("A");

    expect((await DESCARTAR(postRequest("descartar", { leadIds: ["A"] }))).status).toBe(401);
    expect(
      (await DESCARTAR(postRequest("descartar", { leadIds: ["A"] }, await membro()))).status,
    ).toBe(403);

    expect((await getLead(db, "A"))?.descartado).toBeUndefined();
  });

  it("marca descartado, some da lista e devolve a lista nova", async () => {
    semearLead("A");
    semearLead("B");

    const res = await DESCARTAR(
      postRequest("descartar", { leadIds: ["A"], corte: CORTE }, await admin()),
    );

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.descartados).toBe(1);
    expect(corpo.linhas.map((l: { leadId: string }) => l.leadId)).toEqual(["B"]);
    // O lead continua inteiro na base — só saiu do caminho.
    const lead = await getLead(db, "A");
    expect(lead).toBeDefined();
    expect(lead?.descartado).toBe(true);
    expect(lead?.status).toBe("novo");
  });

  it("lote acima do teto → 400, nunca um corte calado", async () => {
    const leadIds = Array.from({ length: SEM_VESTIGIO_LOTE_MAX + 1 }, (_, i) => `L${i}`);
    for (const id of leadIds) semearLead(id);

    const res = await DESCARTAR(postRequest("descartar", { leadIds }, await admin()));

    expect(res.status).toBe(400);
    expect((await getLead(db, "L0"))?.descartado).toBeUndefined();
  });

  it("corpo sem leadIds → 400", async () => {
    const res = await DESCARTAR(postRequest("descartar", {}, await admin()));
    expect(res.status).toBe(400);
  });
});

describe("POST .../excluir", () => {
  it("sem sessão → 401; membro → 403, e o lead continua de pé", async () => {
    semearLead("A");

    expect((await EXCLUIR(postRequest("excluir", { leadIds: ["A"] }))).status).toBe(401);
    expect(
      (await EXCLUIR(postRequest("excluir", { leadIds: ["A"] }, await membro()))).status,
    ).toBe(403);

    expect(await getLead(db, "A")).toBeDefined();
  });

  it("remove o doc do lead E o de filaEnvios, e limpa o Storage do lead", async () => {
    semearLead("A");
    semearEnvio("A");
    semearLead("B");
    arquivos.add("demos/A/hero-1.webp");
    arquivos.add("capturas/A/hero-celular.png");
    arquivos.add("demos/B/hero-1.webp");

    const res = await EXCLUIR(
      postRequest("excluir", { leadIds: ["A"], corte: CORTE }, await admin()),
    );

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo).toMatchObject({ excluidos: 1, filaEnviosRemovidos: 1, storageFalhou: 0 });
    expect(await getLead(db, "A")).toBeUndefined();
    expect((await db.collection("filaEnvios").doc("A").get()).exists).toBe(false);
    expect([...arquivos]).toEqual(["demos/B/hero-1.webp"]);
    // E a lista nova já não tem o excluído.
    expect(corpo.linhas.map((l: { leadId: string }) => l.leadId)).toEqual(["B"]);
  });

  it("lote acima do teto → 400, sem destruir nada", async () => {
    const leadIds = Array.from({ length: SEM_VESTIGIO_LOTE_MAX + 1 }, (_, i) => `L${i}`);
    for (const id of leadIds) semearLead(id);

    const res = await EXCLUIR(postRequest("excluir", { leadIds }, await admin()));

    expect(res.status).toBe(400);
    expect(await getLead(db, "L0")).toBeDefined();
  });
});
