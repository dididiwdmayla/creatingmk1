import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  DEFAULT_CONFIG,
  loadConfig,
  pricingFromConfig,
  saveConfig,
} from "..";

const DOC = "config/app";

describe("loadConfig", () => {
  it("retorna os defaults quando o doc não existe", async () => {
    const db = new FakeFirestore();
    expect(await loadConfig(db)).toEqual(DEFAULT_CONFIG);
  });

  it("mescla doc parcial/antigo sobre os defaults", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { nicho: "dentista", caps: { detailsEnterprise: 100 } });

    const config = await loadConfig(db);

    expect(config.nicho).toBe("dentista");
    expect(config.caps.detailsEnterprise).toBe(100);
    expect(config.caps.textSearch).toBe(DEFAULT_CONFIG.caps.textSearch);
    expect(config.regiao).toBe(DEFAULT_CONFIG.regiao);
  });

  it("migração: chave legada detailsPro em caps/precos vira detailsEnterprise", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, {
      caps: { detailsPro: 42 },
      precos: {
        usdPor1000: { detailsPro: 17 },
        cotaGratis: { detailsPro: 5_000 },
      },
    });

    const config = await loadConfig(db);

    expect(config.caps.detailsEnterprise).toBe(42);
    expect(config.precos.usdPor1000.detailsEnterprise).toBe(17);
    expect(config.precos.cotaGratis.detailsEnterprise).toBe(5_000);
    // O nome legado não vaza para a config efetiva.
    expect("detailsPro" in config.caps).toBe(false);
  });

  it("migração: salvar depois de migrar regrava sem o nome legado", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { caps: { detailsPro: 42 } });

    await saveConfig(db, { nicho: "dentista" });

    const stored = db.getDoc(DOC) as { caps: Record<string, number> };
    expect(stored.caps.detailsEnterprise).toBe(42);
    expect("detailsPro" in stored.caps).toBe(false);
  });
});

describe("saveConfig", () => {
  it("aplica patch parcial e persiste o doc completo", async () => {
    const db = new FakeFirestore();

    const config = await saveConfig(db, {
      nicho: "dentista",
      regiao: "Sarandi PR",
      precos: { usdBrl: 6.0 },
    });

    expect(config.nicho).toBe("dentista");
    expect(config.precos.usdBrl).toBe(6.0);
    expect(config.precos.usdPor1000).toEqual(DEFAULT_CONFIG.precos.usdPor1000);

    const stored = db.getDoc(DOC);
    expect(stored?.regiao).toBe("Sarandi PR");
    expect(stored?.mensagemPadrao).toBe(DEFAULT_CONFIG.mensagemPadrao);
    expect(typeof stored?.atualizadoEm).toBe("string");
  });

  it("preserva valores já salvos que o patch não toca", async () => {
    const db = new FakeFirestore();
    await saveConfig(db, { nicho: "dentista" });

    const config = await saveConfig(db, { regiao: "Maringá PR" });

    expect(config.nicho).toBe("dentista");
    expect(config.regiao).toBe("Maringá PR");
  });

  it("rejeita chave desconhecida (typo)", async () => {
    const db = new FakeFirestore();

    const error = await saveConfig(db, { cap: { textSearch: 1 } }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).problemas).toEqual([
      "chave desconhecida: cap",
    ]);
    expect(db.getDoc(DOC)).toBeUndefined();
  });

  it("acumula todos os problemas de validação", async () => {
    const db = new FakeFirestore();

    const error = await saveConfig(db, {
      nicho: 42,
      filtros: { temSite: "talvez" },
      caps: { textSearch: -1, detailsEnterprise: 1.5, inventado: 3 },
      precos: { usdBrl: 0 },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).problemas).toEqual([
      "nicho deve ser string",
      "filtros.temSite deve ser um de: qualquer, com, sem",
      "caps.inventado não é um SKU conhecido (textSearch, textSearchEnterprise, detailsEssentials, detailsEnterprise, geocoding, aiGeneration)",
      "caps.textSearch deve ser número ≥ 0",
      "caps.detailsEnterprise deve ser inteiro",
      "precos.usdBrl deve ser número > 0",
    ]);
  });

  it("rejeita corpo que não é objeto", async () => {
    const db = new FakeFirestore();
    await expect(saveConfig(db, "nicho=dentista")).rejects.toThrow(
      ValidationError,
    );
  });

  it("aceita followUpDias/maxBuscasRecorrentes válidos e aplica defaults", async () => {
    const db = new FakeFirestore();

    const config = await saveConfig(db, { followUpDias: 7, maxBuscasRecorrentes: 0 });

    expect(config.followUpDias).toBe(7);
    expect(config.maxBuscasRecorrentes).toBe(0);
    // Doc antigo sem os campos cai nos defaults na leitura.
    expect(DEFAULT_CONFIG.followUpDias).toBe(4);
    expect(DEFAULT_CONFIG.maxBuscasRecorrentes).toBe(3);
  });

  it("rejeita followUpDias < 1 e maxBuscasRecorrentes negativo/não-inteiro", async () => {
    const db = new FakeFirestore();

    const error = await saveConfig(db, {
      followUpDias: 0,
      maxBuscasRecorrentes: 1.5,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).problemas).toEqual([
      "followUpDias deve ser inteiro ≥ 1",
      "maxBuscasRecorrentes deve ser inteiro ≥ 0",
    ]);
  });
});

describe("pricingFromConfig", () => {
  it("monta a tabela de preços do módulo de custos", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.precos.usdPor1000.textSearch = 40;
    config.precos.cotaGratis.textSearch = 1_000;

    const pricing = pricingFromConfig(config);

    expect(pricing.textSearch).toEqual({ usdPer1000: 40, freeQuota: 1_000 });
    expect(pricing.detailsEnterprise).toEqual({ usdPer1000: 20, freeQuota: 1_000 });
  });
});
