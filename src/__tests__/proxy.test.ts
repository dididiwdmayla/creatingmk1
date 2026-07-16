import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionTokenFor } from "@/lib/auth";
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

async function validCookie(): Promise<string> {
  return `radar_session=${await sessionTokenFor("segredo123")}`;
}

describe("proxy (proteção por senha)", () => {
  it("sem sessão → 401 em páginas e API", async () => {
    for (const path of ["/", "/api/config", "/api/leads"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(401);
      const { error } = await res.json();
      expect(error.code).toBe("unauthorized");
    }
  });

  it("cookie de sessão válido → passa (next)", async () => {
    const res = await proxy(request("/api/config", { cookie: await validCookie() }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("cookie inválido → 401", async () => {
    const res = await proxy(
      request("/api/config", { cookie: "radar_session=forjado" }),
    );

    expect(res.status).toBe(401);
  });

  it("header x-app-password correto → passa e já estabelece o cookie", async () => {
    const res = await proxy(
      request("/api/config", { "x-app-password": "segredo123" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toContain(
      `radar_session=${await sessionTokenFor("segredo123")}`,
    );
  });

  it("header x-app-password errado → 401", async () => {
    const res = await proxy(request("/api/config", { "x-app-password": "chute" }));

    expect(res.status).toBe(401);
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

    expect(res.status).toBe(401);
  });

  it("/demo/{leadId} é pública (link de demo enviado ao lead)", async () => {
    for (const path of ["/demo/ChIJabc123", "/demo/ChIJabc123/"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("caminhos que só se PARECEM com a demo continuam protegidos", async () => {
    for (const path of ["/demonstracao", "/api/demo/x", "/demos/x"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(401);
    }
  });

  it("APP_PASSWORD ausente → 503 também na demo pública (fail-closed)", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await proxy(request("/demo/abc"));

    expect(res.status).toBe(503);
  });

  it("APP_PASSWORD ausente → 503 fail-closed (nada passa)", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await proxy(request("/", { cookie: await validCookie() }));

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("config_error");
  });
});
