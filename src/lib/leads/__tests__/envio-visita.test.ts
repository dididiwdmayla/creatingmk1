import { beforeEach, describe, expect, it } from "vitest";

import type { EnvioCanal, EnvioDemo } from "@/lib/demos/types";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  atualizarVisitaDemo,
  garantirEnvioToken,
  getLead,
  registrarVisitaDemo,
  saveDemo,
} from "../repo";

let db: FakeFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

const DEMO_INPUT = {
  skinId: DEFAULT_SKIN.id,
  themeId: DEFAULT_SKIN.themeDefault.id,
  dados: {},
};

/**
 * Acha o envio vigente de um canal numa lista — só pra deixar os testes
 * explícitos sobre qual canal usam. Mesmo fallback de canalDoEnvio (./envio.ts):
 * entrada sem `canal` (formato legado) conta como "whatsapp".
 */
function porCanal(envios: EnvioDemo[] | undefined, canal: EnvioCanal): EnvioDemo | undefined {
  return envios?.find((envio) => (envio.canal ?? "whatsapp") === canal);
}

describe("saveDemo — token de envio", () => {
  it("gera um token vigente por canal (link + whatsapp) no primeiro save, preserva nas edições", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    expect(salvo.demo?.envios).toHaveLength(2);
    const linkToken = porCanal(salvo.demo?.envios, "link")?.token;
    const waToken = porCanal(salvo.demo?.envios, "whatsapp")?.token;
    expect(linkToken).toBeTruthy();
    expect(waToken).toBeTruthy();
    expect(linkToken).not.toBe(waToken);

    const reeditado = await saveDemo(db, "A", { ...DEMO_INPUT, dados: { slogan: "novo" } });
    expect(porCanal(reeditado.demo?.envios, "link")?.token).toBe(linkToken);
    expect(porCanal(reeditado.demo?.envios, "whatsapp")?.token).toBe(waToken);
  });
});

describe("garantirEnvioToken", () => {
  it("gera um token por canal quando a demo não tem nenhum (self-heal de demo antiga)", async () => {
    db.seed("leads/B", {
      placeId: "B",
      nome: "Sem token ainda",
      status: "novo",
      enriquecido: false,
      demo: { skinId: DEFAULT_SKIN.id, themeId: DEFAULT_SKIN.themeDefault.id, dados: {}, criadoEm: "x", atualizadoEm: "x" },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const lead = await garantirEnvioToken(db, "B");
    expect(lead.demo?.envios).toHaveLength(2);
    expect(porCanal(lead.demo?.envios, "link")?.geradoEm).toBeTruthy();
    expect(porCanal(lead.demo?.envios, "whatsapp")?.geradoEm).toBeTruthy();
  });

  it("self-heal incremental: demo antiga com envio sem `canal` (legado) ganha só o token de link", async () => {
    // Formato de antes do canal "link" existir: um único envio, sem campo
    // `canal` — tratado como "whatsapp" na leitura (ver canalDoEnvio).
    db.seed("leads/L", {
      placeId: "L",
      nome: "Demo legada",
      status: "novo",
      enriquecido: false,
      demo: {
        skinId: DEFAULT_SKIN.id,
        themeId: DEFAULT_SKIN.themeDefault.id,
        dados: {},
        criadoEm: "x",
        atualizadoEm: "x",
        envios: [{ token: "token-legado", geradoEm: "2026-01-01T00:00:00.000Z" }],
      },
      criadoEm: "x",
      atualizadoEm: "x",
    });

    const lead = await garantirEnvioToken(db, "L");
    expect(lead.demo?.envios).toHaveLength(2);
    // O token legado continua vigente pro whatsapp — não foi substituído.
    expect(porCanal(lead.demo?.envios, "whatsapp")?.token).toBe("token-legado");
    expect(porCanal(lead.demo?.envios, "link")?.token).toBeTruthy();
    expect(porCanal(lead.demo?.envios, "link")?.token).not.toBe("token-legado");
  });

  it("é no-op quando já existem os dois tokens, e quando o lead não tem demo", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const enviosAntes = salvo.demo?.envios;
    const depois = await garantirEnvioToken(db, "A");
    expect(depois.demo?.envios).toEqual(enviosAntes);

    db.seed("leads/C", {
      placeId: "C",
      nome: "Sem demo",
      status: "novo",
      enriquecido: false,
      criadoEm: "x",
      atualizadoEm: "x",
    });
    const semDemo = await garantirEnvioToken(db, "C");
    expect(semDemo.demo).toBeUndefined();
  });
});

describe("registrarVisitaDemo", () => {
  it("sem token na URL: não registra visita nenhuma", async () => {
    await saveDemo(db, "A", DEMO_INPUT);
    const { visitaId, lead } = await registrarVisitaDemo(db, "A", { interna: false });
    expect(visitaId).toBeUndefined();
    expect(lead.demoVisitas).toBeUndefined();
  });

  it("visita não-interna com o token vigente do canal 'link': registra com canal e consome só o do link", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const linkEnvio = porCanal(salvo.demo?.envios, "link") as EnvioDemo;
    const waEnvio = porCanal(salvo.demo?.envios, "whatsapp") as EnvioDemo;

    const { lead, visitaId } = await registrarVisitaDemo(db, "A", {
      token: linkEnvio.token,
      interna: false,
    });

    expect(visitaId).toBeTruthy();
    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0]).toMatchObject({
      interna: false,
      envioEm: linkEnvio.geradoEm,
      canal: "link",
    });
    // Consumiu o token do canal "link"...
    expect(porCanal(lead.demo?.envios, "link")?.token).not.toBe(linkEnvio.token);
    // ...mas o do canal "whatsapp" continua intacto (canais independentes).
    expect(porCanal(lead.demo?.envios, "whatsapp")?.token).toBe(waEnvio.token);
    expect(lead.demo?.envios).toHaveLength(3);
  });

  it("visita não-interna com o token vigente do canal 'whatsapp': registra com canal e consome só o do whatsapp", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const linkEnvio = porCanal(salvo.demo?.envios, "link") as EnvioDemo;
    const waEnvio = porCanal(salvo.demo?.envios, "whatsapp") as EnvioDemo;

    const { lead } = await registrarVisitaDemo(db, "A", { token: waEnvio.token, interna: false });

    expect(lead.demoVisitas?.[0]).toMatchObject({ canal: "whatsapp" });
    expect(porCanal(lead.demo?.envios, "whatsapp")?.token).not.toBe(waEnvio.token);
    expect(porCanal(lead.demo?.envios, "link")?.token).toBe(linkEnvio.token);
  });

  it("visita INTERNA com o token vigente: registra, mas NÃO consome", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const linkEnvio = porCanal(salvo.demo?.envios, "link") as EnvioDemo;

    const { lead } = await registrarVisitaDemo(db, "A", { token: linkEnvio.token, interna: true });

    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].interna).toBe(true);
    expect(lead.demo?.envios).toHaveLength(2);
    expect(porCanal(lead.demo?.envios, "link")?.token).toBe(linkEnvio.token);
  });

  it("revisita de um link antigo (token já rotacionado) ainda resolve o envio e o canal corretos, sem consumir de novo", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const linkEnvio = porCanal(salvo.demo?.envios, "link") as EnvioDemo;

    await registrarVisitaDemo(db, "A", { token: linkEnvio.token, interna: false });
    const { lead } = await registrarVisitaDemo(db, "A", { token: linkEnvio.token, interna: false });

    expect(lead.demoVisitas).toHaveLength(2);
    expect(lead.demoVisitas?.[1]).toMatchObject({ envioEm: linkEnvio.geradoEm, canal: "link" });
    // Só consumiu uma vez — ainda só 3 envios no histórico (1 whatsapp + 2 link).
    expect(lead.demo?.envios).toHaveLength(3);
  });

  it("token desconhecido: registra a visita sem envio/canal correspondente e não consome", async () => {
    await saveDemo(db, "A", DEMO_INPUT);
    const { lead } = await registrarVisitaDemo(db, "A", { token: "token-invalido", interna: false });

    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].envioEm).toBeUndefined();
    expect(lead.demoVisitas?.[0].canal).toBeUndefined();
    expect(lead.demo?.envios).toHaveLength(2);
  });
});

