import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { loadFilaConfig } from "@/lib/fila/config";
import { flushGruposMaduros } from "@/lib/fila/flushRespostas";
import { listarRespostasPendentes, resumirGruposPendentes } from "@/lib/fila/respostasPainel";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Painel "Respostas pendentes" (/config): os leads que RESPONDERAM e já têm
 * rascunho gerado pela IA (ver `flushRespostas.ts` → `/filaRespostas`),
 * esperando o operador usar ou descartar.
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, pelo mesmo motivo da
 * lista de print ao lado: o proxy deixa todo o prefixo `/api/fila/` passar
 * sem sessão de usuário (é o celular com Bearer RADAR_DEVICE_KEY — ver
 * src/proxy.ts). Esta rota é para uma PESSOA logada no painel; pendurá-la
 * lá embaixo a tiraria da sessão junto.
 *
 * Restrita ao ADMIN, leitura e escrita (no PATCH ao lado), como todo o
 * bloco "Fila de envio" — e aqui há uma razão a mais que em qualquer outro
 * painel: a resposta do lead é CONTEÚDO DE CONVERSA PRIVADA, captada do
 * celular pessoal do operador (ver PRIVACIDADE no ARCHITECTURE.md).
 * 401 sem sessão, 403 para membro.
 *
 * ABRIR O PAINEL ESVAZIA OS GRUPOS MADUROS — o terceiro gatilho do flush,
 * e o que conserta um problema de PRODUÇÃO, não de teste. Os outros dois
 * gatilhos (`GET /api/fila/proximo` e o início de `POST
 * /api/fila/mensagem-recebida`) dependem do APARELHO: a macro de envio só
 * chama `/proximo` com o celular parado, bloqueado e ocioso há mais de dez
 * minutos, e o Radar não tem visão nenhuma do uso do aparelho. Um lead de
 * VERDADE que responde enquanto o operador está com o celular na mão ficava
 * sem rascunho até o aparelho ficar ocioso. A pessoa que abre este painel
 * está justamente perguntando "o que chegou?" — é o momento certo, e é ela
 * quem espera pelo resultado.
 *
 * MESMA função dos outros dois gatilhos (`flushGruposMaduros`), nunca uma
 * cópia — e ela nunca lança (isolamento em duas camadas, ver
 * `flushRespostas.ts`): falha de IA, cota estourada ou Firestore fora do ar
 * não impedem o painel de carregar. A lista sai com o que houver, e o grupo
 * que falhou aparece na linha de estado, marcado e retentável.
 *
 * O CUSTO é real e está declarado: cada grupo MADURO custa uma geração de
 * IA, com reserva de cota antes do request (dentro de `gerarRascunhoResposta`,
 * como todo o resto do app). Grupo ainda dentro da janela de agrupamento não
 * é tocado — `reivindicarGrupoMaduro` só entrega o que venceu.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const now = new Date();
    // A config entra porque a LISTA depende dela: com `respostaAutomatica`
    // ligada, o que está na fila do aparelho não é pendência de aprovação —
    // e desligar o interruptor devolve esses rascunhos para cá. A `AppConfig`
    // entra porque o flush precisa dela (tetos de cota e precificação).
    const [config, appConfig] = await Promise.all([loadFilaConfig(db), loadConfig(db)]);

    await flushGruposMaduros(db, now, config, appConfig);

    // O resumo vem DEPOIS do flush, de propósito: o que sobrar aqui é o que
    // o flush não resolveu — grupo ainda dentro da janela, ou grupo que
    // falhou agora mesmo. Antes dele, a linha de estado mostraria como
    // "aguardando" exatamente os grupos que acabaram de virar rascunho.
    const [respostas, grupos] = await Promise.all([
      listarRespostasPendentes(db, config, now),
      resumirGruposPendentes(db),
    ]);

    // `respostaAutomatica` viaja junto da lista de propósito: com ele ligado
    // a lista é CURTA por construção (o que está na fila do aparelho não é
    // pendência de aprovação), e uma lista curta sem explicação é um estado
    // que mente. Vem da MESMA chamada que a filtrou, para os dois não
    // poderem discordar. `aguardando`/`comErro` viajam pela razão gêmea: a
    // lista vazia pode ser "nada chegou" ou "chegou e ainda está na janela",
    // e sem a contagem as duas têm a mesma cara.
    return NextResponse.json({
      respostas,
      respostaAutomatica: config.respostaAutomatica,
      aguardando: grupos.aguardando,
      comErro: grupos.comErro,
      janelaSegundos: config.respostaAgrupamentoSegundos,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
