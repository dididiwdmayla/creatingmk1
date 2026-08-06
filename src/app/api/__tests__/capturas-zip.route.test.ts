import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../leads/[id]/capturas/zip/route";

/**
 * O pacote das capturas. O que importa aqui é o recorte — qual grupo, qual
 * versão — e o que acontece quando a versão pedida não existe: o pacote
 * NUNCA cai calado na outra versão.
 */

let db: FakeFirestore;
let buscadas: string[];

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const IMAGENS = [
  {
    ancora: "hero",
    tela: "celular",
    ordem: 1,
    url: "https://storage/hero-c.png",
    largura: 780,
    altura: 1688,
    composta: { url: "https://storage/hero-c-moldura.png", largura: 960, altura: 1934 },
  },
  {
    ancora: "servicos",
    tela: "celular",
    ordem: 2,
    url: "https://storage/servicos-c.png",
    largura: 780,
    altura: 2400,
    // De propósito SEM moldura: é a rodada em que a composição falhou.
    },
  {
    ancora: "hero",
    tela: "desktop",
    ordem: 1,
    url: "https://storage/hero-d.png",
    largura: 1440,
    altura: 900,
    composta: { url: "https://storage/hero-d-moldura.png", largura: 1550, altura: 1059 },
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
    return new Response(new TextEncoder().encode(`bytes de ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sessao = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

async function baixar(query: string, cookie?: string) {
  return GET(
    new Request(`http://localhost/api/leads/lead-1/capturas/zip${query}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ id: "lead-1" }) },
  );
}

describe("GET /api/leads/[id]/capturas/zip", () => {
  it("sem sessão, 401 — o pacote é trabalho interno", async () => {
    seedLead();
    expect((await baixar("?tela=tudo")).status).toBe(401);
  });

  it("empacota o grupo pedido, na versão crua", async () => {
    seedLead();
    const r = await baixar("?tela=celular&versao=crua", await sessao());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("x-capturas-empacotadas")).toBe("2");
    await r.arrayBuffer();
    expect(buscadas).toEqual(["https://storage/hero-c.png", "https://storage/servicos-c.png"]);
  });

  it("busca as imagens ao TRANSMITIR, não ao montar a resposta", async () => {
    seedLead();
    const r = await baixar("?tela=tudo&versao=crua", await sessao());
    // Antes de alguém ler o corpo, o pacote inteiro ainda não foi buscado
    // — é o que impede as seis capturas de ficarem na memória de uma vez.
    expect(buscadas.length).toBeLessThan(3);
    await r.arrayBuffer();
    expect(buscadas.length).toBe(3);
  });

  it("o nome do pacote sai do nome do negócio, não do id do lugar", async () => {
    seedLead();
    const r = await baixar("?tela=desktop&versao=moldura", await sessao());
    expect(r.headers.get("content-disposition")).toContain(
      'filename="barbearia-norte-desktop-moldura.zip"',
    );
  });

  it("as duas telas juntas quando o grupo é 'tudo'", async () => {
    seedLead();
    const r = await baixar("?tela=tudo&versao=crua", await sessao());
    expect(r.headers.get("x-capturas-empacotadas")).toBe("3");
  });

  it("captura sem moldura fica de fora — o pacote não cai calado na crua", async () => {
    seedLead();
    const r = await baixar("?tela=celular&versao=moldura", await sessao());
    expect(r.headers.get("x-capturas-empacotadas")).toBe("1");
    await r.arrayBuffer();
    expect(buscadas).toEqual(["https://storage/hero-c-moldura.png"]);
  });

  it("nenhuma imagem na versão pedida é 404 com o motivo, não um zip vazio", async () => {
    db = new FakeFirestore();
    db.seed("leads/lead-1", {
      placeId: "lead-1",
      nome: "Sem moldura",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
      capturas: {
        estado: "pronto",
        execucaoId: "e",
        pedidoEm: "2026-07-01T00:00:00.000Z",
        imagens: [IMAGENS[1]],
      },
    });
    const r = await baixar("?tela=celular&versao=moldura", await sessao());
    expect(r.status).toBe(404);
    expect((await r.json()).error.message).toContain("moldura");
  });

  it("lead sem capturas nenhuma é 404", async () => {
    seedLead(false);
    expect((await baixar("?tela=tudo", await sessao())).status).toBe(404);
  });

  it("o corpo transmitido é um ZIP que um descompactador abre", async () => {
    seedLead();
    const r = await baixar("?tela=celular&versao=crua", await sessao());
    const zip = Buffer.from(await r.arrayBuffer());

    const dir = mkdtempSync(join(tmpdir(), "zip-rota-"));
    const caminho = join(dir, "p.zip");
    writeFileSync(caminho, zip);
    const listagem = spawnSync("unzip", ["-l", caminho], { encoding: "utf8" });
    if (listagem.error) return; // ambiente sem `unzip`
    expect(listagem.status).toBe(0);
    expect(listagem.stdout).toContain("barbearia-norte-celular-01-hero.png");
    expect(listagem.stdout).toContain("barbearia-norte-celular-02-servicos.png");
  });
});
