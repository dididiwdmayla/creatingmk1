import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  PAPEIS,
  criarUsuario,
  listUsuarios,
  publico,
  requireAdmin,
  type Papel,
} from "@/lib/usuarios";

/**
 * Gestão de usuários — restrita ao admin (403 para membro). GET lista sem
 * os hashes; POST cria (papel default "membro"; senha opcional — sem ela o
 * usuário só loga depois que o admin definir uma).
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const usuarios = await listUsuarios(db);
    return NextResponse.json({ usuarios: usuarios.map(publico) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const body = await readJsonBody(req);

    const problemas: string[] = [];
    if (typeof body.nome !== "string" || !body.nome.trim()) {
      problemas.push("nome deve ser string não vazia");
    }
    if (body.papel !== undefined && !(PAPEIS as readonly unknown[]).includes(body.papel)) {
      problemas.push(`papel deve ser um de: ${PAPEIS.join(", ")}`);
    }
    if (body.senha !== undefined && typeof body.senha !== "string") {
      problemas.push("senha deve ser string");
    }
    for (const chave of Object.keys(body)) {
      if (!["nome", "papel", "senha"].includes(chave)) {
        problemas.push(`chave desconhecida: ${chave}`);
      }
    }
    if (problemas.length > 0) throw new ValidationError(problemas);

    const usuario = await criarUsuario(db, {
      nome: body.nome as string,
      papel: body.papel as Papel | undefined,
      senha: body.senha as string | undefined,
    });
    return NextResponse.json({ usuario: publico(usuario) });
  } catch (error) {
    return handleRouteError(error);
  }
}
