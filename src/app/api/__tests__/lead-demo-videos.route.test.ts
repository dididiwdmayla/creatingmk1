import { beforeEach, describe, expect, it, vi } from "vitest";

import { VIDEO_MAX_BYTES } from "@/lib/demos/videos";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { DELETE, POST } from "../leads/[id]/demo/videos/route";

let db: FakeFirestore;
let storage: FakeDemoStorage;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

beforeEach(() => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Óssea Studio",
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
    new Request(`http://localhost/api/leads/${id}/demo/videos`, {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ id }) },
  );
}

function del(id: string, body: unknown): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/leads/${id}/demo/videos`, {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function arquivo(tipo = "video/mp4", bytes = 16, nome = "titulo.mp4"): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

describe("POST /api/leads/[id]/demo/videos", () => {
  it("sobe o vídeo do slot (skin explícita) e devolve a URL pública", async () => {
    const res = await upload("A", {
      slot: "titulo",
      skinId: "tatuagem-editorial",
      arquivo: arquivo(),
    });

    expect(res.status).toBe(200);
    const { slot, url } = await res.json();
    expect(slot).toBe("titulo");
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/.+\/demos\/A\/video-titulo-\d+\.mp4$/);
    expect(storage.paths()).toHaveLength(1);
  });

  it("400 pra skin sem videoSlots (ex.: barbearia — opt-in por skin)", async () => {
    const res = await upload("A", {
      slot: "titulo",
      skinId: "barbearia-editorial",
      arquivo: arquivo(),
    });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("não oferece vídeo-no-título");
    expect(storage.paths()).toEqual([]);
  });

  it("400 para slot que a skin não tem", async () => {
    const res = await upload("A", {
      slot: "banner-gigante",
      skinId: "tatuagem-editorial",
      arquivo: arquivo(),
    });

    expect(res.status).toBe(400);
    expect(storage.paths()).toEqual([]);
  });

  it("400 para formato não aceito e para arquivo acima de 15MB", async () => {
    const avi = await upload("A", {
      slot: "titulo",
      skinId: "tatuagem-editorial",
      arquivo: arquivo("video/avi"),
    });
    expect(avi.status).toBe(400);

    const grande = await upload("A", {
      slot: "titulo",
      skinId: "tatuagem-editorial",
      arquivo: arquivo("video/mp4", VIDEO_MAX_BYTES + 1),
    });
    expect(grande.status).toBe(400);
    expect(storage.paths()).toEqual([]);
  });

  it("400 sem arquivo; 404 para lead inexistente", async () => {
    expect(
      (await upload("A", { slot: "titulo", skinId: "tatuagem-editorial" })).status,
    ).toBe(400);
    expect(
      (await upload("X", { slot: "titulo", skinId: "tatuagem-editorial", arquivo: arquivo() }))
        .status,
    ).toBe(404);
  });
});

describe("DELETE /api/leads/[id]/demo/videos", () => {
  it("apaga os arquivos do slot e limpa o override da demo salva", async () => {
    await upload("A", { slot: "titulo", skinId: "tatuagem-editorial", arquivo: arquivo() });
    db.seed("leads/A", {
      ...db.getDoc("leads/A"),
      demo: {
        skinId: "tatuagem-editorial",
        themeId: "sangue",
        dados: { videos: { titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4" } },
        atualizadoEm: "2026-07-19T00:00:00.000Z",
      },
    });

    const res = await del("A", { slot: "titulo" });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.dados.videos.titulo).toBeUndefined();
    expect(storage.paths()).toEqual([]);
  });

  it("sem demo salva, só limpa o Storage (no-op no doc)", async () => {
    await upload("A", { slot: "titulo", skinId: "tatuagem-editorial", arquivo: arquivo() });
    const res = await del("A", { slot: "titulo", skinId: "tatuagem-editorial" });

    expect(res.status).toBe(200);
    expect(storage.paths()).toEqual([]);
    expect(db.getDoc("leads/A")?.demo).toBeUndefined();
  });

  it("400 para slot inválido; 404 para lead inexistente", async () => {
    expect((await del("A", { slot: "x/../y" })).status).toBe(400);
    expect((await del("X", { slot: "titulo" })).status).toBe(404);
  });
});
