import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { loadFilaConfig } from "@/lib/fila/config";
import { simularRespostaDeLead } from "@/lib/fila/simularResposta";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `POST /api/config/fila/respostas/simular` — o botão "simular mensagem" do
 * painel "Respostas pendentes".
 *
 * Mora sob `/api/config/`, e não sob `/api/fila/`, pelo mesmo motivo da
 * rota irmã: o proxy isenta todo o prefixo `/api/fila/` da sessão de
 * usuário (é o celular com Bearer). Esta é para uma PESSOA logada.
 *
 * ADMIN ONLY — 401 sem sessão, 403 para membro. Duas razões: cada clique
 * gasta uma geração de IA da cota do mês, e o resultado carrega o contexto
 * comercial e o posicionamento de preço, que é o que o time cobra por.
 *
 * NÃO ESCREVE NADA além da reserva de cota (ver `simularRespostaDeLead`): o
 * rascunho volta no corpo da resposta e morre ali se ninguém olhar. É por
 * isso que é um POST que não cria recurso nenhum — o verbo acompanha o
 * EFEITO (uma chamada de IA paga, com corpo de entrada), não a criação.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const corpo = await readJsonBody(req);
    // A `FilaConfig` NÃO entra aqui: com `respostaAutomatica` ligada ou
    // desligada o resultado é o mesmo, porque esta rota não cria tarefa
    // nenhuma. Ler o interruptor sugeriria que ele importa.
    const appConfig = await loadConfig(db);

    const simulacao = await simularRespostaDeLead(
      db,
      corpo.leadId,
      corpo.texto,
      appConfig,
      new Date(),
    );

    return NextResponse.json(simulacao);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * O lead PADRÃO da simulação é o `leadContextoExcecao` já escolhido no
 * painel "Fila de envio" — o operador já disse ali qual lead usa para
 * ensaiar, e perguntar de novo seria pedir o mesmo dado duas vezes. Vazio
 * significa "escolha um": a tela pede o placeId.
 *
 * Um GET só para isso existe porque o painel de respostas não carrega a
 * `FilaConfig` (ele nunca precisou dela), e pendurar o campo na rota da
 * lista misturaria a linha de estado com a semente de um formulário.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { leadContextoExcecao } = await loadFilaConfig(db);
    return NextResponse.json({ leadPadrao: leadContextoExcecao });
  } catch (error) {
    return handleRouteError(error);
  }
}
