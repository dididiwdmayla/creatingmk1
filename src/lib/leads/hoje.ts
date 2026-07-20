import { calculaScore } from "./score";
import type { Lead } from "./types";

/**
 * Fila do dia (/hoje): seleção pura das 3 seções sobre a lista de leads.
 * Descartados ficam fora de tudo — a fila é "o que trabalhar hoje", e
 * descartar é exatamente tirar o lead do caminho.
 */

export interface FilaDoDia {
  /** Criados depois da última visita do usuário, melhores scores primeiro. */
  novos: Lead[];
  /** Contactados sem resposta há mais de N dias, o mais antigo primeiro. */
  followUps: Lead[];
  /** Demo pronta mas lead ainda "novo" (demo criada e não enviada). */
  demosParadas: Lead[];
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function montarFilaDoDia(
  leads: Lead[],
  opts: {
    /** ultimaVisitaEm do usuário; ausente (1ª visita) = tudo é novo. */
    desde?: string;
    followUpDias: number;
    now: Date;
  },
): FilaDoDia {
  const ativos = leads.filter((lead) => lead.descartado !== true);
  const corte = new Date(opts.now.getTime() - opts.followUpDias * DIA_MS).toISOString();

  const novos = ativos
    .filter((lead) => opts.desde === undefined || lead.criadoEm > opts.desde)
    .sort(
      (a, b) => calculaScore(b) - calculaScore(a) || b.criadoEm.localeCompare(a.criadoEm),
    );

  const followUps = ativos
    .filter((lead) => {
      const contatoEm = lead.contato?.primeiroContatoEm;
      return (
        lead.status === "contactado" &&
        !lead.contato?.respondeuEm &&
        contatoEm !== undefined &&
        contatoEm < corte
      );
    })
    .sort((a, b) =>
      (a.contato?.primeiroContatoEm ?? "").localeCompare(b.contato?.primeiroContatoEm ?? ""),
    );

  const demosParadas = ativos
    .filter((lead) => lead.demo !== undefined && lead.status === "novo")
    .sort((a, b) => (a.demo?.criadoEm ?? "").localeCompare(b.demo?.criadoEm ?? ""));

  return { novos, followUps, demosParadas };
}
