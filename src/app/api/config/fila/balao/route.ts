import { NextResponse } from "next/server";

import { montarBalaoFila, montarResumoBalao } from "@/lib/fila/balao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/balao` — o que o BALÃO da fila mostra. Uma rota, dois
 * custos, e a diferença está em `?lista=1`:
 *
 * - **sem `lista`** (balão FECHADO): 2 leituras de doc — `config/fila` e o
 *   contador do dia. É o único custo que a navegação normal paga, e ele
 *   existe porque o balão está em TODA tela do app: buscar a fila inteira a
 *   cada página aberta multiplicaria leitura por navegação.
 * - **com `lista=1`** (balão ABERTO, no clique): 4 leituras de doc mais uma
 *   POR ID de cada linha mostrada (teto de 19). Ver `lib/fila/balao.ts`.
 *
 * Uma rota só, e não duas: "ativa/pausada" e "faltam N hoje" aparecem nos
 * dois estados, e duas rotas calculando o mesmo par poderiam discordar no
 * mesmo segundo. As chaves das listas vêm SEMPRE presentes (vazias no estado
 * fechado), então quem lê nunca precisa checar a forma da resposta.
 *
 * **Mora sob `/api/config/`, e não sob `/api/fila/`**, mesmo o balão não
 * sendo um painel da /config: aquele prefixo INTEIRO passa pelo proxy sem
 * sessão de usuário (é onde o celular bate com a `RADAR_DEVICE_KEY` — ver
 * `src/proxy.ts`), e uma rota de admin pendurada lá dependeria só da própria
 * checagem. Aqui a sessão é cobrada duas vezes: no proxy e no `requireAdmin`
 * abaixo. `/api/fila/diagnostico` é a exceção que já existia, não o
 * precedente a seguir.
 *
 * **ADMIN ONLY**, como todo o resto da fila: ela é global, é drenada por UM
 * aparelho físico, e ver ou mexer no estado dela é comando sobre o celular
 * de outra pessoa. 401 sem sessão, 403 para membro.
 *
 * **Leitura pura: nada aqui dispara envio**, e a chamada nem reconstrói o
 * pool — quem entrega continua sendo o ciclo do aparelho em `/proximo`.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const now = new Date();
    const comLista = new URL(req.url).searchParams.get("lista") === "1";
    if (!comLista) {
      const resumo = await montarResumoBalao(db, now);
      return NextResponse.json({
        ...resumo,
        // Chaves SEMPRE presentes: o estado fechado não pagou por elas, e
        // ausência obrigaria a tela a distinguir "não pedi" de "está vazio".
        fila: [],
        elegiveis: 0,
        pendentes: [],
        pendentesTotal: 0,
        poolGeradoEm: null,
        lista: false,
      });
    }

    return NextResponse.json({ ...(await montarBalaoFila(db, now)), lista: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
