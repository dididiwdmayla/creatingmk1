import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CronStatusCard } from "../CronStatusCard";
import type { CronExecucao } from "@/lib/buscas/cron";

const INICIO = "2026-07-21T06:00:00.000Z";
const AGORA = new Date("2026-07-21T09:00:00.000Z");

function desenhar(ultima: CronExecucao | null, now = AGORA): string {
  return renderToStaticMarkup(<CronStatusCard cron={{ ultima, recorrentes: 2 }} now={now} />);
}

const RODOU: CronExecucao = {
  em: INICIO,
  estado: "ok",
  concluidaEm: INICIO,
  recorrentes: 2,
  buscas: [{ buscaId: "b1", nome: "Dentistas — Centro", novos: 3, existentes: 11 }],
  totalNovos: 3,
  totalExistentes: 11,
};

const FALHOU: CronExecucao = {
  em: INICIO,
  estado: "falhou",
  concluidaEm: INICIO,
  recorrentes: 0,
  buscas: [],
  totalNovos: 0,
  totalExistentes: 0,
  falha: { etapa: "config", mensagem: "Firestore indisponível", em: INICIO },
};

describe("CronStatusCard — falha é visível, nunca confundida com sucesso", () => {
  it("rodou: selo \"Rodou\", números da rodada, borda neutra, nada de falha", () => {
    const html = desenhar(RODOU);
    expect(html).toContain('data-cron-estado="rodou"');
    expect(html).toContain("✓ Rodou");
    expect(html).toContain("Última execução");
    expect(html).toContain("border-line");
    expect(html).not.toContain("Falhou");
    expect(html).not.toContain("border-critical");
  });

  it("falhou: selo \"Falhou\" escrito, etapa em palavras, mensagem e borda crítica — sem números de sucesso", () => {
    const html = desenhar(FALHOU);
    expect(html).toContain('data-cron-estado="falhou"');
    expect(html).toContain("✕ Falhou");
    expect(html).toContain("leitura da configuração");
    expect(html).toContain("Firestore indisponível");
    expect(html).toContain("border-critical/60");
    expect(html).not.toContain("Rodou");
    expect(html).not.toContain("Última execução");
  });

  it("falhou depois de andar: mostra o progresso de antes da falha", () => {
    const html = desenhar({
      ...FALHOU,
      buscas: RODOU.buscas,
      totalNovos: 3,
      totalExistentes: 11,
      falha: { etapa: "penetracao", mensagem: "deadline exceeded", em: INICIO },
    });
    expect(html).toContain("recálculo da penetração");
    expect(html).toContain("antes dela: 3 novo(s)");
  });

  it("\"rodando\" velho (morto por tempo) aparece como falha: \"Não concluiu\"", () => {
    const rodando: CronExecucao = { ...FALHOU, estado: "rodando", falha: undefined, concluidaEm: undefined };
    const html = desenhar(rodando, AGORA); // 3h depois do início
    expect(html).toContain('data-cron-estado="nao-concluiu"');
    expect(html).toContain("✕ Não concluiu");
    expect(html).toContain("300s");
    expect(html).toContain("border-critical/60");

    const agora = desenhar(rodando, new Date("2026-07-21T06:01:00.000Z"));
    expect(agora).toContain('data-cron-estado="rodando"');
    expect(agora).toContain("● Rodando");
  });

  it("doc antigo, sem estado: continua lido como rodou", () => {
    const antigo: CronExecucao = { ...RODOU };
    delete antigo.estado;
    expect(desenhar(antigo)).toContain('data-cron-estado="rodou"');
  });

  it("sem rodada nenhuma: texto de nunca rodou, sem selo", () => {
    const html = desenhar(null);
    expect(html).toContain("O cron ainda não rodou.");
    expect(html).not.toContain("data-cron-selo");
  });
});
