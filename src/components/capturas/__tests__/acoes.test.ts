import { afterEach, describe, expect, it, vi } from "vitest";

import {
  baixarUmAUm,
  buscarArquivos,
  classificarFalha,
  podeCompartilharArquivos,
} from "../acoes";

/**
 * As duas ações. O que importa cobrar: que "Baixar" salve UM ARQUIVO POR
 * IMAGEM (nunca um pacote), que a sonda de compartilhamento só diga sim
 * quando o aparelho de fato anexa arquivo, e que cancelar não vire erro.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("podeCompartilharArquivos", () => {
  it("não, quando não há navigator.share", () => {
    vi.stubGlobal("navigator", {});
    expect(podeCompartilharArquivos()).toBe(false);
  });

  it("não, quando há share mas não canShare (desktop e navegador antigo)", () => {
    vi.stubGlobal("navigator", { share: () => Promise.resolve() });
    expect(podeCompartilharArquivos()).toBe(false);
  });

  it("não, quando o aparelho compartilha texto mas recusa arquivo", () => {
    vi.stubGlobal("navigator", { share: () => Promise.resolve(), canShare: () => false });
    expect(podeCompartilharArquivos()).toBe(false);
  });

  it("sim, e a sonda é um arquivo DE VERDADE", () => {
    const vistos: unknown[] = [];
    vi.stubGlobal("navigator", {
      share: () => Promise.resolve(),
      canShare: (dados: { files?: File[] }) => {
        vistos.push(dados);
        return true;
      },
    });
    expect(podeCompartilharArquivos()).toBe(true);
    // Lista vazia responderia `true` em navegador que não anexa nada.
    const dados = vistos[0] as { files: File[] };
    expect(dados.files).toHaveLength(1);
    expect(dados.files[0]).toBeInstanceOf(File);
  });

  it("navegador que explode na sonda não derruba a galeria", () => {
    vi.stubGlobal("navigator", {
      share: () => Promise.resolve(),
      canShare: () => {
        throw new Error("nope");
      },
    });
    expect(podeCompartilharArquivos()).toBe(false);
  });
});

describe("classificarFalha", () => {
  it("cancelar a folha não é erro", () => {
    const abort = new Error("cancelou");
    abort.name = "AbortError";
    expect(classificarFalha(abort)).toBe("cancelado");
  });

  it("gesto expirado é o caso do Safari, e pede outro toque", () => {
    const naoPermitido = new Error("gesture");
    naoPermitido.name = "NotAllowedError";
    expect(classificarFalha(naoPermitido)).toBe("gesto-expirado");
  });

  it("o resto é falha mesmo", () => {
    expect(classificarFalha(new Error("qualquer"))).toBe("falhou");
  });
});

describe("buscarArquivos", () => {
  it("devolve um File por imagem, com o nome legível", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } }),
    );
    const arquivos = await buscarArquivos([
      { url: "/api/x?1", nome: "a-celular-01-hero.png" },
      { url: "/api/x?2", nome: "a-celular-02-servicos.png" },
    ]);
    expect(arquivos.map((f) => f.name)).toEqual([
      "a-celular-01-hero.png",
      "a-celular-02-servicos.png",
    ]);
    expect(arquivos[0].type).toBe("image/png");
  });

  it("uma imagem que não vem interrompe com erro, em vez de compartilhar menos", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    await expect(buscarArquivos([{ url: "/api/x", nome: "a.png" }])).rejects.toThrow("a.png");
  });
});

describe("baixarUmAUm", () => {
  function docFalso() {
    const cliques: Array<{ href: string; download: string }> = [];
    const doc = {
      createElement: () => {
        const link = {
          href: "",
          download: "",
          rel: "",
          click: () => cliques.push({ href: link.href, download: link.download }),
          remove: () => undefined,
        };
        return link as unknown as HTMLAnchorElement;
      },
      body: { appendChild: () => undefined },
    } as unknown as Document;
    return { doc, cliques };
  }

  it("salva UM arquivo por imagem — nunca um pacote", async () => {
    const { doc, cliques } = docFalso();
    const salvos = await baixarUmAUm(
      [
        { url: "/api/a", nome: "a.png" },
        { url: "/api/b", nome: "b.png" },
        { url: "/api/c", nome: "c.png" },
      ],
      { pausaMs: 0, doc },
    );
    expect(salvos).toBe(3);
    expect(cliques).toEqual([
      { href: "/api/a", download: "a.png" },
      { href: "/api/b", download: "b.png" },
      { href: "/api/c", download: "c.png" },
    ]);
  });

  it("uma imagem só também é um arquivo só", async () => {
    const { doc, cliques } = docFalso();
    await baixarUmAUm([{ url: "/api/a", nome: "a.png" }], { pausaMs: 0, doc });
    expect(cliques).toHaveLength(1);
  });
});
