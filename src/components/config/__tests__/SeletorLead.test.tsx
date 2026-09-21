// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpcaoLead } from "@/lib/leads/selecao";

import { SeletorLead } from "../SeletorLead";

/**
 * O SELETOR DE LEAD — o componente que fez os campos da /config pararem de
 * pedir um `leadId` cru (ver "Seletor de lead" no ARCHITECTURE.md).
 *
 * O que estes testes travam é justamente o que uma tela nova costuma
 * perder: que a lista custa UMA requisição e não uma por tecla, que o id
 * salvo aparece pelo NOME, e que um id apontando para lead que sumiu não
 * derruba o painel inteiro.
 */

const LISTA: OpcaoLead[] = [
  { leadId: "ChIJa", nome: "Barbearia do Zé", nicho: "barbearia", cidade: "Maringá", temDemo: true },
  {
    leadId: "ChIJb",
    nome: "Barbearia do Zé",
    nicho: "barbearia",
    cidade: "Porto Alegre",
    temDemo: false,
  },
  { leadId: "ChIJc", nome: "Pet Center", nicho: "petshop", cidade: "Curitiba", temDemo: true },
];

let container: HTMLDivElement;
let root: Root;
/** Toda URL pedida por `fetch`, na ordem — é o contador das requisições. */
let pedidos: string[];
/** Respostas por URL; o teste sobrescreve o que precisa. */
let respostas: Map<string, unknown>;

function responder(url: string, corpo: unknown) {
  respostas.set(url, corpo);
}

