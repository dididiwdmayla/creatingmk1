import { describe, expect, it } from "vitest";

import { SKINS } from "@/lib/demos/registry";
import {
  ANCORAS_PADRAO,
  CAPTURAS_MAX_ANCORAS,
  SECOES_POR_SKIN,
  ancorasEfetivas,
  secaoExiste,
  validarAncoras,
} from "../ancoras";

/**
 * CONTRATO contra o registro. `ancoras.ts` repete a lista de skins de
 * propósito (para não arrastar os componentes React das 8 skins pro bundle
 * de toda rota que importa lib/config — ver o cabeçalho de lá). O preço
 * dessa escolha é drift, e é este bloco que cobra: skin nova no registro
 * sem âncora padrão reprova aqui, não em produção na hora de mandar o
 * print pro lead.
 */
describe("contrato com o registro de skins", () => {
  it("cobre exatamente as skins do registro, sem sobra nem falta", () => {
    expect(Object.keys(SECOES_POR_SKIN).sort()).toEqual(SKINS.map((s) => s.id).sort());
    expect(Object.keys(ANCORAS_PADRAO).sort()).toEqual(SKINS.map((s) => s.id).sort());
  });

  it("o contrato de seções de cada skin é o MESMO objeto do registro", () => {
    for (const skin of SKINS) {
      expect(SECOES_POR_SKIN[skin.id]).toBe(skin.secoes);
    }
  });

  it("toda âncora padrão existe no contrato da sua skin", () => {
    for (const skin of SKINS) {
      const ids = skin.secoes.map((secao) => secao.id);
      for (const ancora of ANCORAS_PADRAO[skin.id]) {
        expect(ids, `${skin.id} → ${ancora}`).toContain(ancora);
      }
    }
  });

  it("nenhuma skin passa do teto de âncoras nem repete seção", () => {
    for (const [skinId, ancoras] of Object.entries(ANCORAS_PADRAO)) {
      expect(ancoras.length, skinId).toBeLessThanOrEqual(CAPTURAS_MAX_ANCORAS);
      expect(new Set(ancoras).size, skinId).toBe(ancoras.length);
    }
  });

  /**
   * O hero é a única seção que TODA skin tem (é a `fixa` de abertura) e é a
   * primeira impressão da marca — o padrão aprovado abre por ele em todas.
   */
  it("toda skin abre pelo hero", () => {
    for (const [skinId, ancoras] of Object.entries(ANCORAS_PADRAO)) {
      expect(ancoras[0], skinId).toBe("hero");
    }
  });
});

describe("secaoExiste", () => {
  it("reconhece seção do contrato e recusa id inventado", () => {
    expect(secaoExiste("barbearia-editorial", "servicos")).toBe(true);
    expect(secaoExiste("barbearia-editorial", "cardapio")).toBe(false);
    expect(secaoExiste("skin-que-nao-existe", "hero")).toBe(false);
  });
});

describe("validarAncoras", () => {
  function problemasDe(valor: unknown): string[] {
    const problemas: string[] = [];
    validarAncoras(valor, "capturas.ancoras", problemas);
    return problemas;
  }

  it("aceita marcação válida", () => {
    expect(problemasDe({ "barbearia-editorial": ["hero", "servicos"] })).toEqual([]);
  });

  it("aceita lista vazia (desliga a captura da skin)", () => {
    expect(problemasDe({ "barbearia-editorial": [] })).toEqual([]);
  });

  it("recusa o que não é objeto", () => {
    expect(problemasDe(["hero"])).toHaveLength(1);
    expect(problemasDe(null)).toHaveLength(1);
    expect(problemasDe("hero")).toHaveLength(1);
  });

  it("recusa skin desconhecida (typo no id)", () => {
    const problemas = problemasDe({ "barbearia-editoral": ["hero"] });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("não é uma skin conhecida");
  });

  it("recusa seção que não existe naquela skin", () => {
    const problemas = problemasDe({ "barbearia-editorial": ["cardapio"] });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('"cardapio" não é uma seção de barbearia-editorial');
  });

  it("recusa mais de três âncoras", () => {
    const problemas = problemasDe({
      "barbearia-editorial": ["hero", "servicos", "equipe", "contato"],
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("no máximo 3");
  });

  it("recusa seção repetida", () => {
    const problemas = problemasDe({ "barbearia-editorial": ["hero", "hero"] });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("está repetida");
  });

  it("acumula problemas de várias skins numa passada só", () => {
    expect(
      problemasDe({
        "barbearia-editorial": ["cardapio"],
        "lancheria-chapa-burger": ["hero", 42],
        inexistente: ["hero"],
      }),
    ).toHaveLength(3);
  });
});

describe("ancorasEfetivas", () => {
  it("sem marcação salva, cai no padrão da skin", () => {
    expect(ancorasEfetivas(undefined, "barbearia-editorial")).toEqual(
      ANCORAS_PADRAO["barbearia-editorial"],
    );
    expect(ancorasEfetivas({}, "tatuagem-editorial")).toEqual(ANCORAS_PADRAO["tatuagem-editorial"]);
  });

  it("marcação salva vence o padrão, na ordem marcada", () => {
    expect(
      ancorasEfetivas({ "barbearia-editorial": ["contato", "hero"] }, "barbearia-editorial"),
    ).toEqual(["contato", "hero"]);
  });

  it("lista vazia salva significa mesmo nenhuma captura", () => {
    expect(ancorasEfetivas({ "barbearia-editorial": [] }, "barbearia-editorial")).toEqual([]);
  });

  /**
   * Dado velho não pode derrubar a rodada: uma seção removida do contrato
   * da skin depois da marcação faria o motor procurar por um
   * `[data-d-secao]` que não existe mais.
   */
  it("descarta silenciosamente seção que a skin não tem mais", () => {
    expect(
      ancorasEfetivas({ "barbearia-editorial": ["hero", "secao-aposentada"] }, "barbearia-editorial"),
    ).toEqual(["hero"]);
  });

  it("recorta ao teto e tira repetida, mesmo se o doc vier torto", () => {
    expect(
      ancorasEfetivas(
        { "barbearia-editorial": ["hero", "hero", "servicos", "equipe", "contato"] },
        "barbearia-editorial",
      ),
    ).toEqual(["hero", "servicos", "equipe"]);
  });

  it("skin fora do registro devolve lista vazia em vez de estourar", () => {
    expect(ancorasEfetivas({}, "skin-que-nao-existe")).toEqual([]);
  });
});
