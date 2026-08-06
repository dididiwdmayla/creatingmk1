import { corDaBarra } from "@/lib/demos/barra/modos";
import { PREVIA_ALTURA, PREVIA_LARGURA } from "@/lib/demos/capturas/previa.mjs";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import { getDb } from "@/lib/firebase/admin";
import { getLead } from "@/lib/leads/repo";

import { imagemDeReserva } from "./imagem";

/**
 * GET /demo/{leadId}/previa — o RECURSO DE RESERVA da prévia do link.
 *
 * A prévia de verdade é um arquivo pronto no Storage, composta pelo motor
 * junto com as capturas (ver `capturas/previa.mjs`), e é para ela que o
 * `og:image` aponta quando existe: um endereço direto, servido pela CDN,
 * que é o mais rápido que dá pra ser. Esta rota cobre o intervalo — o lead
 * cuja demo acabou de ser salva e cujas capturas ainda não rodaram.
 *
 * **Reserva, e não "nada"**: um cartão de conversa sem imagem é pior que
 * um cartão simples. Ela desenha o nome do negócio sobre a cor da marca,
 * que é o mínimo que a prévia precisa entregar.
 *
 * Mora sob `/demo/` de propósito: é o único prefixo público do app (ver
 * src/proxy.ts). Debaixo de `/api/` o buscador de prévia levaria 401 —
 * ele não tem cookie de sessão nenhum.
 *
 * Fica no Node runtime porque lê o Firestore com a credencial admin, que
 * não roda no Edge.
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  try {
    const lead = await getLead(getDb(), leadId);
    if (!lead?.demo) return new Response("Sem demo", { status: 404 });

    const skin = getSkin(lead.demo.skinId);
    if (!skin) return new Response("Sem demo", { status: 404 });
    const tema = aplicarTema(
      getTheme(skin, lead.demo.themeId),
      lead.demo.tema,
      skin.heroEscalaLimites,
    );

    return imagemDeReserva({
      nome: lead.nome,
      paleta: tema.paleta,
      fundo: corDaBarra(tema),
      largura: PREVIA_LARGURA,
      altura: PREVIA_ALTURA,
    });
  } catch (error) {
    // Um cartão de conversa não é lugar de mensagem de erro, e a prévia
    // nunca pode derrubar nada: quem falha aqui simplesmente não tem
    // imagem, e o cliente de mensagens mostra o cartão só com texto.
    console.error("[radar] falha ao gerar a prévia de reserva:", error);
    return new Response("Prévia indisponível", { status: 500 });
  }
}
