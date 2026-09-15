import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { autenticarDispositivo } from "@/lib/fila/auth";
import { loadFilaConfig } from "@/lib/fila/config";
import { confirmarEnvio } from "@/lib/fila/confirmar";
import { ClaimInvalidoError, type FilaEnvioResultado } from "@/lib/fila/envios";
import {
  confirmarTarefaResposta,
  ehClaimDeResposta,
} from "@/lib/fila/respostaAutomatica";
import { confirmarTeste, ehClaimDeTeste } from "@/lib/fila/teste";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/**
 * `POST /api/fila/confirmar` — o celular reporta o que aconteceu com a
 * tarefa que pegou em `/proximo`. Corpo: `{ id, leadId, resultado, detalhe }`,
 * onde `id` é o claimId daquela tarefa.
 *
 * Duas garantias que o executor no celular depende:
 *
 * - **409 para claim que não bate**, sem alterar nada. Cenário real: o
 *   celular trava, a claim expira, o lead é re-reservado, e só então o
 *   aparelho volta e tenta confirmar a claim VELHA — sem isto viraria envio
 *   duplicado ou contador errado.
 * - **Confirmação repetida da MESMA claim devolve sucesso sem duplicar
 *   nada.** A rede pode cair DEPOIS de a mensagem ter saído, e aí o celular
 *   reenvia o confirmar; repetir não pode contar duas vezes.
 *
 * **O contrato NÃO muda com a resposta automática**: os mesmos três
 * resultados, a mesma idempotência, o mesmo 409, as mesmas chaves na
 * resposta. O que muda é para onde a confirmação vai, e isso é decidido pelo
 * PREFIXO do claimId — `teste-` e `resp-`, cada um com seu desvio de custo
 * zero, os dois ANTES da transação que toca lead, contador e rotação.
 *
 * **A claim de TESTE desvia aqui, antes de tudo.** O desvio é pelo PREFIXO
 * do claimId (`lib/fila/teste.ts`), que custa zero leitura e acontece antes
 * de `confirmarEnvio` — a transação que move lead, contador e rotação. Essa
 * checagem não pode ficar depois de nenhuma escrita: um teste que
 * incrementasse o contador do dia falsificaria a meta, e um que movesse o
 * status marcaria como contactado um negócio que não recebeu nada.
 */

const RESULTADOS: FilaEnvioResultado[] = ["enviado", "invalido", "falhou"];

/** Teto do texto livre que o celular manda em `detalhe` — é diagnóstico, não log. */
const DETALHE_MAX = 300;

export async function POST(req: Request) {
  const barrado = autenticarDispositivo(req);
  if (barrado) return barrado;

  try {
    const db = getDb();
    const corpo = await readJsonBody(req);
    const { id, leadId, resultado, detalhe } = corpo;

    const problemas: string[] = [];
    if (typeof id !== "string" || !id.trim()) problemas.push("id deve ser o claimId da tarefa");
    if (typeof leadId !== "string" || !leadId.trim()) problemas.push("leadId deve ser string não vazia");
    if (!RESULTADOS.includes(resultado as FilaEnvioResultado)) {
      problemas.push(`resultado deve ser um de: ${RESULTADOS.join(", ")}`);
    }
    if (detalhe !== undefined && detalhe !== null && typeof detalhe !== "string") {
      problemas.push("detalhe deve ser string");
    }
    if (problemas.length > 0) {
      return NextResponse.json({ erro: "corpo_invalido", problemas }, { status: 400 });
    }

    // ── CLAIM DE TESTE ────────────────────────────────────────────────
    // ANTES de qualquer leitura de config e antes da transação real: o
    // caminho de teste registra o resultado e não toca em lead, contador,
    // rotação nem selo. Nem `RADAR_DEVICE_USER_ID` faz falta aqui — não há
    // ação de usuário para atribuir.
    if (ehClaimDeTeste(id as string)) {
      const confirmacao = await confirmarTeste(
        db,
        id as string,
        resultado as FilaEnvioResultado,
        typeof detalhe === "string" ? detalhe.slice(0, DETALHE_MAX) : null,
        new Date(),
      );
      if (!confirmacao) {
        // Mesmo dialeto do caminho real: "esta tarefa não é mais sua".
        return NextResponse.json({ erro: "claim_invalida" }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        teste: true,
        estado: confirmacao.resultado,
        repetida: confirmacao.repetida,
        // Chaves do contrato real mantidas: a macro lê por marcador, e uma
        // chave que some numa das voltas carrega lixo sem avisar. Teste não
        // tem tentativas nem lead parado — daí os valores fixos.
        tentativas: 0,
        parado: false,
      });
    }

    // ── CLAIM DE RESPOSTA AUTOMÁTICA ─────────────────────────────────
    // Mesmo desvio por prefixo da claim de teste, e pela mesma razão: esta
    // confirmação não pode passar por `confirmarEnvio`, que moveria o status
    // do lead, gastaria a meta do dia e giraria a rotação de frases — nada
    // disso vale para uma resposta (o lead já está em "respondeu", a
    // resposta não sai de frase nenhuma, e a cota dela é outra coluna do
    // contador). `RADAR_DEVICE_USER_ID` também não faz falta aqui: não há
    // ação de usuário para atribuir, porque nenhum doc de lead é escrito.
    if (ehClaimDeResposta(id as string)) {
      const config = await loadFilaConfig(db);
      const confirmacao = await confirmarTarefaResposta(
        db,
        id as string,
        resultado as FilaEnvioResultado,
        typeof detalhe === "string" ? detalhe.slice(0, DETALHE_MAX) : null,
        new Date(),
        config.inicioDiaOperacionalHora,
      );
      if (!confirmacao) {
        // Mesmo dialeto dos outros dois caminhos: "esta tarefa não é mais sua".
        return NextResponse.json({ erro: "claim_invalida" }, { status: 409 });
      }
      // As MESMAS chaves do caminho real, com os mesmos significados:
      // `parado` aqui é "saiu do automático e voltou para o painel".
      return NextResponse.json({ ok: true, teste: false, ...confirmacao });
    }

    // O usuário sob o qual as ações do celular são atribuídas — mantém
    // coerente o registro de autor (quem contatou) mesmo quando quem dispara
    // é o executor automático, não uma sessão de navegador.
    const userId = process.env.RADAR_DEVICE_USER_ID;
    if (!userId) {
      return jsonError(
        503,
        "config_error",
        "RADAR_DEVICE_USER_ID não configurada no servidor (ver .env.example).",
      );
    }

    const config = await loadFilaConfig(db);
    const confirmacao = await confirmarEnvio(
      db,
      leadId as string,
      id as string,
      resultado as FilaEnvioResultado,
      {
        detalhe: typeof detalhe === "string" ? detalhe.slice(0, DETALHE_MAX) : null,
        userId,
        inicioDiaOperacionalHora: config.inicioDiaOperacionalHora,
      },
    );

    return NextResponse.json({ ok: true, teste: false, ...confirmacao });
  } catch (error) {
    if (error instanceof ClaimInvalidoError) {
      // Dialeto próprio da fila (ver lib/fila/auth.ts): o executor no celular
      // só precisa distinguir "pode repetir" de "esta tarefa não é mais sua".
      return NextResponse.json({ erro: "claim_invalida" }, { status: 409 });
    }
    return handleRouteError(error);
  }
}
