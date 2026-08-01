import { NextResponse } from "next/server";

import { listBuscas } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { montarFilaDoDia } from "@/lib/leads/hoje";
import { envioTokenIncompleto, garantirEnvioToken, listLeads } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { carimbarVisita, getProgressoMetaUsuario, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Fila do dia. O delta de "novos" é POR USUÁRIO: a seção usa o carimbo
 * ultimaVisitaEm anterior do usuário logado e, ao responder, a rota grava
 * o carimbo novo — o próximo carregamento parte de agora. Diferente das
 * rotas de leitura comuns, esta exige sessão identificável (401 sem ela):
 * sem saber quem é, não há delta.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const now = new Date();
    const [config, leads, buscas] = await Promise.all([
      loadConfig(db),
      listLeads(db),
      listBuscas(db),
    ]);

    const fila = montarFilaDoDia(leads, {
      desde: usuario.ultimaVisitaEm,
      followUpDias: config.followUpDias,
      now,
    });
    await carimbarVisita(db, usuario.id, now);
    const metaProspeccao = await getProgressoMetaUsuario(db, usuario.id, usuario.metas, now);

    // Self-heal do token de envio: o link do WhatsApp com {demo} é montado
    // aqui, sem fetch no clique — precisa do token já pronto na resposta.
    const semToken = new Map<string, Lead>();
    for (const lead of [
      ...fila.novos,
      ...fila.followUps,
      ...fila.demosParadas,
      ...fila.abriramNaoResponderam,
    ]) {
      if (envioTokenIncompleto(lead)) {
        semToken.set(lead.placeId, lead);
      }
    }
    if (semToken.size > 0) {
      const atualizados = new Map(
        await Promise.all(
          [...semToken.keys()].map(
            async (placeId) => [placeId, await garantirEnvioToken(db, placeId)] as const,
          ),
        ),
      );
      const substituir = (lista: Lead[]) => lista.map((l) => atualizados.get(l.placeId) ?? l);
      fila.novos = substituir(fila.novos);
      fila.followUps = substituir(fila.followUps);
      fila.demosParadas = substituir(fila.demosParadas);
      fila.abriramNaoResponderam = substituir(fila.abriramNaoResponderam);
    }

    return NextResponse.json({
      ...fila,
      /** Carimbo usado no delta (null = primeira visita do usuário). */
      novosDesde: usuario.ultimaVisitaEm ?? null,
      followUpDias: config.followUpDias,
      /** Meta de prospecção do PRÓPRIO usuário logado — só entra `meta` na janela configurada. */
      metaProspeccao,
      /** Para o botão WhatsApp e o badge da busca de origem, sem outra chamada. */
      mensagemPadrao: config.mensagemPadrao,
      buscas: buscas.map(({ id, nome, cor, mensagemPadrao, nicho, regiao, penetracao }) => ({
        id,
        nome,
        cor,
        nicho,
        regiao,
        ...(mensagemPadrao && { mensagemPadrao }),
        ...(penetracao && { penetracao }),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
