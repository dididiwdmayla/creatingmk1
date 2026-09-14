import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET } from "../config/fila/pendencias/route";
import { PATCH } from "../config/fila/pendencias/[leadId]/route";

/**
 * A lista de pendência do painel "Fila de envio". Mesma divisão de
 * `/api/config/fila`: GET aberto a qualquer sessão, escrita restrita ao
 * admin. E, sobretudo, ela mora sob `/api/config/` e não sob `/api/fila/` —
 * aquele prefixo inteiro passa SEM sessão de usuário (é o celular com
 * Bearer, ver src/proxy.ts), e pendurar uma tela de admin lá a tiraria da
 * sessão junto.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const ENVIADO_EM = "2026-03-10T10:00:00.000Z";

function semearPendencia(leadId: string, nome: string, detalhe: string) {
  db.seed(`leads/${leadId}`, { placeId: leadId, nome, status: "contactado" });
  db.seed(`filaEnvios/${leadId}`, {
    leadId,
    estado: "enviado",
    claimId: `claim-${leadId}`,
    reservadoEm: ENVIADO_EM,
    expiraEm: ENVIADO_EM,
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: ENVIADO_EM,
    detalheEnvio: detalhe,
  });
}

function getRequest(query = "", cookie?: string): Request {
  return new Request(`http://localhost/api/config/fila/pendencias${query}`, {
    headers: { ...(cookie && { cookie }) },
  });
}

function patchRequest(body: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/config/fila/pendencias/ChIJa", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });
}

const params = (leadId: string) => ({ params: Promise.resolve({ leadId }) });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/config/fila/pendencias", () => {
  it("lista vazia quando ninguém está pendente", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pendencias: [] });
  });

  it("devolve leadId, nome, data do envio e o detalhe", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");

    const { pendencias } = await (await GET(getRequest())).json();

    expect(pendencias).toEqual([
      {
        leadId: "ChIJa",
        nome: "Ink House",
        enviadoEm: ENVIADO_EM,
        detalhe: "print não anexou",
        resolvido: false,
      },
    ]);
  });

  it("?resolvidos=1 traz as já fechadas", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PATCH(patchRequest({ resolvido: true }, cookie), params("ChIJa"));

    expect((await (await GET(getRequest())).json()).pendencias).toEqual([]);
    const comResolvidas = await (await GET(getRequest("?resolvidos=1"))).json();
    expect(comResolvidas.pendencias).toHaveLength(1);
    expect(comResolvidas.pendencias[0].resolvido).toBe(true);
  });
});

describe("PATCH /api/config/fila/pendencias/{leadId} (restrito ao admin)", () => {
  it("admin marca resolvido e a linha sai da lista", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ resolvido: true }, cookie), params("ChIJa"));

    expect(res.status).toBe(200);
    expect((await res.json()).pendencia).toMatchObject({ leadId: "ChIJa", resolvido: true });
    expect(db.getDoc("filaEnvios/ChIJa")?.detalheEnvioResolvido).toBe(true);
    // O resto da claim fica intacto: a escrita é merge de um campo só.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "enviado",
      detalheEnvio: "print não anexou",
      enviadoEm: ENVIADO_EM,
    });
  });

  it("membro não altera — 403", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await PATCH(patchRequest({ resolvido: true }, cookie), params("ChIJa"));

    expect(res.status).toBe(403);
    expect(db.getDoc("filaEnvios/ChIJa")?.detalheEnvioResolvido).toBeUndefined();
  });

  it("sem sessão → 401", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");

    expect((await PATCH(patchRequest({ resolvido: true }), params("ChIJa"))).status).toBe(401);
  });

  it("resolvido que não é booleano → 400", async () => {
    semearPendencia("ChIJa", "Ink House", "print não anexou");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ resolvido: "sim" }, cookie), params("ChIJa"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });

  it("lead sem pendência → 404, sem criar doc", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ resolvido: true }, cookie), params("ChIJnada"));

    expect(res.status).toBe(404);
    expect(db.getDoc("filaEnvios/ChIJnada")).toBeUndefined();
  });
});
