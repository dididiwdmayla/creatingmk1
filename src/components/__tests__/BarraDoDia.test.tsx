import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BarraDoDia } from "../BarraDoDia";
import { barraDoDia } from "@/lib/leads/barraDoDia";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";

type Faixa = NonNullable<Lead["horarios"]>["faixas"][number];

function abertura(dia: number, horaAbre: number, horaFecha: number): Faixa {
  return { diaAbre: dia, horaAbre, minAbre: 0, diaFecha: dia, horaFecha, minFecha: 0 };
}

/** 2026-07-21 é terça (mesma âncora dos testes de horários). */
function terca(hora: number, min = 0): Date {
  return new Date(`2026-07-21T${String(hora + 3).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`);
}

function barbearia(faixas: Faixa[]): Lead {
  return {
    placeId: "p1",
    nome: "Barbearia Teste",
    status: "novo",
    enriquecido: true,
    busca: { nicho: "barbearia", regiao: "x", em: "" },
    horarios: { faixas, utcOffsetMinutes: -180, obtidoEm: "2026-01-01T00:00:00.000Z" },
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  };
}

function desenhar(lead: Lead, now: Date): string {
  const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, lead, now)!;
  return renderToStaticMarkup(<BarraDoDia barra={barra} />);
}

describe("BarraDoDia", () => {
  it("cor NUNCA é o único canal: cada nível tem altura própria, legenda em palavras e descrição", () => {
    const html = desenhar(barbearia([abertura(2, 9, 19)]), terca(10));

    // Os três níveis pintados, cada um com a SUA altura (o segundo canal).
    expect(html).toContain("h-full bg-good");
    expect(html).toContain("h-[58%] bg-warning");
    expect(html).toContain("h-[32%] bg-critical");

    // Legenda em palavras + descrição acessível da sequência inteira.
    expect(html).toContain("razoável");
    expect(html).toMatch(/aria-label="Barra do dia[^"]*9h a 11h30 bom[^"]*16h30 a 19h ruim/);

    // E a linha de texto abaixo, que não depende de nada visual.
    expect(html).toContain("Hora do lead 10h · agora: bom");
  });

  it("régua ganha marcas de hora entre os extremos, e a de transição sai destacada (não só por cor)", () => {
    const html = desenhar(barbearia([abertura(2, 9, 19)]), terca(10));

    // Marcas regulares (2 em 2h) e de transição (11h30, 16h30), sem repetir
    // os extremos já rotulados (9h/19h).
    expect(html).toContain(">10h<");
    expect(html).toContain(">14h<");
    expect(html).toContain(">18h<");
    expect(html).toContain(">11h30<");
    expect(html).toContain(">16h30<");
    // A de transição carrega uma classe própria (peso da fonte), não só cor.
    expect(html).toMatch(/font-medium text-ink-secondary"[^>]*>11h30</);
  });

  it("marcador da hora atual em hora LOCAL do lead, posicionado dentro do expediente", () => {
    const html = desenhar(barbearia([abertura(2, 9, 19)]), terca(14));
    // 14h em 9h-19h = metade exata da barra.
    expect(html).toContain("left:50%");
  });

  it("fora do expediente não existe trecho — nada de vermelho no que está fechado", () => {
    // Fecha pro almoço (12h-14h) e o dia acaba às 16h, antes do trecho ruim.
    const html = desenhar(barbearia([abertura(2, 9, 12), abertura(2, 14, 16)]), terca(13));
    // (a legenda sempre tem as três cores; o que importa é o que foi PINTADO
    // na trilha, e trecho pintado é sempre "absolute bottom-0 …")
    expect(html).not.toMatch(/absolute bottom-0[^"]*bg-critical/);
    // Dois trechos pintados; o buraco do almoço fica com o fundo da trilha.
    expect(html.match(/absolute bottom-0/g)).toHaveLength(3);
  });

  it("dia fechado: diz em palavras, sem pintar faixa nenhuma", () => {
    const html = desenhar(barbearia([abertura(1, 9, 19)]), terca(10));
    expect(html).toContain("fechado hoje");
    expect(html).not.toMatch(/absolute bottom-0/);
  });

  it("altura reservada: as peças que mudam com os dados já nascem com o tamanho final", () => {
    const semHorarios: Lead = { ...barbearia([]), horarios: undefined };
    const comEndereco: Lead = { ...semHorarios, endereco: "Rua X, 10, Porto Alegre, Brasil" };
    const antes = desenhar(comEndereco, terca(10));
    const depois = desenhar(barbearia([abertura(2, 9, 19)]), terca(10));

    // Trilha, eixo, legenda e a linha de texto (2 linhas) têm altura fixa nos
    // dois estados — é o que impede o horário que chega DEPOIS de empurrar a
    // ficha (ver ARCHITECTURE.md, "Deslocamento de layout").
    for (const html of [antes, depois]) {
      expect(html).toContain("relative h-3.5");
      expect(html).toContain("relative h-7");
      expect(html).toContain("mt-1.5 flex h-4");
      expect(html).toContain("mt-1 min-h-8");
    }
    // E o estado "sem horário declarado" avisa que é estimativa.
    expect(antes).toContain("horário estimado");
    expect(depois).not.toContain("horário estimado");
  });
});
