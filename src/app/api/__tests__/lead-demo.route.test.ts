import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { salvarImagemDemo } from "@/lib/demos/imagens";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { cookieDeSessao } from "@/lib/testing/sessao";
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
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function put(id: string, body: unknown, cookie?: string): Promise<Response> {
  return PUT(
    new Request(`http://localhost/api/leads/${id}/demo`, {
      method: "PUT",
      ...(cookie && { headers: { cookie } }),
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

  it("salva tema com intro/hover/clique/fundoEfeito; valores inválidos → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      tema: { intro: false, hover: "brilho", clique: "pulso", fundoEfeito: "gradiente" },
    });

    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.tema).toEqual({
      intro: false,
      hover: "brilho",
      clique: "pulso",
      fundoEfeito: "gradiente",
    });

    const ruim = await put("A", {
      ...VALIDO,
      tema: { intro: "sim", hover: "girar", clique: "explodir", fundoEfeito: "chuva" },
    });
    expect(ruim.status).toBe(400);
    const { error } = await ruim.json();
    const texto = error.problemas.join(" | ");
    expect(texto).toContain("tema.intro");
    expect(texto).toContain("tema.hover");
    expect(texto).toContain("tema.clique");
    expect(texto).toContain("tema.fundoEfeito");
  });

  it("salva fundoEfeitoIntensidade (0-3); fora da faixa → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      tema: { fundoEfeito: "particulas", fundoEfeitoIntensidade: 3 },
    });
    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.tema).toEqual({ fundoEfeito: "particulas", fundoEfeitoIntensidade: 3 });

    const ruim = await put("A", {
      ...VALIDO,
      tema: { fundoEfeitoIntensidade: 4 },
    });
    expect(ruim.status).toBe(400);
    const { error } = await ruim.json();
    expect(error.problemas.join(" | ")).toContain("tema.fundoEfeitoIntensidade");
  });

  it("salva auraCores (custom ou preset 'fumaca-colorida'); valores inválidos → 400", async () => {
    const custom = await put("A", {
      ...VALIDO,
      tema: { fundoEfeito: "aura", auraCores: { primaria: "#ff00aa", secundaria: "#00ffaa" } },
    });
    expect(custom.status).toBe(200);
    const { lead: leadCustom } = await custom.json();
    expect(leadCustom.demo.tema).toEqual({
      fundoEfeito: "aura",
      auraCores: { primaria: "#ff00aa", secundaria: "#00ffaa" },
    });

    const preset = await put("A", {
      ...VALIDO,
      tema: { fundoEfeito: "aura", auraCores: "fumaca-colorida" },
    });
    expect(preset.status).toBe(200);
    const { lead: leadPreset } = await preset.json();
    expect(leadPreset.demo.tema).toEqual({ fundoEfeito: "aura", auraCores: "fumaca-colorida" });

    const corInvalida = await put("A", {
      ...VALIDO,
      tema: { auraCores: { primaria: "não-é-hex" } },
    });
    expect(corInvalida.status).toBe(400);
    const { error: errorCor } = await corInvalida.json();
    expect(errorCor.problemas.join(" | ")).toContain("tema.auraCores.primaria");

    const chaveDesconhecida = await put("A", {
      ...VALIDO,
      tema: { auraCores: { terciaria: "#000000" } },
    });
    expect(chaveDesconhecida.status).toBe(400);
    const { error: errorChave } = await chaveDesconhecida.json();
    expect(errorChave.problemas.join(" | ")).toContain("tema.auraCores.terciaria");

    const valorInvalido = await put("A", {
      ...VALIDO,
      tema: { auraCores: "fumaca-cinza" },
    });
    expect(valorInvalido.status).toBe(400);
    const { error: errorValor } = await valorInvalido.json();
    expect(errorValor.problemas.join(" | ")).toContain("tema.auraCores");
  });

  it("salva secoes.X.animacao (booleano, seção fixa inclusive); não-booleano → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      dados: { secoes: { hero: { animacao: false }, filosofia: { animacao: true } } },
    });
    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.dados.secoes).toEqual({
      hero: { animacao: false },
      filosofia: { animacao: true },
    });

    const ruim = await put("A", {
      ...VALIDO,
      dados: { secoes: { hero: { animacao: "sim" } } },
    });
    expect(ruim.status).toBe(400);
    expect((await ruim.json()).error.problemas.join(" | ")).toContain(
      "dados.secoes.hero.animacao",
    );
  });

  it("salva ledEstilo (a chave existia na validação mas faltava na lista de conhecidas)", async () => {
    const ok = await put("A", { ...VALIDO, tema: { led: "marcante", ledEstilo: "moldura" } });
    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.tema).toEqual({ led: "marcante", ledEstilo: "moldura" });

    const ruim = await put("A", { ...VALIDO, tema: { ledEstilo: "neon" } });
    expect(ruim.status).toBe(400);
    const { error } = await ruim.json();
    expect(error.problemas.join(" | ")).toContain("tema.ledEstilo");
  });

  it("salva os modos de cor do efeito e do LED; valores inválidos → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      tema: {
        fundoEfeito: "particulas",
        efeitoCores: { modo: "transicao", cores: ["#ff00aa", "#00ffaa"] },
        ledCores: { modo: "arco-iris" },
      },
    });
    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.tema).toEqual({
      fundoEfeito: "particulas",
      efeitoCores: { modo: "transicao", cores: ["#ff00aa", "#00ffaa"] },
      ledCores: { modo: "arco-iris" },
    });

    const modoRuim = await put("A", { ...VALIDO, tema: { efeitoCores: { modo: "neon" } } });
    expect(modoRuim.status).toBe(400);
    expect((await modoRuim.json()).error.problemas.join(" | ")).toContain("tema.efeitoCores.modo");

    const corRuim = await put("A", {
      ...VALIDO,
      tema: { ledCores: { modo: "fixa", cores: ["azul"] } },
    });
    expect(corRuim.status).toBe(400);
    expect((await corRuim.json()).error.problemas.join(" | ")).toContain("tema.ledCores.cores[0]");

    const demais = await put("A", {
      ...VALIDO,
      tema: { efeitoCores: { modo: "transicao", cores: ["#111111", "#222222", "#333333", "#444444"] } },
    });
    expect(demais.status).toBe(400);
    expect((await demais.json()).error.problemas.join(" | ")).toContain("no máximo 3 cores");
  });

  it("salva o modo da cor da barra do navegador; valores inválidos → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      tema: { barraCor: { modo: "personalizada", cor: "#0a1b2c" } },
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).lead.demo.tema).toEqual({
      barraCor: { modo: "personalizada", cor: "#0a1b2c" },
    });

    const modoRuim = await put("A", { ...VALIDO, tema: { barraCor: { modo: "tema" } } });
    expect(modoRuim.status).toBe(400);
    expect((await modoRuim.json()).error.problemas.join(" | ")).toContain("tema.barraCor.modo");

    const corRuim = await put("A", {
      ...VALIDO,
      tema: { barraCor: { modo: "personalizada", cor: "azul" } },
    });
    expect(corRuim.status).toBe(400);
    expect((await corRuim.json()).error.problemas.join(" | ")).toContain("tema.barraCor.cor");

    // "personalizada" sem cor é rejeitado no PUT (e não silenciosamente
    // salvo pra virar um seletor vazio no próximo Editar).
    const semCor = await put("A", { ...VALIDO, tema: { barraCor: { modo: "personalizada" } } });
    expect(semCor.status).toBe(400);

    const chaveRuim = await put("A", {
      ...VALIDO,
      tema: { barraCor: { modo: "fundo", opacidade: 0.5 } },
    });
    expect(chaveRuim.status).toBe(400);
    expect((await chaveRuim.json()).error.problemas.join(" | ")).toContain("chave desconhecida");
  });

  it("salva heroTitulo (fonte/escala/alinhamento) e led; valores inválidos → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      tema: { heroTitulo: { fonte: "playfair", escala: 1.1, alinhamento: "centro" }, led: "marcante" },
    });

    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.tema).toEqual({
      heroTitulo: { fonte: "playfair", escala: 1.1, alinhamento: "centro" },
      led: "marcante",
    });

    const ruim = await put("A", {
      ...VALIDO,
      tema: {
        heroTitulo: { fonte: "lora", escala: "grande", alinhamento: "no-meio" },
        led: "piscando",
      },
    });
    expect(ruim.status).toBe(400);
    const texto = (await ruim.json()).error.problemas.join(" | ");
    // "lora" é papel "corpo", não "display" — inválida pro título hero.
    expect(texto).toContain("tema.heroTitulo.fonte");
    expect(texto).toContain("tema.heroTitulo.escala");
    expect(texto).toContain("tema.heroTitulo.alinhamento");
    expect(texto).toContain("tema.led");
  });

  it("dados.videos: opt-in por skin (SkinDefinition.videoSlots)", async () => {
    const comVideo = await put("A", {
      skinId: "tatuagem-editorial",
      themeId: "sangue",
      dados: { videos: { titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4" } },
    });
    expect(comVideo.status).toBe(200);
    const { lead } = await comVideo.json();
    expect(lead.demo.dados.videos).toEqual({
      titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4",
    });

    const slotDesconhecido = await put("A", {
      skinId: "tatuagem-editorial",
      themeId: "sangue",
      dados: { videos: { rodape: "https://storage.googleapis.com/b/demos/A/video-rodape-1.mp4" } },
    });
    expect(slotDesconhecido.status).toBe(400);
    expect((await slotDesconhecido.json()).error.problemas.join(" ")).toContain(
      "não oferece vídeo-no-título",
    );

    // Barbearia não declara videoSlots: qualquer vídeo é rejeitado.
    const semSuporte = await put("A", {
      ...VALIDO,
      dados: { videos: { titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4" } },
    });
    expect(semSuporte.status).toBe(400);
  });

  it("salva animacaoEntrada por seção onde a skin oferece; inválida → 400", async () => {
    const ok = await put("A", {
      ...VALIDO,
      dados: {
        secoes: {
          filosofia: { animacaoEntrada: "deslizar-esquerda" },
          servicos: { animacaoEntrada: "fade" },
        },
      },
    });

    expect(ok.status).toBe(200);
    const { lead } = await ok.json();
    expect(lead.demo.dados.secoes.filosofia.animacaoEntrada).toBe("deslizar-esquerda");

    // Serviços tem sticky interno: a skin NÃO oferece deslizar ali.
    const semSuporte = await put("A", {
      ...VALIDO,
      dados: { secoes: { servicos: { animacaoEntrada: "deslizar-direita" } } },
    });
    expect(semSuporte.status).toBe(400);
    expect((await semSuporte.json()).error.problemas.join(" ")).toContain(
      "servicos.animacaoEntrada",
    );

    const desconhecida = await put("A", {
      ...VALIDO,
      dados: { secoes: { filosofia: { animacaoEntrada: "girar" } } },
    });
    expect(desconhecida.status).toBe(400);
  });

  it("registra criadoPor no primeiro save e preserva nas edições seguintes", async () => {
    const cookieAna = await cookieDeSessao(db, { id: "ana", papel: "membro" });
    const cookieAdmin = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await put("A", VALIDO, cookieAna);
    expect(db.getDoc("leads/A")?.demo).toMatchObject({ criadoPor: "ana" });

    // Edição por outro usuário não rouba a autoria do primeiro save.
    await put("A", { ...VALIDO, dados: { nome: "Zé Premium" } }, cookieAdmin);
    expect(db.getDoc("leads/A")?.demo).toMatchObject({ criadoPor: "ana" });
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
