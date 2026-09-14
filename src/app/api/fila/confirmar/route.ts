import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { autenticarDispositivo } from "@/lib/fila/auth";
import { loadFilaConfig } from "@/lib/fila/config";
import { confirmarEnvio } from "@/lib/fila/confirmar";
import { ClaimInvalidoError, type FilaEnvioResultado } from "@/lib/fila/envios";
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

    return NextResponse.json({ ok: true, ...confirmacao });
  } catch (error) {
    if (error instanceof ClaimInvalidoError) {
      // Dialeto próprio da fila (ver lib/fila/auth.ts): o executor no celular
      // só precisa distinguir "pode repetir" de "esta tarefa não é mais sua".
      return NextResponse.json({ erro: "claim_invalida" }, { status: 409 });
    }
    return handleRouteError(error);
  }
}
