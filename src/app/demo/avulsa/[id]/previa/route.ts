import { nomeDaAvulsa } from "@/lib/demos/avulsas/identidade";
import { getDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { corDaBarra } from "@/lib/demos/barra/modos";
import { PREVIA_ALTURA, PREVIA_LARGURA } from "@/lib/demos/capturas/previa.mjs";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import { getDb } from "@/lib/firebase/admin";

import { imagemDeReserva } from "../../../[leadId]/previa/imagem";

/**
 * GET /demo/avulsa/{id}/previa — o RECURSO DE RESERVA da prévia do link da
 * demo avulsa. Gêmea de `/demo/{leadId}/previa`: mesma composição, mesmo
 * motivo (um cartão de conversa sem imagem é pior que um cartão simples),
 * só lendo de `/demosAvulsas`.
 *
 * Mora sob `/demo/` de propósito: é o único prefixo público do app (ver
 * src/proxy.ts). Debaixo de `/api/` o buscador de prévia levaria 401.
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const avulsa = await getDemoAvulsa(getDb(), id);
    if (!avulsa) return new Response("Sem demo", { status: 404 });

    const skin = getSkin(avulsa.demo.skinId);
    if (!skin) return new Response("Sem demo", { status: 404 });
    const tema = aplicarTema(
      getTheme(skin, avulsa.demo.themeId),
      avulsa.demo.tema,
      skin.heroEscalaLimites,
    );

    return imagemDeReserva({
      nome: nomeDaAvulsa(avulsa),
      paleta: tema.paleta,
      fundo: corDaBarra(tema),
      largura: PREVIA_LARGURA,
      altura: PREVIA_ALTURA,
    });
  } catch (error) {
    // Um cartão de conversa não é lugar de mensagem de erro, e a prévia
    // nunca pode derrubar nada.
    console.error("[radar] falha ao gerar a prévia de reserva da avulsa:", error);
    return new Response("Prévia indisponível", { status: 500 });
  }
}
