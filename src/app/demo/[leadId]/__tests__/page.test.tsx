import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { saveDemo } from "@/lib/leads/repo";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
// next/font/google exige o plugin SWC do Next (não roda sob vitest puro) —
// irrelevante pro que este teste verifica (resiliência a erro), então troca
// por um stub sem tocar em next/font.
vi.mock("../../fonts", () => ({
  demoCoreFontsClassName: "fonts-stub",
  resolveExtraFontClassNames: async () => "",
}));

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

async function seedDemo() {
  const salvo = await saveDemo(db, "A", {
    skinId: DEFAULT_SKIN.id,
    themeId: DEFAULT_SKIN.themeDefault.id,
    dados: {},
  });
  return salvo.demo?.envios?.[0].token as string;
}

/**
 * Reproduz os dois bugs suspeitos do 500 em produção em /demo/[leadId]:
 * falha ao registrar a visita (rastreio) e falha ao resolver o efeito de
 * fundo (import dinâmico do registro de efeitos) NUNCA podem derrubar a
 * rota pública — cada um é envolto no seu próprio try/catch (ver
 * loadDemo/DemoPage em ../page.tsx) e a demo tem que renderizar mesmo
 * assim. Os dois testes forçam o erro no ponto exato onde ele
 * aconteceria e confirmam que a página continua de pé.
 */
describe("/demo/[leadId] — resiliência a falha de efeito/rastreio", () => {
  it("falha ao registrar a visita (rastreio) não derruba a página", async () => {
    const token = await seedDemo();
    vi.doMock("@/lib/leads/repo", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/leads/repo")>();
      return {
        ...real,
        registrarVisitaDemo: vi.fn(async () => {
          throw new Error("falha simulada de rastreio");
        }),
      };
    });
    vi.resetModules();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({ t: token }),
    });

    expect(elemento).toBeTruthy();
    vi.doUnmock("@/lib/leads/repo");
  });

  it("falha ao resolver o efeito de fundo não derruba a página", async () => {
    await seedDemo();
    vi.doMock("@/lib/demos/efeitos/registry", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/demos/efeitos/registry")>();
      return {
        ...real,
        resolverEfeitoFundo: () => {
          throw new Error("falha simulada de efeito");
        },
      };
    });
    vi.resetModules();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });

    expect(elemento).toBeTruthy();
    vi.doUnmock("@/lib/demos/efeitos/registry");
  });
});
