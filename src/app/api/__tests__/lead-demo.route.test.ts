import { beforeEach, describe, expect, it, vi } from "vitest";

import { salvarImagemDemo } from "@/lib/demos/imagens";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { DELETE, PUT } from "../leads/[id]/demo/route";

let db: FakeFirestore;
let storage: FakeDemoStorage;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

beforeEach(() => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    endereco: "Av. Brasil, 100",
    status: "novo",
    enriquecido: false,
    notas: "ligar depois das 18h",
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

function put(id: string, body: unknown): Promise<Response> {
  return PUT(
    new Request(`http://localhost/api/leads/${id}/demo`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function del(id: string): Promise<Response> {
  return DELETE(new Request(`http://localhost/api/leads/${id}/demo`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

const VALIDO = {
  skinId: DEFAULT_SKIN.id,
  themeId: DEFAULT_SKIN.themeDefault.id,
  dados: { slogan: "Tradição desde 1998.", horarios: "Seg a sáb, 9h às 21h" },
};

describe("PUT /api/leads/[id]/demo", () => {
  it("salva skin, tema e overrides no campo demo do lead", async () => {
    const res = await put("A", VALIDO);

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.skinId).toBe(DEFAULT_SKIN.id);
    expect(lead.demo.themeId).toBe(DEFAULT_SKIN.themeDefault.id);
    expect(lead.demo.dados).toEqual(VALIDO.dados);
    expect(lead.demo.atualizadoEm).toBeTruthy();
    // Nada mais do lead é tocado.
    expect(lead.notas).toBe("ligar depois das 18h");
    expect(lead.status).toBe("novo");
  });

  it("aceita dados vazio/ausente (demo só com defaults do template)", async () => {
    const res = await put("A", { skinId: VALIDO.skinId, themeId: VALIDO.themeId });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.dados).toEqual({});
  });

  it("404 para lead inexistente", async () => {
    const res = await put("nao-existe", VALIDO);

    expect(res.status).toBe(404);
  });

  it("400 para skinId desconhecido", async () => {
    const res = await put("A", { ...VALIDO, skinId: "skin-fantasma" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("skinId desconhecido");
  });

  it("400 para themeId fora dos presets da skin", async () => {
    const res = await put("A", { ...VALIDO, themeId: "tema-fantasma" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("não é preset da skin");
  });

  it("400 para chave desconhecida em dados (pega typo)", async () => {
    const res = await put("A", { ...VALIDO, dados: { sloogan: "typo" } });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("dados.sloogan");
  });

  it("400 para depoimento com nota fora de 1–5", async () => {
    const res = await put("A", {
      ...VALIDO,
      dados: { depoimentos: [{ autor: "X", texto: "ok", nota: 9 }] },
    });

    expect(res.status).toBe(400);
  });

  it("regrava a demo por inteiro (PUT é substituição, não merge)", async () => {
    await put("A", VALIDO);
    const res = await put("A", {
      skinId: VALIDO.skinId,
      themeId: VALIDO.themeId,
      dados: { nome: "Zé Premium" },
    });

    const { lead } = await res.json();
    expect(lead.demo.dados).toEqual({ nome: "Zé Premium" });
  });

  it("salva tema (fontes curadas, cor primária, raio, densidade, animação)", async () => {
    const res = await put("A", {
      ...VALIDO,
      tema: {
        fonteDisplay: "playfair",
        destaque: "#8c4a2b",
        raio: "8px",
        densidade: "arejada",
        animacao: "marcante",
      },
    });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.tema).toEqual({
      fonteDisplay: "playfair",
      destaque: "#8c4a2b",
      raio: "8px",
      densidade: "arejada",
      animacao: "marcante",
    });
  });

  it("400 para tema inválido (fonte fora da lista, papel errado, cor/raio/animação inválidos)", async () => {
    const res = await put("A", {
      ...VALIDO,
      tema: {
        fonteDisplay: "comic-sans",
        fonteCorpo: "bebas", // display-only: não serve pra corpo
        destaque: "dourado",
        raio: "37px",
        densidade: "apertada",
        animacao: "exagerada",
      },
    });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    const texto = error.problemas.join(" | ");
    expect(texto).toContain("tema.fonteDisplay");
    expect(texto).toContain("tema.fonteCorpo");
    expect(texto).toContain("tema.destaque");
    expect(texto).toContain("tema.raio");
    expect(texto).toContain("tema.densidade");
    expect(texto).toContain("tema.animacao");
  });

  it("salva estrutura: ordemSecoes, oculta e alinhamento suportado", async () => {
    const ordem = DEFAULT_SKIN.secoes
      .filter((secao) => !secao.fixa)
      .map((secao) => secao.id)
      .reverse();
    const res = await put("A", {
      ...VALIDO,
      dados: {
        ordemSecoes: ordem,
        secoes: { ritual: { oculta: true }, filosofia: { alinhamento: "centro" } },
      },
    });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.dados.ordemSecoes).toEqual(ordem);
    expect(lead.demo.dados.secoes.ritual.oculta).toBe(true);
    expect(lead.demo.dados.secoes.filosofia.alinhamento).toBe("centro");
  });

  it("400 para estrutura inválida (seção fixa oculta/reordenada, alinhamento sem suporte)", async () => {
    const res = await put("A", {
      ...VALIDO,
      dados: {
        ordemSecoes: ["hero"],
        secoes: {
          hero: { oculta: true },
          contato: { alinhamento: "centro" }, // sem alignOptions na skin
          filosofia: { alinhamento: "diagonal" },
        },
      },
    });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    const texto = error.problemas.join(" | ");
    expect(texto).toContain("ordemSecoes[0]");
    expect(texto).toContain("hero.oculta");
    expect(texto).toContain("contato.alinhamento");
    expect(texto).toContain("filosofia.alinhamento");
  });
});

describe("DELETE /api/leads/[id]/demo", () => {
  it("apaga o campo demo e TODAS as imagens do lead no Storage", async () => {
    await put("A", VALIDO);
    await salvarImagemDemo(storage, "A", "hero", new Uint8Array([1]), "image/webp");
    await salvarImagemDemo(storage, "B", "hero", new Uint8Array([1]), "image/webp");

    const res = await del("A");

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo).toBeUndefined();
    expect(db.getDoc("leads/A")?.demo).toBeUndefined();
    // Imagens de OUTRO lead ficam intactas.
    expect(storage.paths()).toHaveLength(1);
    expect(storage.paths()[0]).toContain("demos/B/");
  });

  it("é idempotente: lead sem demo responde 200 do mesmo jeito", async () => {
    const res = await del("A");
    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo).toBeUndefined();
  });

  it("404 para lead inexistente", async () => {
    const res = await del("nao-existe");
    expect(res.status).toBe(404);
  });
});
