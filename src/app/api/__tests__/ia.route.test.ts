import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../ia/route";

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/ia", () => {
  it("com GEMINI_API_KEY → disponivel true e o modelo (nunca a chave)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "chave-teste");

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ disponivel: true, modelo: "gemini-3.5-flash" });
    expect(JSON.stringify(body)).not.toContain("chave-teste");
  });

  it("sem GEMINI_API_KEY → disponivel false (UI oculta a IA, nada quebra)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ disponivel: false });
  });
});
