import { NextResponse } from "next/server";

import { listBuscas } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { montarFilaDoDia } from "@/lib/leads/hoje";
import { listLeads } from "@/lib/leads/repo";
import { carimbarVisita, usuarioDaRequest } from "@/lib/usuarios";

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

    return NextResponse.json({
      ...fila,
      /** Carimbo usado no delta (null = primeira visita do usuário). */
      novosDesde: usuario.ultimaVisitaEm ?? null,
      followUpDias: config.followUpDias,
      /** Para o botão WhatsApp e o badge da busca de origem, sem outra chamada. */
      mensagemPadrao: config.mensagemPadrao,
      buscas: buscas.map(({ id, nome, cor, mensagemPadrao }) => ({
        id,
        nome,
        cor,
        ...(mensagemPadrao && { mensagemPadrao }),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