beforeEach(() => {
  pedidos = [];
  respostas = new Map<string, unknown>([["/api/config/leads-selecao", { leads: LISTA }]]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  vi.stubGlobal("fetch", (entrada: string) => {
    pedidos.push(entrada);
    const corpo = respostas.get(entrada);
    return Promise.resolve(
      corpo === undefined
        ? new Response(JSON.stringify({ error: { code: "not_found" } }), { status: 404 })
        : new Response(JSON.stringify(corpo), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Renderiza e deixa as promessas pendentes assentarem. */
async function montar(no: React.ReactElement) {
  await act(async () => {
    root.render(no);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

async function clicar(elemento: Element | null) {
  await act(async () => {
    elemento?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const gatilho = () => container.querySelector("button");
const opcoes = () =>
  [...container.querySelectorAll('[data-lista="seletor-lead"] button')] as HTMLButtonElement[];
const campoBusca = () => container.querySelector("input") as HTMLInputElement | null;

async function digitar(texto: string) {
  const campo = campoBusca();
  if (!campo) throw new Error("o campo de busca não está na tela");
  for (const letra of texto) {
    await act(async () => {
      const proto = Object.getPrototypeOf(campo) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter?.call(campo, campo.value + letra);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

describe("SeletorLead", () => {
  it("grava o leadId escolhido — o valor do campo continua sendo o id", async () => {
    const escolhido: string[] = [];
    await montar(
      <SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={(id) => escolhido.push(id)} />,
    );

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });
    await clicar(opcoes().find((b) => b.textContent?.includes("Pet Center")) ?? null);

    expect(escolhido).toEqual(["ChIJc"]);
  });

  it("cada opção diz nicho, cidade e demo — dois leads de mesmo nome ficam distinguíveis", async () => {
    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={() => {}} />);

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });

    const doZe = opcoes().filter((b) => b.textContent?.includes("Barbearia do Zé"));
    expect(doZe).toHaveLength(2);
    expect(doZe[0].textContent).toContain("Maringá");
    expect(doZe[0].textContent).toContain("com demo");
    expect(doZe[1].textContent).toContain("Porto Alegre");
    expect(doZe[1].textContent).toContain("sem demo");
  });

  /**
   * O `AppDb` não tem query: procurar no servidor seria a varredura de
   * `/leads` inteira A CADA LETRA. A lista vem uma vez, ao abrir; o filtro
   * é local. Este teste é o que impede a regressão silenciosa de alguém
   * trocar o filtro por uma chamada "que já existe".
   */
  it("NENHUMA requisição por tecla digitada — uma por abertura, e só", async () => {
    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={() => {}} />);

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });
    const depoisDeAbrir = pedidos.length;
    expect(depoisDeAbrir).toBe(1);

    await digitar("barbearia");

    expect(pedidos).toHaveLength(depoisDeAbrir);
    expect(opcoes()).toHaveLength(2); // filtrou de verdade, sem rede
  });

  it("reabrir não busca de novo — a lista já está em mãos", async () => {
    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={() => {}} />);

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });
    await clicar(gatilho()); // fecha
    await clicar(gatilho()); // abre de novo

    expect(pedidos).toHaveLength(1);
  });

  it("o filtro ignora acento e caixa", async () => {
    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={() => {}} />);
    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });

    await digitar("ZE");

    expect(opcoes()).toHaveLength(2);
  });

  it("um id JÁ SALVO aparece pelo NOME, sem a varredura da lista", async () => {
    responder("/api/config/leads-selecao/ChIJa", { lead: LISTA[0] });

    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="ChIJa" onEscolher={() => {}} />);

    expect(gatilho()?.textContent).toContain("Barbearia do Zé");
    // O ID CRU NÃO APARECE: é exatamente o que a tela não mostra.
    expect(container.textContent).not.toContain("ChIJa");
    // E a varredura não aconteceu: só a leitura do documento daquele lead.
    expect(pedidos).toEqual(["/api/config/leads-selecao/ChIJa"]);
  });

  /**
   * A limpeza de leads antigos pode excluir justamente o lead escolhido
   * como contexto. O campo diz isso e continua funcionando — o painel não
   * pode quebrar por causa de um valor velho.
   */
  it("id de lead que não existe mais: diz 'lead não encontrado' e deixa escolher outro", async () => {
    responder("/api/config/leads-selecao/ChIJsumiu", { lead: null });
    const escolhido: string[] = [];

    await montar(
      <SeletorLead
        nome="teste"
        ariaLabel="Lead"
        valor="ChIJsumiu"
        onEscolher={(id) => escolhido.push(id)}
      />,
    );

    expect(gatilho()?.textContent).toContain("lead não encontrado");

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });
    await clicar(opcoes().find((b) => b.textContent?.includes("Pet Center")) ?? null);

    expect(escolhido).toEqual(["ChIJc"]);
  });

  it("a lista que falha não derruba o seletor — diz o erro e continua abrindo", async () => {
    respostas.delete("/api/config/leads-selecao");

    await montar(<SeletorLead nome="teste" ariaLabel="Lead" valor="" onEscolher={() => {}} />);
    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Falha ao carregar os leads");
  });

  /**
   * O lead fixo de teste é excluído de `listLeads` na ORIGEM, e é o
   * seletor — não aquela exclusão — que trata o caso de ele precisar
   * aparecer.
   */
  it("opção EXTRA aparece na lista sem estar na resposta da rota", async () => {
    const fixo: OpcaoLead = {
      leadId: "radar-lead-teste",
      nome: "Barbearia Dom Aurélio (fixo de teste)",
      nicho: "",
      cidade: "",
      temDemo: true,
    };

    await montar(
      <SeletorLead
        nome="teste"
        ariaLabel="Lead"
        valor="radar-lead-teste"
        extras={[fixo]}
        onEscolher={() => {}}
      />,
    );

    // Valor coberto pelos extras: nem a leitura por id acontece.
    expect(pedidos).toHaveLength(0);
    expect(gatilho()?.textContent).toContain("Barbearia Dom Aurélio");

    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });

    expect(opcoes()[0].textContent).toContain("Barbearia Dom Aurélio");
    expect(opcoes()).toHaveLength(1 + LISTA.length);
  });

  it("com permiteVazio, 'nenhum' grava a string vazia", async () => {
    responder("/api/config/leads-selecao/ChIJa", { lead: LISTA[0] });
    const escolhido: string[] = [];

    await montar(
      <SeletorLead
        nome="teste"
        ariaLabel="Lead"
        valor="ChIJa"
        permiteVazio
        onEscolher={(id) => escolhido.push(id)}
      />,
    );
    await clicar(gatilho());
    await act(async () => {
      await Promise.resolve();
    });
    await clicar(opcoes().find((b) => b.textContent === "nenhum") ?? null);

    expect(escolhido).toEqual([""]);
  });
});
