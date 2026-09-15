import { NextResponse } from "next/server";

import { autenticarDispositivo } from "@/lib/fila/auth";
import { aplicarPausar } from "@/lib/fila/pausar";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

/**
 * `POST /api/fila/pausar` — liga/desliga a fila, e SÓ isso. Autenticação de
 * DISPOSITIVO (`RADAR_DEVICE_KEY`), sob `/api/fila/*`.
 *
 * O alcance da chave é o motivo: ela vive numa variável do MacroDroid, num
 * celular que sai de casa. Comprometida, deve permitir no máximo ligar e
 * desligar a fila — nunca reconfigurar cotas, janela ou o disparo de teste.
 * `PUT /api/config/fila` continua sendo o único caminho para o resto, e
 * continua `requireAdmin`. Ver `lib/fila/pausar.ts` para por que esta rota
 * NUNCA reusa `saveFilaConfig` (escrita dirigida ao campo, com merge — não o
 * doc inteiro).
 *
 * Corpo: `{ "ativo": true | false }`, valor SEMPRE explícito, nunca um
 * toggle — a macro pode reenviar o POST se a rede cair depois de a escrita
 * já ter saído, e um toggle desligaria o que acabou de ligar no reenvio.
 * Mandar o valor que já está vale como sucesso e não escreve nada
 * (`alterado: false`).
 *
 * Resposta ACHATADA, mesma regra das outras rotas da fila: `{ ativo,
 * alterado, erro }`, as três chaves sempre presentes. `erro` vazio é
 * sucesso; corpo malformado é bug de integração da própria macro, não um
 * estado operacional da fila — por isso sai com 400 e `ativo: false` de
 * PLACEHOLDER (o chamador deve checar `erro` antes de `ativo` nesse caso).
 */
export async function POST(req: Request) {
  const barrado = autenticarDispositivo(req);
  if (barrado) return barrado;

  try {
    const corpo = await readJsonBody(req);
    if (typeof corpo.ativo !== "boolean") {
      return NextResponse.json(
        { ativo: false, alterado: false, erro: "ativo deve ser booleano explícito (true ou false)" },
        { status: 400 },
      );
    }

    const db = getDb();
    const resultado = await aplicarPausar(db, corpo.ativo, "dispositivo");

    return NextResponse.json({ ativo: resultado.ativo, alterado: resultado.alterado, erro: "" });
  } catch (error) {
    return handleRouteError(error);
  }
}
