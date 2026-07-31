import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarSessaoToken } from "@/lib/auth";
import {
  classificarVisitaInterna,
  deviceIdValido,
  gerarDeviceId,
  lerCookieDoRequest,
} from "@/lib/device";

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deviceIdValido", () => {
  it("aceita o formato gerado por gerarDeviceId (32 hex)", () => {
    expect(deviceIdValido(gerarDeviceId())).toBe(true);
  });

  it("rejeita ausente, vazio e formato errado", () => {
    expect(deviceIdValido(undefined)).toBe(false);
    expect(deviceIdValido(null)).toBe(false);
    expect(deviceIdValido("")).toBe(false);
    expect(deviceIdValido("nao-e-hex")).toBe(false);
    expect(deviceIdValido("abc123")).toBe(false); // curto demais
  });
});

describe("lerCookieDoRequest", () => {
  it("lê um cookie específico entre vários no header Cookie", () => {
    const req = new Request("http://localhost/x", {
      headers: { cookie: "radar_session=abc; radar_device=def456" },
    });
    expect(lerCookieDoRequest(req, "radar_device")).toBe("def456");
    expect(lerCookieDoRequest(req, "radar_session")).toBe("abc");
  });

  it("undefined sem header Cookie ou cookie ausente", () => {
    expect(lerCookieDoRequest(new Request("http://localhost/x"), "radar_device")).toBeUndefined();
    const req = new Request("http://localhost/x", { headers: { cookie: "outro=1" } });
    expect(lerCookieDoRequest(req, "radar_device")).toBeUndefined();
  });
});

describe("classificarVisitaInterna — regressão", () => {
  it("visita com sessão ativa é interna", async () => {
    const token = await criarSessaoToken({ userId: "admin", papel: "admin", versao: 0 }, "segredo123");

    const interna = await classificarVisitaInterna({
      sessionCookie: token,
      deviceCookie: undefined,
    });

    expect(interna).toBe(true);
  });

  it("visita com marcador de dispositivo e sem sessão é interna", async () => {
    const interna = await classificarVisitaInterna({
      sessionCookie: undefined,
      deviceCookie: gerarDeviceId(),
    });

    expect(interna).toBe(true);
  });

  it("sem sessão válida e sem marcador: não é interna", async () => {
    const interna = await classificarVisitaInterna({
      sessionCookie: undefined,
      deviceCookie: undefined,
    });

    expect(interna).toBe(false);
  });

  it("sessão inválida (assinatura errada) e sem marcador: não é interna", async () => {
    const interna = await classificarVisitaInterna({
      sessionCookie: "admin.admin.0.assinatura-forjada",
      deviceCookie: undefined,
    });

    expect(interna).toBe(false);
  });

  it("marcador malformado (não bate o formato) não conta como interna", async () => {
    const interna = await classificarVisitaInterna({
      sessionCookie: undefined,
      deviceCookie: "nao-e-um-device-id-valido",
    });

    expect(interna).toBe(false);
  });
});
