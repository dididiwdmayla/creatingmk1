import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET, PUT } from "../config/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
});

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/config", () => {
  it("retorna os defaults quando não há doc", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: DEFAULT_CONFIG });
  });
});

describe("PUT /api/config", () => {
  it("aplica patch parcial e o GET seguinte reflete", async () => {
    const res = await PUT(
      putRequest({ nicho: "dentista", regiao: "Sarandi PR" }),
    );

    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.nicho).toBe("dentista");
    expect(config.caps).toEqual(DEFAULT_CONFIG.caps);

    const after = await (await GET()).json();
    expect(after.config.regiao).toBe("Sarandi PR");
  });

  it("patch inválido → 400 validation_error com problemas", async () => {
    const res = await PUT(putRequest({ caps: { textSearch: -1 }, typo: 1 }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas).toEqual([
      "chave desconhecida: typo",
      "caps.textSearch deve ser número ≥ 0",
    ]);
  });

  it("corpo que não é JSON → 400", async () => {
    const res = await PUT(putRequest("nicho=dentista"));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
  });
});
