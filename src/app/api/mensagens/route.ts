import { NextResponse } from "next/server";

import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  MENSAGEM_TEXTO_MAX,
  enviarMensagem,
  listConversa,
  resumoConversas,
} from "@/lib/mensagens";
import { getUsuario, listUsuarios, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Mensagens privadas entre usuários. TODA leitura/escrita é escopada pela
 * SESSÃO — a rota nunca aceita "de quem"/"pra quem ler" por parâmetro além
 * do interlocutor, e admin não tem acesso especial: conversa é privada
 * entre os dois participantes (papel administra usuários, não lê chat).
 *
 * GET             → resumo: interlocutores possíveis (demais usuários),
 *                   última mensagem/não-lidas por conversa e o total.
 * GET ?com=<id>   → conversa completa com o usuário <id> (as duas
 *                   direções); marca as recebidas como lidas — abrir a
 *                   conversa (e o polling dela) é o que conta como "ler".
 * POST            → { paraUserId, texto } envia texto simples.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const com = new URL(req.url).searchParams.get("com");
    if (com) {
      const mensagens = await listConversa(db, usuario.id, com, { marcarLidas: true });
      return NextResponse.json({ mensagens });
    }

    const todos = await listUsuarios(db);
    const outros = todos.filter((u) => u.id !== usuario.id);
    const conversas = await resumoConversas(
      db,
      usuario.id,
      outros.map((u) => u.id),
    );
    const totalNaoLidas = conversas.reduce((soma, c) => soma + c.naoLidas, 0);
    return NextResponse.json({
      usuarios: outros.map((u) => ({ id: u.id, nome: u.nome, ativo: u.ativo })),
      conversas,
      totalNaoLidas,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = await readJsonBody(req);
    const problemas: string[] = [];
    if (typeof body.paraUserId !== "string" || !body.paraUserId.trim()) {
      problemas.push("paraUserId deve ser string não vazia");
    }
    if (typeof body.texto !== "string" || !body.texto.trim()) {
      problemas.push("texto deve ser string não vazia");
    } else if (body.texto.trim().length > MENSAGEM_TEXTO_MAX) {
      problemas.push(`texto deve ter no máximo ${MENSAGEM_TEXTO_MAX} caracteres`);
    }
    for (const chave of Object.keys(body)) {
      if (!["paraUserId", "texto"].includes(chave)) {
        problemas.push(`chave desconhecida: ${chave}`);
      }
    }
    if (problemas.length > 0) throw new ValidationError(problemas);

    const paraUserId = (body.paraUserId as string).trim();
    if (paraUserId === usuario.id) {
      throw new ValidationError(["não dá pra enviar mensagem para si mesmo"]);
    }
    const destinatario = await getUsuario(db, paraUserId);
    if (!destinatario) {
      throw new NotFoundError(`Usuário "${paraUserId}" não encontrado.`);
    }

    const mensagem = await enviarMensagem(db, usuario.id, paraUserId, body.texto as string);
    return NextResponse.json({ mensagem });
  } catch (error) {
    return handleRouteError(error);
  }
}
