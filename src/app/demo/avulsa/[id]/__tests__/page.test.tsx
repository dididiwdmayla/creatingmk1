import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarSessaoToken, SESSION_COOKIE } from "@/lib/auth";
import { criarDemoAvulsa, getDemoAvulsa } from "@/lib/demos/avulsas/repo";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { envioVigente } from "@/lib/demos/envio";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

let db: FakeFirestore;
let cookieJar: Record<string, string>;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (cookieJar[nome] !== undefined ? { value: cookieJar[nome] } : undefined),
  }),
  headers: async () => new Headers(),
}));
// next/font/google exige o plugin SWC do Next (não roda sob vitest puro).
vi.mock("../../../fonts", () => ({
  demoCoreFontsClassName: "fonts-stub",
  resolveExtraFontClassNames: async () => "",
}));

const CONFIG = { skinId: DEFAULT_SKIN.id, themeId: DEFAULT_SKIN.themeDefault.id };

beforeEach(() => {
  db = new FakeFirestore();
  cookieJar = {};
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

async function criar(identidade: Record<string, string> = {}): Promise<DemoAvulsa> {
  return criarDemoAvulsa(db, { nome: "Barbearia do Zé", ...identidade }, CONFIG);
}

async function render(id: string, query: Record<string, string> = {}) {
  const { default: DemoAvulsaPage } = await import("../page");
  const elemento = await DemoAvulsaPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(elemento);
}

describe("/demo/avulsa/[id]", () => {
  it("renderiza a demo com a identidade digitada", async () => {
    const avulsa = await criar({ telefone: "(44) 3222-1111", cidade: "Maringá - PR" });
    const html = await render(avulsa.id);

    expect(html).toContain("Barbearia do Zé");
    expect(html).toContain("(44) 3222-1111");
    expect(html).toContain("Maringá - PR");
  });

  it("NÃO publica o endereço do template quando nenhum foi digitado", async () => {
    const avulsa = await criar();
    const html = await render(avulsa.id);
    // Todo exemplo.ts das skins traz um endereço fictício; sem a camada
    // de identidade em branco, ele iria pro ar como se fosse do negócio.
    expect(html).not.toContain(DEFAULT_SKIN.demoDataExemplo.endereco!);
  });

  it("404 quando a avulsa não existe", async () => {
    await expect(render("nao-existe")).rejects.toThrow();
  });

  it("visita sem token não vira registro (é 'Abrir demo' do editor)", async () => {
    const avulsa = await criar();
    await render(avulsa.id);
    expect((await getDemoAvulsa(db, avulsa.id))!.demoVisitas).toBeUndefined();
  });

  it("visita com token registra a abertura e gira o token", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "link")!.token;

    const html = await render(avulsa.id, { t: token });
    const depois = (await getDemoAvulsa(db, avulsa.id))!;

    expect(depois.demoVisitas).toHaveLength(1);
    expect(depois.demoVisitas![0].interna).toBe(false);
    expect(envioVigente(depois.demo, "link")!.token).not.toBe(token);
    // O rastreador precisa saber que é avulsa pra mandar o beacon certo.
    expect(html).toContain("Barbearia do Zé");
  });

  it("visita de quem tem sessão do app é interna e não queima o token", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "link")!.token;
    cookieJar[SESSION_COOKIE] = await criarSessaoToken(
      { userId: "u1", papel: "membro", versao: 0 },
      "segredo123",
    );

    await render(avulsa.id, { t: token });
    const depois = (await getDemoAvulsa(db, avulsa.id))!;
    expect(depois.demoVisitas![0].interna).toBe(true);
    expect(envioVigente(depois.demo, "link")!.token).toBe(token);
  });

  it("falha no rastreio não derruba a página pública", async () => {
    const avulsa = await criar();
    const token = envioVigente(avulsa.demo, "link")!.token;

    vi.doMock("@/lib/demos/avulsas/repo", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/demos/avulsas/repo")>();
      return {
        ...real,
        registrarVisitaAvulsa: vi.fn(async () => {
          throw new Error("falha simulada de rastreio");
        }),
      };
    });
    vi.resetModules();

    await expect(render(avulsa.id, { t: token })).resolves.toContain("Barbearia do Zé");
    vi.doUnmock("@/lib/demos/avulsas/repo");
    vi.resetModules();
  });
});

describe("cartão de conversa e cor da barra", () => {
  it("título e descrição saem do conteúdo da própria demo", async () => {
    const avulsa = await criar();
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({
      params: Promise.resolve({ id: avulsa.id }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toContain("Barbearia do Zé");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("aponta pro recurso de reserva enquanto não há prévia composta", async () => {
    const avulsa = await criar();
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({
      params: Promise.resolve({ id: avulsa.id }),
      searchParams: Promise.resolve({}),
    });
    const imagens = meta.openGraph?.images as Array<{ url: string }>;
    expect(imagens[0].url).toContain(`/demo/avulsa/${avulsa.id}/previa`);
  });

  it("a barra recebe a cor da demo, não a do app", async () => {
    const avulsa = await criar();
    const { generateViewport } = await import("../page");
    const viewport = await generateViewport({
      params: Promise.resolve({ id: avulsa.id }),
      searchParams: Promise.resolve({}),
    });
    expect(viewport.themeColor).toMatch(/^#|^rgb/);
  });

  it("metadados de demo inexistente não quebram", async () => {
    const { generateMetadata } = await import("../page");
    const meta = await generateMetadata({
      params: Promise.resolve({ id: "nao-existe" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toBe("Demo");
  });
});
