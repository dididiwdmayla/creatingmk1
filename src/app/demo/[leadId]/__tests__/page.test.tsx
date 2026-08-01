import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarSessaoToken, SESSION_COOKIE } from "@/lib/auth";
import { DEVICE_COOKIE, gerarDeviceId } from "@/lib/device";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { saveDemo } from "@/lib/leads/repo";
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
// next/font/google exige o plugin SWC do Next (não roda sob vitest puro) —
// irrelevante pro que este teste verifica (resiliência a erro), então troca
// por um stub sem tocar em next/font.
vi.mock("../../fonts", () => ({
  demoCoreFontsClassName: "fonts-stub",
  resolveExtraFontClassNames: async () => "",
}));

beforeEach(() => {
  db = new FakeFirestore();
  cookieJar = {};
  vi.stubEnv("APP_PASSWORD", "segredo123");
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

/**
 * A rota pública renderiza sem sessão nenhuma (cookieJar vazio no
 * beforeEach) — cobre o efeito "aura" com o preset "fumaça colorida" de
 * ponta a ponta (loadDemo -> paletaParaAura -> EfeitoDinamico), o único
 * caminho que não passa por nenhum outro teste deste arquivo.
 */
describe("/demo/[leadId] — efeito aura com cores customizadas, sem sessão", () => {
  it("renderiza com fundoEfeito 'aura' + auraCores 'fumaca-colorida'", async () => {
    await saveDemo(db, "A", {
      skinId: DEFAULT_SKIN.id,
      themeId: DEFAULT_SKIN.themeDefault.id,
      dados: {},
      tema: { fundoEfeito: "aura", auraCores: "fumaca-colorida" },
    });
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });

    expect(elemento).toBeTruthy();
  });
});

/**
 * Selo "Vendo como membro" (ver SeloVisitaInterna.tsx): decisão sempre no
 * SERVIDOR, a partir da mesma classificação interna/externa do tracking —
 * sem sessão nem marcador de dispositivo, sem certeza nenhuma, não deve
 * renderizar nada.
 */
describe("/demo/[leadId] — selo de visita interna", () => {
  it("sem sessão e sem marcador de dispositivo, não renderiza o selo", async () => {
    await seedDemo();
    vi.resetModules();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).not.toContain("Vendo como membro");
  });

  it("com sessão válida, renderiza o selo com o nome do usuário", async () => {
    await seedDemo();
    db.seed("usuarios/ana", {
      id: "ana",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    cookieJar[SESSION_COOKIE] = await criarSessaoToken(
      { userId: "ana", papel: "membro", versao: 0 },
      "segredo123",
    );
    vi.resetModules();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).toContain("Vendo como membro");
    expect(html).toContain("Ana");
  });

  it("só com marcador de dispositivo (sem sessão), renderiza o selo sem nome", async () => {
    await seedDemo();
    cookieJar[DEVICE_COOKIE] = gerarDeviceId();
    vi.resetModules();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).toContain("Vendo como membro");
  });
});

/**
 * <html lang> do layout raiz é fixo "pt-BR" (o app é uma ferramenta interna
 * em pt-BR) — a demo pública é a única rota cujo idioma de CONTEÚDO varia
 * por lead (ver "Idioma da IA na demo"). Um script síncrono (mesmo padrão
 * do THEME_INIT) ajusta document.documentElement.lang antes do resto da
 * página pintar — este teste confirma que ele reflete o idioma EFETIVO
 * da demo (override salvo > país do endereço > default pt-BR).
 */
describe("/demo/[leadId] — <html lang> reflete o idioma efetivo da demo", () => {
  it("lead sem país reconhecido (endereço brasileiro): script ajusta para pt-BR", async () => {
    await seedDemo();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).toContain('document.documentElement.lang="pt-BR"');
  });

  it("lead com endereço suíço: script ajusta para de-CH (derivado do país)", async () => {
    db.seed("leads/A", {
      placeId: "A",
      nome: "Barbearia do Zé",
      endereco: "Bahnhofstrasse 1, 8001 Zürich, Suíça",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    await seedDemo();
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).toContain('document.documentElement.lang="de-CH"');
  });

  it("override manual (LeadDemo.idioma) vence o derivado do endereço", async () => {
    db.seed("leads/A", {
      placeId: "A",
      nome: "Barbearia do Zé",
      endereco: "Bahnhofstrasse 1, 8001 Zürich, Suíça",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    await saveDemo(db, "A", {
      skinId: DEFAULT_SKIN.id,
      themeId: DEFAULT_SKIN.themeDefault.id,
      dados: {},
      idioma: "en-US",
    });
    const { default: DemoPage } = await import("../page");

    const elemento = await DemoPage({
      params: Promise.resolve({ leadId: "A" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(elemento as never);

    expect(html).toContain('document.documentElement.lang="en-US"');
  });
});
