import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as getNaoLidas } from "../mensagens/nao-lidas/route";
import { GET, POST } from "../mensagens/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function sessao(id: string, papel: "admin" | "membro" = "membro"): Promise<string> {
  return cookieDeSessao(db, { id, papel });
}

function get(cookie?: string, com?: string): Promise<Response> {
  const url = `http://localhost/api/mensagens${com ? `?com=${com}` : ""}`;
  return GET(new Request(url, { ...(cookie && { headers: { cookie } }) }));
}

function post(cookie: string | undefined, body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/mensagens", {
      method: "POST",
      body: JSON.stringify(body),
      ...(cookie && { headers: { cookie } }),
    }),
  );
}

function naoLidas(cookie?: string): Promise<Response> {
  return getNaoLidas(
    new Request("http://localhost/api/mensagens/nao-lidas", {
      ...(cookie && { headers: { cookie } }),
    }),
  );
}

describe("POST /api/mensagens", () => {
  it("envia texto simples e persiste em /mensagens sem lidaEm", async () => {
    const ana = await sessao("ana");
    await sessao("beto");

    const res = await post(ana, { paraUserId: "beto", texto: "  Oi, Beto!  " });

    expect(res.status).toBe(200);
    const { mensagem } = await res.json();
    expect(mensagem).toMatchObject({
      deUserId: "ana",
      paraUserId: "beto",
      texto: "Oi, Beto!",
    });
    expect(mensagem.lidaEm).toBeUndefined();
    expect(db.getDoc(`mensagens/${mensagem.id}`)).toMatchObject({
      deUserId: "ana",
      paraUserId: "beto",
      texto: "Oi, Beto!",
    });
  });

  it("sem sessão → 401", async () => {
    const res = await post(undefined, { paraUserId: "beto", texto: "oi" });
    expect(res.status).toBe(401);
  });

  it("valida corpo: texto vazio, chave desconhecida, destinatário = remetente", async () => {
    const ana = await sessao("ana");

    expect((await post(ana, { paraUserId: "beto", texto: "  " })).status).toBe(400);
    expect((await post(ana, { paraUserId: "beto", texto: "oi", x: 1 })).status).toBe(400);
    expect((await post(ana, { paraUserId: "ana", texto: "oi" })).status).toBe(400);
    expect((await post(ana, { paraUserId: "beto", texto: "x".repeat(2001) })).status).toBe(
      400,
    );
  });

  it("destinatário inexistente → 404", async () => {
    const ana = await sessao("ana");
    const res = await post(ana, { paraUserId: "fantasma", texto: "oi" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/mensagens (resumo)", () => {
  it("lista os demais usuários, última mensagem e contagem de não-lidas", async () => {
    const ana = await sessao("ana");
    const beto = await sessao("beto");
    await sessao("carla");
    await post(beto, { paraUserId: "ana", texto: "primeira" });
    await post(beto, { paraUserId: "ana", texto: "segunda" });

    const res = await get(ana);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usuarios.map((u: { id: string }) => u.id).sort()).toEqual([
      "beto",
      "carla",
    ]);
    expect(body.totalNaoLidas).toBe(2);
    const comBeto = body.conversas.find(
      (c: { comUserId: string }) => c.comUserId === "beto",
    );
    expect(comBeto).toMatchObject({ naoLidas: 2 });
    expect(comBeto.ultimaMensagem.texto).toBe("segunda");
    const comCarla = body.conversas.find(
      (c: { comUserId: string }) => c.comUserId === "carla",
    );
    expect(comCarla).toMatchObject({ naoLidas: 0 });
    expect(comCarla.ultimaMensagem).toBeUndefined();
  });

  it("sem sessão → 401", async () => {
    expect((await get()).status).toBe(401);
  });
});

describe("GET /api/mensagens?com= (conversa)", () => {
  it("devolve as duas direções em ordem e marca as recebidas como lidas", async () => {
    const ana = await sessao("ana");
    const beto = await sessao("beto");
    await post(ana, { paraUserId: "beto", texto: "oi" });
    await post(beto, { paraUserId: "ana", texto: "olá!" });

    const res = await get(ana, "beto");

    expect(res.status).toBe(200);
    const { mensagens } = await res.json();
    expect(mensagens.map((m: { texto: string }) => m.texto)).toEqual(["oi", "olá!"]);
    // A recebida ficou lida (persistido); a enviada só quando o Beto abrir.
    expect(mensagens[1].lidaEm).toBeTruthy();
    expect(db.getDoc(`mensagens/${mensagens[1].id}`)?.lidaEm).toBeTruthy();
    expect(mensagens[0].lidaEm).toBeUndefined();

    // Depois de aberta, o badge da Ana zera.
    expect(await (await naoLidas(ana)).json()).toEqual({ total: 0 });
  });

  it("conversa é privada entre o par: terceiro (mesmo admin) não vê nada", async () => {
    const ana = await sessao("ana");
    const beto = await sessao("beto");
    const admin = await sessao("root", "admin");
    await post(ana, { paraUserId: "beto", texto: "segredo do par" });

    // Admin pedindo a conversa dos dois só recebe as mensagens DELE com
    // cada um — ou seja, nada: a rota escopa sempre pela sessão.
    const comoAdminComAna = await (await get(admin, "ana")).json();
    const comoAdminComBeto = await (await get(admin, "beto")).json();
    expect(comoAdminComAna.mensagens).toEqual([]);
    expect(comoAdminComBeto.mensagens).toEqual([]);

    // E o resumo do admin não conta segredo alheio como não-lida.
    const resumoAdmin = await (await get(admin)).json();
    expect(resumoAdmin.totalNaoLidas).toBe(0);

    // O destinatário real continua vendo normalmente.
    const conversaBeto = await (await get(beto, "ana")).json();
    expect(conversaBeto.mensagens).toHaveLength(1);
  });
});

describe("GET /api/mensagens/nao-lidas (badge)", () => {
  it("conta só as recebidas sem lidaEm", async () => {
    const ana = await sessao("ana");
    const beto = await sessao("beto");
    await post(ana, { paraUserId: "beto", texto: "1" });
    await post(beto, { paraUserId: "ana", texto: "2" });
    await post(beto, { paraUserId: "ana", texto: "3" });

    expect(await (await naoLidas(ana)).json()).toEqual({ total: 2 });
    expect(await (await naoLidas(beto)).json()).toEqual({ total: 1 });
  });

  it("sem sessão → 401", async () => {
    expect((await naoLidas()).status).toBe(401);
  });

  it("ignora docs malformados na coleção (nunca quebra)", async () => {
    const ana = await sessao("ana");
    db.seed("mensagens/lixo", { qualquer: "coisa" });

    const res = await naoLidas(ana);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 0 });
  });
});
