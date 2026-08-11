import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { FAMILIA_GENERICA, ROTULO_FAMILIA } from "@/lib/leads/janelaContato";
import { listLeads } from "@/lib/leads/repo";
import { listRegioes } from "@/lib/regioes";
import { montarMundo } from "@/lib/prospeccao/mundo";

/**
 * "Onde no mundo vale prospectar agora" (tela `/mundo`), para um nicho.
 *
 * Rota DERIVADA: config + leads + regiões já cacheadas, tudo Firestore.
 * Nenhuma chamada paga sai daqui — nem geocoding, nem Places, nem IA —, e
 * é de propósito: a tela existe pra decidir ONDE gastar a busca, não pra
 * gastar. A busca continua sendo um clique explícito em /leads, com
 * `reserveQuota` como sempre.
 *
 * Sem `?familia=`, responde a primeira família da tabela de faixas — a
 * tela sempre chega com uma escolhida, mas um deep link sem query não pode
 * quebrar.
 */

/** Teto de leads devolvidos por país: a linha da tela é uma prévia, não a lista de leads. */
const LEADS_POR_PAIS = 8;

export async function GET(req: Request) {
  try {
    const db = getDb();
    const now = new Date();
    const config = await loadConfig(db);

    const familias = Object.keys(config.janelasContato).sort((a, b) =>
      // Genérico por último; o resto em ordem alfabética do rótulo.
      a === FAMILIA_GENERICA
        ? 1
        : b === FAMILIA_GENERICA
          ? -1
          : (ROTULO_FAMILIA[a] ?? a).localeCompare(ROTULO_FAMILIA[b] ?? b),
    );
    const pedida = new URL(req.url).searchParams.get("familia")?.trim();
    const familia = pedida && familias.includes(pedida) ? pedida : (familias[0] ?? FAMILIA_GENERICA);

    const [leads, regioes] = await Promise.all([listLeads(db), listRegioes(db)]);

    const mundo = montarMundo({
      paises: config.paisesProspeccao,
      janelas: config.janelasContato,
      familia,
      leads,
      regioes,
      now,
    });

    return NextResponse.json({
      familia,
      familias: familias.map((id) => ({ id, rotulo: ROTULO_FAMILIA[id] ?? id })),
      /** Instante do cálculo — a tela mostra a hora local de cada país a partir dele. */
      agora: now.toISOString(),
      paises: mundo.paises.map((linha) => ({
        codigo: linha.pais.codigo,
        nome: linha.pais.nome,
        idiomas: linha.pais.idiomas,
        horaLocal: linha.horaLocal,
        minutoLocal: linha.minutoLocal,
        utcOffsetMinutos: linha.pais.utcOffsetMinutos,
        faixa: linha.faixa,
        indice: linha.indice,
        totalLeads: linha.leads.length,
        // Projeção mínima: a linha mostra nome e cidade e abre a ficha. O
        // resto do doc do lead não tem por que trafegar aqui.
        leads: linha.leads.slice(0, LEADS_POR_PAIS).map((lead) => ({
          placeId: lead.placeId,
          nome: lead.nome,
          endereco: lead.endereco,
          siteProprio: lead.siteProprio,
        })),
      })),
      ...(mundo.emBreve && {
        emBreve: {
          codigo: mundo.emBreve.pais.codigo,
          nome: mundo.emBreve.pais.nome,
          rotuloDia: mundo.emBreve.proxima.rotuloDia,
          inicioMin: mundo.emBreve.proxima.inicioMin,
          emMinutos: mundo.emBreve.emMinutos,
        },
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
