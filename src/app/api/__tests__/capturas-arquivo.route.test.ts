import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../leads/[id]/capturas/arquivo/route";

/**
 * A rota que serve UMA captura pela origem do Radar. Ela existe por causa
 * de CORS (sem ela não há `fetch`, sem `fetch` não há `File`, e sem `File`
 * não há folha nativa) — então o que se cobra aqui é o recorte, o nome
 * legível no cabeçalho e a recusa de servir versão que não existe.
 */

let db: FakeFirestore;
let buscadas: string[];

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const IMAGENS = [
  {
    ancora: "hero",
    tela: "celular",
    ordem: 1,
    url: "https://storage/hero-c.png?v=1",
    largura: 780,
    altura: 1688,
    composta: { url: "https://storage/hero-c-moldura.png?v=1", largura: 910, altura: 1818 },
  },
  {
    ancora: "servicos",
    tela: "celular",
    ordem: 2,
    url: "https://storage/servicos-c.png?v=1",
    largura: 780,
    altura: 3224,
    // De propósito SEM moldura: é a rodada em que a composição falhou.
  },
];

function seedLead(comCapturas = true) {
  db.seed("leads/lead-1", {
    placeId: "lead-1",
    nome: "Barbearia Norte",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...(comCapturas
      ? {
          capturas: {
            estado: "pronto",
            execucaoId: "exec-1",
            pedidoEm: "2026-07-01T00:00:00.000Z",
            imagens: IMAGENS,
          },
        }
      : {}),
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  buscadas = [];
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubGlobal("fetch", async (url: string) => {
    buscadas.push(String(url));
    return new Response(new TextEncoder().encode("png"), {
      headers: { "content-type": "image/png" },
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sessao = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

async function pegar(query: string, cookie?: string) {
  return GET(
    new Request(`http://localhost/api/leads/lead-1/capturas/arquivo${query}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ id: "lead-1" }) },
  );
}

describe("GET /api/leads/[id]/capturas/arquivo", () => {
  it("sem sessão, 401", async () => {
    seedLead();
    expect((await pegar("?tela=celular&ancora=hero")).status).toBe(401);
  });

  it("serve a versão crua com nome legível no cabeçalho", async () => {
    seedLead();
    const r = await pegar("?tela=celular&ancora=hero&versao=crua", await sessao());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="barbearia-norte-celular-01-hero.png"',
    );
    expect(buscadas).toEqual(["https://storage/hero-c.png?v=1"]);
  });

  it("serve a versão com moldura quando pedida", async () => {
    seedLead();
    const r = await pegar("?tela=celular&ancora=hero&versao=moldura", await sessao());
    expect(r.headers.get("content-disposition")).toContain("-hero-moldura.png");
    expect(buscadas).toEqual(["https://storage/hero-c-moldura.png?v=1"]);
  });

  it("versão que não existe é 404 com o motivo — nunca a outra no lugar", async () => {
    seedLead();
    const r = await pegar("?tela=celular&ancora=servicos&versao=moldura", await sessao());
    expect(r.status).toBe(404);
    expect((await r.json()).error.message).toContain("moldura");
    expect(buscadas).toEqual([]);
  });

  it("âncora que não saiu nesta rodada é 404", async () => {
    seedLead();
    expect((await pegar("?tela=desktop&ancora=hero", await sessao())).status).toBe(404);
  });

  it("tela inválida é erro de validação, não um 500", async () => {
    seedLead();
    expect((await pegar("?tela=relogio&ancora=hero", await sessao())).status).toBe(400);
  });

  it("lead sem capturas é 404", async () => {
    seedLead(false);
    expect((await pegar("?tela=celular&ancora=hero", await sessao())).status).toBe(404);
  });
});
