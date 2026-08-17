import { beforeEach, describe, expect, it } from "vitest";

import { envioVigente } from "@/lib/demos/envio";
import { NotFoundError } from "@/lib/errors";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { idiomaEfetivoAvulsa, idiomaPadraoDaAvulsa, moedaDaAvulsa } from "../idioma";
import {
  atualizarVisitaAvulsa,
  criarDemoAvulsa,
  deleteDemoAvulsa,
  garantirEnvioTokenAvulsa,
  getDemoAvulsa,
  listDemosAvulsas,
  registrarVisitaAvulsa,
  removeImagemAvulsa,
  removeVideoAvulsa,
  salvarPaisAvulsa,
  saveDemoAvulsa,
} from "../repo";
import { DEMOS_AVULSAS_COLLECTION } from "../types";

let db: FakeFirestore;

const CONFIG = { skinId: "barbearia-editorial", themeId: "creme" };

beforeEach(() => {
  db = new FakeFirestore();
});

async function criar(nome = "Barbearia do Zé", extra = {}) {
  return criarDemoAvulsa(db, { nome, ...extra }, CONFIG, new Date("2026-08-01T10:00:00.000Z"), "u1");
}

describe("criarDemoAvulsa", () => {
  it("grava a identidade digitada como patch de conteúdo", async () => {
    const avulsa = await criar("Barbearia do Zé", { cidade: "Maringá - PR", telefone: "(44) 3222-1111" });
    expect(avulsa.demo.dados.nome).toBe("Barbearia do Zé");
    expect(avulsa.demo.dados.cidade).toBe("Maringá - PR");
    expect(avulsa.demo.dados.telefone).toBe("(44) 3222-1111");
    expect(avulsa.demo.dados.secoes?.hero?.titulo).toBe("Barbearia do Zé");
  });

  it("não grava campo de identidade não digitado", async () => {
    const avulsa = await criar();
    expect(avulsa.demo.dados.instagram).toBeUndefined();
    expect(avulsa.demo.dados.whatsapp).toBeUndefined();
  });

  it("nasce com token vigente dos dois canais", async () => {
    const { demo } = await criar();
    expect(envioVigente(demo, "link")).toBeDefined();
    expect(envioVigente(demo, "whatsapp")).toBeDefined();
  });

  it("carimba autor e datas", async () => {
    const avulsa = await criar();
    expect(avulsa.criadoPor).toBe("u1");
    expect(avulsa.demo.criadoPor).toBe("u1");
    expect(avulsa.criadoEm).toBe("2026-08-01T10:00:00.000Z");
  });

  it("persiste e relê pelo id", async () => {
    const avulsa = await criar();
    expect(await getDemoAvulsa(db, avulsa.id)).toEqual(avulsa);
  });

  it("guarda o país só quando digitado", async () => {
    expect((await criar("A", { pais: "Portugal" })).pais).toBe("Portugal");
    expect((await criar("B", { pais: "  " })).pais).toBeUndefined();
    expect((await criar("C")).pais).toBeUndefined();
  });

  it("aceita overrides de tema/conteúdo do diálogo", async () => {
    const avulsa = await criarDemoAvulsa(db, { nome: "X" }, {
      ...CONFIG,
      dados: { imagensModo: "grafico" },
      tema: { fundoEfeito: "gradiente" },
    });
    expect(avulsa.demo.dados.imagensModo).toBe("grafico");
    expect(avulsa.demo.tema?.fundoEfeito).toBe("gradiente");
  });
});

describe("listDemosAvulsas", () => {
  it("devolve as mais recentes primeiro", async () => {
    await criarDemoAvulsa(db, { nome: "Velha" }, CONFIG, new Date("2026-01-01T00:00:00.000Z"));
    await criarDemoAvulsa(db, { nome: "Nova" }, CONFIG, new Date("2026-08-01T00:00:00.000Z"));
    expect((await listDemosAvulsas(db)).map((a) => a.demo.dados.nome)).toEqual(["Nova", "Velha"]);
  });

  it("lista vazia sem nenhuma avulsa", async () => {
    expect(await listDemosAvulsas(db)).toEqual([]);
  });
});

