import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { autenticarDispositivo } from "@/lib/fila/auth";
import { loadFilaConfig } from "@/lib/fila/config";
import { flushGruposMaduros } from "@/lib/fila/flushRespostas";
import {
  processarMensagemRecebida,
  type CorpoMensagemRecebida,
} from "@/lib/fila/mensagemRecebida";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

/**
 * `POST /api/fila/mensagem-recebida` — o terceiro pilar da fila: a macro do
 * MacroDroid captura cada notificação do WhatsApp Business no celular
 * PESSOAL do operador e manda o corpo íntegro para cá. Autenticação de
 * DISPOSITIVO (`RADAR_DEVICE_KEY`), sob `/api/fila/*` (exceção do proxy).
 *
 * Corpo: `{ remetente, texto, canal, recebidoEm, chave }` — ver
 * `CorpoMensagemRecebida`. `recebidoEm` é o carimbo DA NOTIFICAÇÃO (contrato
 * com o aparelho: nunca o instante desta chamada HTTP — ver o comentário em
 * `lib/fila/mensagemRecebida.ts`).
 *
 * PRIVACIDADE: cada mensagem gera uma chamada própria (o WhatsApp não
 * agrupa notificações), e o aparelho manda TODA notificação do WhatsApp
 * Business, inclusive conversas que não são prospecção. Sem lead
 * correspondente ou canal de grupo, `processarMensagemRecebida` descarta em
 * silêncio — nada é persistido. E esta rota NUNCA loga `texto`, nem no
 * catch: `handleRouteError`/erros daqui não carregam o corpo da requisição.
 *
 * ÚNICA EXCEÇÃO ao descarte por "sem lead": `filaConfig.numeroExcecao`, UM
 * número de teste que o operador configura no painel — ver "Número de
 * exceção" em ARCHITECTURE.md. Vazio (o padrão) não muda nada do que este
 * comentário já descreve.
 *
 * Flush no INÍCIO, antes de processar esta mensagem: libera grupos MADUROS
 * de OUTROS leads (a mesma varredura que `GET /proximo` faz — ver
 * `flushGruposMaduros`), isolado por `try/catch` interno — falha na geração
 * de um rascunho nunca pode impedir esta mensagem de ser registrada.
 */
export async function POST(req: Request) {
  const barrado = autenticarDispositivo(req);
  if (barrado) return barrado;

  try {
    const db = getDb();
    const now = new Date();
    const corpo = await readJsonBody(req);

    const problemas: string[] = [];
    if (typeof corpo.remetente !== "string" || !corpo.remetente.trim()) {
      problemas.push("remetente deve ser string não vazia");
    }
    if (typeof corpo.texto !== "string" || !corpo.texto.trim()) {
      problemas.push("texto deve ser string não vazia");
    }
    if (typeof corpo.canal !== "string" || !corpo.canal.trim()) {
      problemas.push("canal deve ser string não vazia");
    }
    if (typeof corpo.recebidoEm !== "string" || Number.isNaN(Date.parse(corpo.recebidoEm))) {
      problemas.push("recebidoEm deve ser data ISO válida");
    }
    if (typeof corpo.chave !== "string" || !corpo.chave.trim()) {
      problemas.push("chave deve ser string não vazia");
    }
    if (problemas.length > 0) {
      throw new ValidationError(problemas);
    }

    const [filaConfig, appConfig] = await Promise.all([loadFilaConfig(db), loadConfig(db)]);
    await flushGruposMaduros(db, now, filaConfig, appConfig);

    await processarMensagemRecebida(db, corpo as unknown as CorpoMensagemRecebida, now, filaConfig);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