describe("atualizarVisitaDemo", () => {
  it("preenche duração e scroll de uma visita já registrada", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    await atualizarVisitaDemo(db, "A", visitaId as string, {
      duracaoSegundos: 42,
      scrollPercent: 87,
    });

    const lead = await getLead(db, "A");
    expect(lead?.demoVisitas?.[0]).toMatchObject({ duracaoSegundos: 42, scrollPercent: 87 });
  });

  it("visita/lead inexistente é no-op silencioso", async () => {
    await expect(atualizarVisitaDemo(db, "nao-existe", "x", { duracaoSegundos: 1 })).resolves.toBeUndefined();
    await saveDemo(db, "A", DEMO_INPUT);
    await expect(
      atualizarVisitaDemo(db, "A", "visita-fantasma", { duracaoSegundos: 1 }),
    ).resolves.toMatchObject({ placeId: "A" });
  });

  it("marcadorDispositivo promove a visita a interna (beacon com marcador de dispositivo)", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    await atualizarVisitaDemo(db, "A", visitaId as string, { marcadorDispositivo: true });

    const lead = await getLead(db, "A");
    expect(lead?.demoVisitas?.[0].interna).toBe(true);
  });

  it("sem marcadorDispositivo não mexe na classificação já gravada", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: true });

    await atualizarVisitaDemo(db, "A", visitaId as string, { duracaoSegundos: 10 });

    const lead = await getLead(db, "A");
    expect(lead?.demoVisitas?.[0].interna).toBe(true);
  });
});

describe("registrarVisitaDemo — regressão classificação interna/marcador", () => {
  it("visita com sessão ativa (interna=true) é registrada como interna", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;

    const { lead } = await registrarVisitaDemo(db, "A", { token, interna: true });

    expect(lead.demoVisitas?.[0].interna).toBe(true);
  });

  it("visita com token, sem sessão e sem marcador é contada (registrada, não-interna)", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;

    const { lead, visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    expect(visitaId).toBeTruthy();
    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].interna).toBe(false);
  });

  it("grava geo só quando algum campo vier preenchido — nunca usado pra classificar", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = porCanal(salvo.demo?.envios, "link")?.token as string;

    const comGeo = await registrarVisitaDemo(db, "A", {
      token,
      interna: false,
      geo: { pais: "BR", regiao: "SP", cidade: "São Paulo" },
    });
    expect(comGeo.lead.demoVisitas?.[0]).toMatchObject({
      interna: false,
      geo: { pais: "BR", regiao: "SP", cidade: "São Paulo" },
    });

    db.seed("leads/A", { ...db.getDoc("leads/A"), demoVisitas: [] });
    const semGeo = await registrarVisitaDemo(db, "A", { token, interna: false });
    expect(semGeo.lead.demoVisitas?.[0].geo).toBeUndefined();
  });
});
