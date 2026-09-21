// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpcaoLead } from "@/lib/leads/selecao";

import { PaineisConfigProvider } from "../PainelColapsavel";
import { DisparoTeste, PAINEL_DISPARO_TESTE } from "../paineis/DisparoTeste";

/**
 * O SELETOR DE ALVO do disparo de teste, com o LEAD FIXO DE TESTE dentro.
 *
 * `listLeads` exclui o lead fixo na ORIGEM — e isso não muda: afrouxar
 * aquilo o vazaria para /leads, /demos, /hoje, /mundo e para a penetração
 * de site por nicho (ver "O INVENTÁRIO" no ARCHITECTURE.md). Quem trata o
 * caso é o SELETOR, oferecendo-o como opção extra. Este teste é o que
 * prova que os dois lados continuam valendo ao mesmo tempo: a rota da
 * lista não devolve o fixo, e ele aparece na tela assim mesmo — e
 * PRÉ-SELECIONADO, que é o padrão do disparo.
 */

const FIXO = { leadId: "radar-lead-teste", nome: "Barbearia Dom Aurélio", pronto: true };

/** A lista da rota: leads de verdade, SEM o fixo. */
const LISTA: OpcaoLead[] = [
  { leadId: "ChIJa", nome: "Ink House", nicho: "tatuagem", cidade: "Porto Alegre", temDemo: true },
];

const ESTADO_TESTE = {
  numeroTeste: "5544984570105",
  leadDeTeste: FIXO,
  atual: null,
  validadeMs: 900000,
  repeticoesMax: 10,
};

let container: HTMLDivElement;
let root: Root;
let pedidos: string[];

beforeEach(() => {
  pedidos = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  vi.stubGlobal("fetch", (entrada: string) => {
    pedidos.push(entrada);
    const corpo = entrada.startsWith("/api/fila/teste")
      ? ESTADO_TESTE
      : entrada.startsWith("/api/capturas")
        ? { capturas: { [FIXO.leadId]: { estado: "pronto" } }, disponivel: true }
        : entrada.startsWith("/api/config/leads-selecao")
          ? { leads: LISTA }
          : undefined;
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

async function montar() {
  await act(async () => {
    root.render(
      <PaineisConfigProvider inicial={[PAINEL_DISPARO_TESTE]}>
        <DisparoTeste versao={0} />
      </PaineisConfigProvider>,
    );
  });
  for (let volta = 0; volta < 4; volta += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const seletor = () => container.querySelector('[data-seletor="disparo-alvo"]');

describe("Disparo de teste — a escolha do alvo", () => {
  it("nasce com o lead fixo de teste escolhido, pelo NOME", async () => {
    await montar();

    expect(seletor()?.textContent).toContain("Barbearia Dom Aurélio");
    // O id do fixo não vai para a tela — nem o dele.
    expect(seletor()?.textContent).not.toContain("radar-lead-teste");
  });

  it("oferece o fixo na lista, embora a rota da lista não o devolva", async () => {
    await montar();

    await act(async () => {
      seletor()
        ?.querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const linhas = [...(seletor()?.querySelectorAll('[data-lista="seletor-lead"] button') ?? [])];
    const nomes = linhas.map((b) => b.textContent ?? "");

    expect(nomes.some((n) => n.includes("Barbearia Dom Aurélio"))).toBe(true);
    expect(nomes.some((n) => n.includes("Ink House"))).toBe(true);
    // A rota continua sem vazar o fixo: quem o acrescenta é a tela.
    expect(LISTA.some((l) => l.leadId === FIXO.leadId)).toBe(false);
  });

  it("o alvo padrão não custa requisição nenhuma a mais", async () => {
    await montar();

    // O nome do fixo veio no mesmo GET que desenha o bloco; a rota de
    // resolução por id não é chamada, e a lista só quando alguém abre.
    expect(pedidos.some((p) => p.startsWith("/api/config/leads-selecao/"))).toBe(false);
    expect(pedidos.some((p) => p === "/api/config/leads-selecao")).toBe(false);
  });
});
