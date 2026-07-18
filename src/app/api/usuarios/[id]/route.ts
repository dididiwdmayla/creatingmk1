import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  PAPEIS,
  atualizarUsuario,
  publico,
  requireAdmin,
  type Papel,
} from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Edição de um usuário pelo admin: renomear, trocar papel, ativar/
 * desativar (não existe DELETE — desativar preserva a atribuição histórica
 * de buscas/demos/contatos) e redefinir senha. Redefinição/desativação
 * derrubam as sessões antigas do usuário (versão de sessão no token).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    await requireAdmin(db, req);
    const body = await readJsonBody(req);

    const problemas: string[] = [];
    const { nome, papel, ativo, senha } = body;
    if (nome === undefined && papel === undefined && ativo === undefined && senha === undefined) {
      problemas.push("informe ao menos um de: nome, papel, ativo, senha");
    }
    if (nome !== undefined && typeof nome !== "string") problemas.push("nome deve ser string");
    if (papel !== undefined && !(PAPEIS as readonly unknown[]).includes(papel)) {
      problemas.push(`papel deve ser um de: ${PAPEIS.join(", ")}`);
    }
    if (ativo !== undefined && typeof ativo !== "boolean") {
      problemas.push("ativo deve ser booleano");
    }
    if (senha !== undefined && typeof senha !== "string") problemas.push("senha deve ser string");
    for (const chave of Object.keys(body)) {
      if (!["nome", "papel", "ativo", "senha"].includes(chave)) {
        problemas.push(`chave desconhecida: ${chave}`);
      }
    }
    if (problemas.length > 0) throw new ValidationError(problemas);

    const usuario = await atualizarUsuario(db, id, {
      nome: nome as string | undefined,
      papel: papel as Papel | undefined,
      ativo: ativo as boolean | undefined,
      senha: senha as string | undefined,
    });
    return NextResponse.json({ usuario: publico(usuario) });
  } catch (error) {
    return handleRouteError(error);
  }
}
