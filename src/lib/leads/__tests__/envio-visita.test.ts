import { beforeEach, describe, expect, it } from "vitest";

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

describe("saveDemo — token de envio", () => {
  it("gera o primeiro token de envio no primeiro save e preserva nas edições", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    expect(salvo.demo?.envios).toHaveLength(1);
    const primeiroToken = salvo.demo?.envios?.[0].token;
    expect(primeiroToken).toBeTruthy();

    const reeditado = await saveDemo(db, "A", { ...DEMO_INPUT, dados: { slogan: "novo" } });
    expect(reeditado.demo?.envios?.[0].token).toBe(primeiroToken);
  });
});

describe("garantirEnvioToken", () => {
  it("gera um token quando a demo não tem nenhum (self-heal de demo antiga)", async () => {
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
    expect(lead.demo?.envios).toHaveLength(1);
    expect(lead.demo?.envios?.[0].geradoEm).toBeTruthy();
  });

  it("é no-op quando já existe token, e quando o lead não tem demo", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const tokenAntes = salvo.demo?.envios?.[0].token;
    const depois = await garantirEnvioToken(db, "A");
    expect(depois.demo?.envios?.[0].token).toBe(tokenAntes);

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

  it("visita não-interna com o token vigente: registra e consome (gera o próximo)", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const tokenOriginal = salvo.demo?.envios?.[0].token as string;
    const geradoEmOriginal = salvo.demo?.envios?.[0].geradoEm as string;

    const { lead, visitaId } = await registrarVisitaDemo(db, "A", {
      token: tokenOriginal,
      interna: false,
    });

    expect(visitaId).toBeTruthy();
    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0]).toMatchObject({
      interna: false,
      envioEm: geradoEmOriginal,
    });
    // Consumiu: o token vigente agora é outro.
    expect(lead.demo?.envios?.[0].token).not.toBe(tokenOriginal);
    expect(lead.demo?.envios).toHaveLength(2);
  });

  it("visita INTERNA com o token vigente: registra, mas NÃO consome", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const tokenOriginal = salvo.demo?.envios?.[0].token as string;

    const { lead } = await registrarVisitaDemo(db, "A", { token: tokenOriginal, interna: true });

    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].interna).toBe(true);
    expect(lead.demo?.envios).toHaveLength(1);
    expect(lead.demo?.envios?.[0].token).toBe(tokenOriginal);
  });

  it("revisita de um link antigo (token já rotacionado) ainda resolve o envio correto, sem consumir de novo", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const tokenOriginal = salvo.demo?.envios?.[0].token as string;
    const geradoEmOriginal = salvo.demo?.envios?.[0].geradoEm as string;

    await registrarVisitaDemo(db, "A", { token: tokenOriginal, interna: false });
    const { lead } = await registrarVisitaDemo(db, "A", { token: tokenOriginal, interna: false });

    expect(lead.demoVisitas).toHaveLength(2);
    expect(lead.demoVisitas?.[1].envioEm).toBe(geradoEmOriginal);
    // Só consumiu uma vez — ainda só 2 envios no histórico.
    expect(lead.demo?.envios).toHaveLength(2);
  });

  it("token desconhecido: registra a visita sem envio correspondente e não consome", async () => {
    await saveDemo(db, "A", DEMO_INPUT);
    const { lead } = await registrarVisitaDemo(db, "A", { token: "token-invalido", interna: false });

    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].envioEm).toBeUndefined();
    expect(lead.demo?.envios).toHaveLength(1);
  });
});

describe("atualizarVisitaDemo", () => {
  it("preenche duração e scroll de uma visita já registrada", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = salvo.demo?.envios?.[0].token as string;
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
    const token = salvo.demo?.envios?.[0].token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    await atualizarVisitaDemo(db, "A", visitaId as string, { marcadorDispositivo: true });

    const lead = await getLead(db, "A");
    expect(lead?.demoVisitas?.[0].interna).toBe(true);
  });

  it("sem marcadorDispositivo não mexe na classificação já gravada", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = salvo.demo?.envios?.[0].token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: true });

    await atualizarVisitaDemo(db, "A", visitaId as string, { duracaoSegundos: 10 });

    const lead = await getLead(db, "A");
    expect(lead?.demoVisitas?.[0].interna).toBe(true);
  });
});

describe("registrarVisitaDemo — regressão classificação interna/marcador", () => {
  it("visita com sessão ativa (interna=true) é registrada como interna", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = salvo.demo?.envios?.[0].token as string;

    const { lead } = await registrarVisitaDemo(db, "A", { token, interna: true });

    expect(lead.demoVisitas?.[0].interna).toBe(true);
  });

  it("visita com token, sem sessão e sem marcador é contada (registrada, não-interna)", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = salvo.demo?.envios?.[0].token as string;

    const { lead, visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    expect(visitaId).toBeTruthy();
    expect(lead.demoVisitas).toHaveLength(1);
    expect(lead.demoVisitas?.[0].interna).toBe(false);
  });

  it("grava geo só quando algum campo vier preenchido — nunca usado pra classificar", async () => {
    const salvo = await saveDemo(db, "A", DEMO_INPUT);
    const token = salvo.demo?.envios?.[0].token as string;

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
