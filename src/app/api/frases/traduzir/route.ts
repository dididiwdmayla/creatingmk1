import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel } from "@/lib/ai";
import { traduzirFrases } from "@/lib/ai/traducaoFrases";
import { loadConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getConjunto, salvarTraducao, slotsATraduzir } from "@/lib/frases";
import { idiomaDoLead } from "@/lib/frases/resolver";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { IDIOMA_PADRAO } from "@/lib/idioma";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Traduz as frases da skin da demo do lead para o idioma DELE (SKU
 * `aiTraducao`, reserva de cota antes do request — ver
 * `lib/ai/traducaoFrases.ts`). Chamada paga e explícita: só existe atrás do
 * botão da ficha, que mostra chamadas e custo antes de confirmar. Nenhuma
 * outra rota traduz nada de passagem.
 *
 * O corpo é só `{ leadId }`: skin e idioma saem do PRÓPRIO lead
 * (`lead.demo.skinId` e a derivação de idioma da demo), não do cliente —
 * assim ninguém gasta cota traduzindo uma skin para um idioma que nenhum
 * lead usa. Aberta a qualquer sessão, como o avanço da rotação: quem
 * prospecta o estrangeiro é o time, e a tradução é reusada por todos.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    if (!aiDisponivel()) throw new AiIndisponivelError();

    const corpo = await readJsonBody(req);
    const leadId = (corpo as { leadId?: unknown }).leadId;
    if (typeof leadId !== "string" || !leadId.trim()) {
      throw new ValidationError(["leadId deve ser o placeId do lead"]);
    }

    const lead = await getLead(db, leadId);
    if (!lead) throw new NotFoundError(`Lead "${leadId}" não encontrado.`);

    const skinId = lead.demo?.skinId;
    if (!skinId) {
      throw new ValidationError(["o lead não tem demo — não há skin cuja frase traduzir"]);
    }
    const idioma = idiomaDoLead(lead);
    if (idioma === IDIOMA_PADRAO) {
      throw new ValidationError(["o lead é do Brasil — as frases já estão em português"]);
    }

    const conjunto = await getConjunto(db, skinId);
    if (!conjunto || slotsATraduzir(conjunto).length === 0) {
      throw new ValidationError(["a skin deste lead não tem frase preenchida para traduzir"]);
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const traducao = await traduzirFrases(db, conjunto, idioma, config.caps, {
      userId: usuario?.id,
      isAdmin: usuario?.papel === "admin",
      limites: usuario?.limites,
    });

    const atualizado = await salvarTraducao(db, skinId, idioma, traducao);
    return NextResponse.json({ conjunto: atualizado ?? conjunto, idioma });
  } catch (error) {
    return handleRouteError(error);
  }
}
