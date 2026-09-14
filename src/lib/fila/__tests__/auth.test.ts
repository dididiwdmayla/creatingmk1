import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { autenticarDispositivo } from "../auth";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/fila/proximo", { headers });
}

beforeEach(() => {
  vi.stubEnv("RADAR_DEVICE_KEY", "chave-do-celular");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("autenticarDispositivo", () => {
  it("Bearer correto → null (autenticado)", () => {
    const res = autenticarDispositivo(request({ authorization: "Bearer chave-do-celular" }));
    expect(res).toBeNull();
  });

  it("sem header → 401 { erro }", async () => {
    const res = autenticarDispositivo(request());
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ erro: "nao_autorizado" });
  });

  it("Bearer errado → 401 { erro }", async () => {
    const res = autenticarDispositivo(request({ authorization: "Bearer chave-errada" }));
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ erro: "nao_autorizado" });
  });

  it("chave certa mas sem o prefixo Bearer → 401", async () => {
    const res = autenticarDispositivo(request({ authorization: "chave-do-celular" }));
    expect(res?.status).toBe(401);
  });

  it("RADAR_DEVICE_KEY ausente → 503 config_error (fail-closed)", async () => {
    vi.stubEnv("RADAR_DEVICE_KEY", "");
    const res = autenticarDispositivo(request({ authorization: "Bearer chave-do-celular" }));
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error.code).toBe("config_error");
  });
});