describe("saveDemoAvulsa", () => {
  it("preserva criadoEm/criadoPor e atualiza o resto", async () => {
    const avulsa = await criar();
    const salva = await saveDemoAvulsa(
      db,
      avulsa.id,
      { skinId: "barbearia-editorial", themeId: "carvao", dados: { slogan: "Novo." } },
      new Date("2026-08-02T10:00:00.000Z"),
    );
    expect(salva.demo.criadoEm).toBe("2026-08-01T10:00:00.000Z");
    expect(salva.demo.criadoPor).toBe("u1");
    expect(salva.demo.themeId).toBe("carvao");
    expect(salva.demo.dados.slogan).toBe("Novo.");
    expect(salva.demo.atualizadoEm).toBe("2026-08-02T10:00:00.000Z");
  });

  it("preserva os tokens de envio já gerados", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "link")!.token;
    const salva = await saveDemoAvulsa(db, avulsa.id, { ...CONFIG, dados: {} });
    expect(envioVigente(salva.demo, "link")!.token).toBe(token);
  });

  it("404 em id inexistente", async () => {
    await expect(saveDemoAvulsa(db, "nao-existe", { ...CONFIG, dados: {} })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("visitas", () => {
  it("sem token não registra visita", async () => {
    const avulsa = await criar();
    const { visitaId } = await registrarVisitaAvulsa(db, avulsa.id, { interna: false });
    expect(visitaId).toBeUndefined();
    expect((await getDemoAvulsa(db, avulsa.id))!.demoVisitas).toBeUndefined();
  });

  it("visita externa com o token vigente consome o envio e gira o token", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "link")!.token;

    const { avulsa: depois, visitaId } = await registrarVisitaAvulsa(db, avulsa.id, {
      token,
      interna: false,
    });
    expect(visitaId).toBeDefined();
    expect(depois.demoVisitas).toHaveLength(1);
    expect(depois.demoVisitas![0].canal).toBe("link");
    expect(envioVigente(depois.demo, "link")!.token).not.toBe(token);
    // O token velho continua no histórico — revisita ainda resolve o envio.
    expect(depois.demo.envios!.some((e) => e.token === token)).toBe(true);
  });

  it("visita interna registra mas NÃO queima o token", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "whatsapp")!.token;

    const { avulsa: depois } = await registrarVisitaAvulsa(db, avulsa.id, { token, interna: true });
    expect(depois.demoVisitas![0].interna).toBe(true);
    expect(envioVigente(depois.demo, "whatsapp")!.token).toBe(token);
  });

  it("um canal não queima o token do outro", async () => {
    const avulsa = await criar();
    const tokenWpp = envioVigente(avulsa.demo, "whatsapp")!.token;

    const { avulsa: depois } = await registrarVisitaAvulsa(db, avulsa.id, {
      token: envioVigente(avulsa.demo, "link")!.token,
      interna: false,
    });
    expect(envioVigente(depois.demo, "whatsapp")!.token).toBe(tokenWpp);
  });

  it("o beacon completa duração e scroll da visita", async () => {
    const avulsa = await criar();
    const { visitaId } = await registrarVisitaAvulsa(db, avulsa.id, {
      token: envioVigente(avulsa.demo, "link")!.token,
      interna: false,
    });

    const depois = await atualizarVisitaAvulsa(db, avulsa.id, visitaId!, {
      duracaoSegundos: 42,
      scrollPercent: 80,
    });
    expect(depois!.demoVisitas![0].duracaoSegundos).toBe(42);
    expect(depois!.demoVisitas![0].scrollPercent).toBe(80);
  });

  it("o marcador de dispositivo promove a visita a interna, e nunca o contrário", async () => {
    const avulsa = await criar();
    const { visitaId } = await registrarVisitaAvulsa(db, avulsa.id, {
      token: envioVigente(avulsa.demo, "link")!.token,
      interna: false,
    });

    const promovida = await atualizarVisitaAvulsa(db, avulsa.id, visitaId!, {
      marcadorDispositivo: true,
    });
    expect(promovida!.demoVisitas![0].interna).toBe(true);

    const depois = await atualizarVisitaAvulsa(db, avulsa.id, visitaId!, {
      marcadorDispositivo: false,
    });
    expect(depois!.demoVisitas![0].interna).toBe(true);
  });

  it("beacon de visita/avulsa inexistente é no-op silencioso", async () => {
    await expect(atualizarVisitaAvulsa(db, "nao-existe", "x", {})).resolves.toBeUndefined();
    const avulsa = await criar();
    await expect(atualizarVisitaAvulsa(db, avulsa.id, "outra", {})).resolves.toBeDefined();
  });
});

