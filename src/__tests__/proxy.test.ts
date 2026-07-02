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

  it("/api/login é a única rota liberada sem sessão", async () => {
    const res = await proxy(request("/api/login"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("APP_PASSWORD ausente → 503 fail-closed (nada passa)", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await proxy(request("/", { cookie: await validCookie() }));

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("config_error");
  });
});
