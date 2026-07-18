import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarSessaoToken } from "@/lib/auth";
import { proxy } from "../proxy";

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

async function validCookie(papel: "admin" | "membro" = "admin"): Promise<string> {
  const token = await criarSessaoToken({ userId: "admin", papel, versao: 0 }, "segredo123");
  return `radar_session=${token}`;
}

describe("proxy (proteção por sessão multiusuário)", () => {
  it("sem sessão em PÁGINA → redireciona para /login (não JSON de erro)", async () => {
    for (const path of ["/", "/leads", "/config", "/leads/abc/demo/editar"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    }
  });

  it("sem sessão em rota API → 401 JSON", async () => {
    for (const path of ["/api/config", "/api/leads"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(401);
      const { error } = await res.json();
      expect(error.code).toBe("unauthorized");
    }
  });

  it("cookie de sessão assinado válido → passa (next)", async () => {
    const res = await proxy(request("/api/config", { cookie: await validCookie() }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("cookie forjado/formato antigo → 401 na API, redirect na página", async () => {
    const api = await proxy(request("/api/config", { cookie: "radar_session=forjado" }));
    expect(api.status).toBe(401);

    const page = await proxy(request("/", { cookie: "radar_session=forjado" }));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("assinatura de outro segredo → rejeitada", async () => {
    const token = await criarSessaoToken(
      { userId: "admin", papel: "admin", versao: 0 },
      "outro-segredo",
    );
    const res = await proxy(request("/api/config", { cookie: `radar_session=${token}` }));

    expect(res.status).toBe(401);
  });

  it("/config: membro é redirecionado ao painel; admin passa", async () => {
    const membro = await proxy(request("/config", { cookie: await validCookie("membro") }));
    expect(membro.status).toBe(307);
    expect(membro.headers.get("location")).toBe("http://localhost:3000/");

    const admin = await proxy(request("/config", { cookie: await validCookie("admin") }));
    expect(admin.headers.get("x-middleware-next")).toBe("1");
  });

  it("/api/login e /login são liberadas sem sessão", async () => {
    for (const path of ["/api/login", "/login"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("/login/outra-coisa NÃO é liberada (só o path exato)", async () => {
    const res = await proxy(request("/login/outra-coisa"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("/demo/{leadId} é pública (link de demo enviado ao lead)", async () => {
    for (const path of ["/demo/ChIJabc123", "/demo/ChIJabc123/"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("caminhos que só se PARECEM com a demo continuam protegidos", async () => {
    const api = await proxy(request("/api/demo/x"));
    expect(api.status).toBe(401);
    for (const path of ["/demonstracao", "/demos/x"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(307);
    }
  });

  it("APP_PASSWORD ausente → 503 também na demo pública (fail-closed)", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await proxy(request("/demo/abc"));

    expect(res.status).toBe(503);
  });

  it("APP_PASSWORD ausente → 503 fail-closed (nada passa)", async () => {
    const cookie = await validCookie();
    vi.stubEnv("APP_PASSWORD", "");

    const res = await proxy(request("/", { cookie }));

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("config_error");
  });
});