describe("garantirEnvioTokenAvulsa", () => {
  it("é idempotente quando os dois canais já têm token", async () => {
    const avulsa = await criar();
    const depois = await garantirEnvioTokenAvulsa(db, avulsa.id);
    expect(depois.demo.envios).toEqual(avulsa.demo.envios);
  });

  it("gera o que faltar num doc antigo sem envios", async () => {
    const avulsa = await criar();
    await db
      .collection(DEMOS_AVULSAS_COLLECTION)
      .doc(avulsa.id)
      .set({ ...avulsa, demo: { ...avulsa.demo, envios: [] } } as never);

    const depois = await garantirEnvioTokenAvulsa(db, avulsa.id);
    expect(envioVigente(depois.demo, "link")).toBeDefined();
    expect(envioVigente(depois.demo, "whatsapp")).toBeDefined();
  });
});

describe("overrides de mídia", () => {
  it("remove o override de imagem do slot e deixa os outros", async () => {
    const avulsa = await criar();
    await saveDemoAvulsa(db, avulsa.id, {
      ...CONFIG,
      dados: { imagens: { hero: "https://s/hero.webp", equipe: "https://s/equipe.webp" } },
    });

    const depois = await removeImagemAvulsa(db, avulsa.id, "hero");
    expect(depois.demo.dados.imagens).toEqual({ equipe: "https://s/equipe.webp" });
  });

  it("remover slot sem override é no-op", async () => {
    const avulsa = await criar();
    await expect(removeImagemAvulsa(db, avulsa.id, "hero")).resolves.toBeDefined();
  });

  it("remove o override de vídeo do slot", async () => {
    const avulsa = await criar();
    await saveDemoAvulsa(db, avulsa.id, {
      ...CONFIG,
      dados: { videos: { titulo: "https://s/v.mp4" } },
    });
    expect((await removeVideoAvulsa(db, avulsa.id, "titulo")).demo.dados.videos).toEqual({});
  });
});

describe("deleteDemoAvulsa", () => {
  it("apaga o doc inteiro", async () => {
    const avulsa = await criar();
    await deleteDemoAvulsa(db, avulsa.id);
    expect(await getDemoAvulsa(db, avulsa.id)).toBeUndefined();
    expect(await listDemosAvulsas(db)).toEqual([]);
  });

  it("404 em id inexistente", async () => {
    await expect(deleteDemoAvulsa(db, "nao-existe")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("idioma e moeda vêm do país digitado", () => {
  it("país mapeado define os dois", async () => {
    const avulsa = await criar("Barbearia", { pais: "Portugal" });
    expect(idiomaPadraoDaAvulsa(avulsa)).toBe("pt-PT");
    expect(moedaDaAvulsa(avulsa)).toBe("EUR");
  });

  it("sem país cai no default", async () => {
    const avulsa = await criar();
    expect(idiomaPadraoDaAvulsa(avulsa)).toBe("pt-BR");
    expect(moedaDaAvulsa(avulsa)).toBe("BRL");
  });

  it("país plurilíngue usa a cidade digitada", async () => {
    const genebra = await criar("Coiffeur", { pais: "Suíça", cidade: "Genebra" });
    expect(idiomaPadraoDaAvulsa(genebra)).toBe("fr-CH");
    expect(moedaDaAvulsa(genebra)).toBe("CHF");

    const zurique = await criar("Coiffeur", { pais: "Suíça", cidade: "Zurique" });
    expect(idiomaPadraoDaAvulsa(zurique)).toBe("de-CH");
  });

  it("o seletor do editor sobrescreve o idioma derivado, nunca a moeda", async () => {
    const avulsa = await criar("Barbearia", { pais: "Portugal" });
    const salva = await saveDemoAvulsa(db, avulsa.id, { ...CONFIG, dados: {}, idioma: "en-US" });
    expect(idiomaEfetivoAvulsa(salva)).toBe("en-US");
    expect(moedaDaAvulsa(salva)).toBe("EUR");
  });

  it("país é editável depois da criação", async () => {
    const avulsa = await criar();
    const depois = await salvarPaisAvulsa(db, avulsa.id, "Espanha");
    expect(depois.pais).toBe("Espanha");
    expect(moedaDaAvulsa(depois)).toBe("EUR");
    expect((await salvarPaisAvulsa(db, avulsa.id, "")).pais).toBeUndefined();
  });
});
