import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMAGEM_MAX_BYTES } from "@/lib/demos/imagens";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { DELETE, POST } from "../leads/[id]/demo/imagens/route";

let db: FakeFirestore;
let storage: FakeDemoStorage;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

beforeEach(() => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

function upload(id: string, campos: Record<string, string | File>): Promise<Response> {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(campos)) form.set(chave, valor);
  return POST(
    new Request(`http://localhost/api/leads/${id}/demo/imagens`, {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ id }) },
  );
}

function del(id: string, body: unknown): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/leads/${id}/demo/imagens`, {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function arquivo(tipo = "image/webp", bytes = 16, nome = "foto.webp"): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

describe("POST /api/leads/[id]/demo/imagens", () => {
  it("sobe a imagem do slot e devolve a URL pública", async () => {
    const res = await upload("A", { slot: "hero", arquivo: arquivo() });

    expect(res.status).toBe(200);
    const { slot, url } = await res.json();
    expect(slot).toBe("hero");
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/.+\/demos\/A\/hero-\d+\.webp$/);
    expect(storage.paths()).toHaveLength(1);
  });

  it("400 para slot que a skin não tem", async () => {
    const res = await upload("A", { slot: "banner-gigante", arquivo: arquivo() });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("slot desconhecido");
    expect(storage.paths()).toEqual([]);
  });

  it("400 para formato não aceito e para arquivo acima de 2MB", async () => {
    const gif = await upload("A", { slot: "hero", arquivo: arquivo("image/gif") });
    expect(gif.status).toBe(400);

    const grande = await upload("A", {
      slot: "hero",
      arquivo: arquivo("image/jpeg", IMAGEM_MAX_BYTES + 1),
    });
    expect(grande.status).toBe(400);
    expect(storage.paths()).toEqual([]);
  });

  it("400 sem arquivo; 404 para lead inexistente", async () => {
    expect((await upload("A", { slot: "hero" })).status).toBe(400);
    expect((await upload("X", { slot: "hero", arquivo: arquivo() })).status).toBe(404);
  });
});

describe("DELETE /api/leads/[id]/demo/imagens", () => {
  it("apaga os arquivos do slot e limpa o override da demo salva", async () => {
    await upload("A", { slot: "hero", arquivo: arquivo() });
    db.seed("leads/A", {
      ...db.getDoc("leads/A"),
      demo: {
        skinId: DEFAULT_SKIN.id,
        themeId: DEFAULT_SKIN.themeDefault.id,
        dados: { imagens: { hero: "https://storage.googleapis.com/b/demos/A/hero-1.webp" } },
        atualizadoEm: "2026-07-10T00:00:00.000Z",
      },
    });

    const res = await del("A", { slot: "hero" });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.dados.imagens.hero).toBeUndefined();
    expect(storage.paths()).toEqual([]);
  });

  it("sem demo salva, só limpa o Storage (no-op no doc)", async () => {
    await upload("A", { slot: "hero", arquivo: arquivo() });
    const res = await del("A", { slot: "hero" });

    expect(res.status).toBe(200);
    expect(storage.paths()).toEqual([]);
    expect(db.getDoc("leads/A")?.demo).toBeUndefined();
  });

  it("400 para slot inválido; 404 para lead inexistente", async () => {
    expect((await del("A", { slot: "x/../y" })).status).toBe(400);
    expect((await del("X", { slot: "hero" })).status).toBe(404);
  });
});
