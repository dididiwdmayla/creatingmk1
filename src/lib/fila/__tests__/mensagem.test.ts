import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PenetracaoSite } from "@/lib/leads/penetracao";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { montarMensagemParaLead } from "../mensagem";

function baseLead(extra: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJlead1",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...extra,
  };
}

function seedConfigGlobal(db: FakeFirestore, mensagemPadrao: string) {
  db.seed("config/app", { mensagemPadrao });
}

function seedBuscaComGrupo(db: FakeFirestore, id: string, mensagemPadrao: string) {
  db.seed(`buscas/${id}`, { id, nicho: "barbearia", regiao: "Maringá PR", mensagemPadrao });
}

function seedSkin(db: FakeFirestore, skinId: string, frase: string) {
  db.seed(`frasesProspeccao/${skinId}`, { frases: [frase, "", ""], indice: 0 });
}

const PENETRACAO_ALTA: PenetracaoSite = {
  total: 10,
  comSiteProprio: 7,
  soRedeSocial: 2,
  semNada: 1,
  desconhecidos: 0,
  percentuais: { comSiteProprio: 70, soRedeSocial: 20, semNada: 10 },
};

beforeEach(() => {
  delete process.env.APP_PUBLIC_URL;
});

afterEach(() => {
  delete process.env.APP_PUBLIC_URL;
});

describe("montarMensagemParaLead — precedência skin → grupo → global", () => {
  it("skin vence quando a demo tem frase preenchida, mesmo com grupo e global presentes", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "global: oi {nome}");
    seedBuscaComGrupo(db, "busca-1", "grupo: oi {nome}");
    seedSkin(db, "barbearia-editorial", "skin: oi {nome}");
    const lead = baseLead({
      buscaId: ["busca-1"],
      demo: {
        skinId: "barbearia-editorial",
        themeId: "t1",
        dados: {},
        criadoEm: "2026-03-01T00:00:00.000Z",
        atualizadoEm: "2026-03-01T00:00:00.000Z",
      },
    });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("skin: oi Barbearia do Zé");
  });

  it("sem demo, cai na mensagem do GRUPO (a busca mais recente do lead que tenha uma)", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "global: oi {nome}");
    seedBuscaComGrupo(db, "busca-1", "grupo: oi {nome}");
    const lead = baseLead({ buscaId: ["busca-1"] });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("grupo: oi Barbearia do Zé");
  });

  it("sem demo e sem grupo com mensagem própria, cai na GLOBAL", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "global: oi {nome}");
    const lead = baseLead();

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("global: oi Barbearia do Zé");
  });

  it("config/app ausente também cai no default global, sem erro", async () => {
    const db = new FakeFirestore();
    const lead = baseLead();

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toContain("Barbearia do Zé");
  });
});

describe("montarMensagemParaLead — marcadores", () => {
  it("{nome} substitui pelo nome do lead", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "Oi {nome}, tudo bem?");
    const lead = baseLead({ nome: "Café Central" });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("Oi Café Central, tudo bem?");
  });

  it("{demo} vira o link público com o token vigente do canal whatsapp", async () => {
    process.env.APP_PUBLIC_URL = "https://radar.exemplo.com/"; // barra no fim: precisa ser removida
    const db = new FakeFirestore();
    seedConfigGlobal(db, "Veja: {demo}");
    const lead = baseLead({
      demo: {
        skinId: "x",
        themeId: "t1",
        dados: {},
        criadoEm: "2026-03-01T00:00:00.000Z",
        atualizadoEm: "2026-03-01T00:00:00.000Z",
        envios: [{ token: "abc123", geradoEm: "2026-03-01T00:00:00.000Z", canal: "whatsapp" }],
      },
    });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("Veja: https://radar.exemplo.com/demo/ChIJlead1?t=abc123");
  });

  it("{demo} sem APP_PUBLIC_URL configurada fica sem link (nunca inventa domínio)", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "Veja: {demo}");
    const lead = baseLead({
      demo: {
        skinId: "x",
        themeId: "t1",
        dados: {},
        criadoEm: "2026-03-01T00:00:00.000Z",
        atualizadoEm: "2026-03-01T00:00:00.000Z",
      },
    });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("Veja: {demo}");
  });

  it("{penetracao} vira o argumento pronto quando o lead não tem site próprio", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "{penetracao}");
    seedBuscaComGrupo(db, "busca-1", "");
    db.seed("buscas/busca-1", {
      id: "busca-1",
      nicho: "barbearia",
      regiao: "Maringá PR",
      penetracao: PENETRACAO_ALTA,
    });
    const lead = baseLead({ buscaId: ["busca-1"], siteProprio: false });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe(
      "70% dos estabelecimentos de barbearia em Maringá PR que mapeamos já têm site — " +
        "a Barbearia do Zé está entre os que ainda não têm.",
    );
  });

  it("{penetracao} fica sem substituir quando o lead JÁ TEM site próprio", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "{penetracao}");
    db.seed("buscas/busca-1", {
      id: "busca-1",
      nicho: "barbearia",
      regiao: "Maringá PR",
      penetracao: PENETRACAO_ALTA,
    });
    const lead = baseLead({ buscaId: ["busca-1"], siteProprio: true });

    const { texto } = await montarMensagemParaLead(db, lead);

    expect(texto).toBe("{penetracao}");
  });
});

describe("montarMensagemParaLead — normalização de telefone", () => {
  it("telefoneIntl cru (espaços, parênteses, traço) vira dígitos puros com DDI", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "oi");
    const lead = baseLead({ telefoneIntl: "+55 (44) 3222-1111" });

    const { telefone } = await montarMensagemParaLead(db, lead);

    expect(telefone).toBe("554432221111");
  });

  it("detalhes.telefoneIntl (enriquecido) tem precedência sobre o telefoneIntl da busca", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "oi");
    const lead = baseLead({
      telefoneIntl: "+55 44 0000-0000",
      detalhes: {
        enriquecidoEm: "2026-03-01T00:00:00.000Z",
        telefoneIntl: "+55 44 9999-8888",
      },
    });

    const { telefone } = await montarMensagemParaLead(db, lead);

    expect(telefone).toBe("554499998888");
  });

  it("lead sem telefone nenhum devolve telefone undefined, sem erro", async () => {
    const db = new FakeFirestore();
    seedConfigGlobal(db, "oi");
    const lead = baseLead();

    const { telefone } = await montarMensagemParaLead(db, lead);

    expect(telefone).toBeUndefined();
  });
});
