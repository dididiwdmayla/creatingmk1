import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionTokenFor } from "@/lib/auth";
import { POST } from "../login/route";

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function login(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/login", () => {
  it("senha correta → 204 com cookie de sessão httpOnly", async () => {
    const res = await login({ senha: "segredo123" });

    expect(res.status).toBe(204);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`radar_session=${await sessionTokenFor("segredo123")}`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("senha errada → 401 invalid_password, sem cookie", async () => {
    const res = await login({ senha: "chute" });

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe("invalid_password");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sem APP_PASSWORD no servidor → 503 config_error", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await login({ senha: "qualquer" });

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("config_error");
  });
});
