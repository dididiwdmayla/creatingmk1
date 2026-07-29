import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  CAMPOS_LIMITE_USUARIO,
  PAPEIS,
  atualizarUsuario,
  excluirUsuario,
  publico,
  requireAdmin,
  type LimitesPatch,
  type Papel,
} from "@/lib/usuarios";

function validarLimites(valor: unknown, problemas: string[]): LimitesPatch | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push("limites deve ser um objeto");
    return undefined;
  }
  const obj = valor as Record<string, unknown>;
  for (const chave of Object.keys(obj)) {
    if (!(CAMPOS_LIMITE_USUARIO as readonly string[]).includes(chave)) {
      problemas.push(`limites.${chave} não é um campo de limite conhecido`);
    }
  }
  const limites: LimitesPatch = {};
  for (const campo of CAMPOS_LIMITE_USUARIO) {
    const v = obj[campo];
    if (v === undefined) continue;
    if (v === null) {
      limites[campo] = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
      limites[campo] = v;
    } else {
      problemas.push(`limites.${campo} deve ser inteiro ≥ 0 ou null (sem limite)`);
    }
  }
  return limites;
}

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
    const { nome, papel, ativo, senha, limites } = body;
    if (
      nome === undefined &&
      papel === undefined &&
      ativo === undefined &&
      senha === undefined &&
      limites === undefined
    ) {
      problemas.push("informe ao menos um de: nome, papel, ativo, senha, limites");
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
      if (!["nome", "papel", "ativo", "senha", "limites"].includes(chave)) {
        problemas.push(`chave desconhecida: ${chave}`);
      }
    }
    const limitesPatch = validarLimites(limites, problemas);
    if (problemas.length > 0) throw new ValidationError(problemas);

    const usuario = await atualizarUsuario(db, id, {
      nome: nome as string | undefined,
      papel: papel as Papel | undefined,
      ativo: ativo as boolean | undefined,
      senha: senha as string | undefined,
      limites: limitesPatch,
    });
    return NextResponse.json({ usuario: publico(usuario) });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Exclusão real (admin), além de desativar (ver ARCHITECTURE.md e
 * excluirUsuario): leads/contatos/mensagens registrados por ele continuam
 * intactos — só deixam de resolver o nome ("usuário removido" na UI).
 * Contadores de cota individual dele são apagados. Bloqueado para si mesmo
 * e para o último admin.
 */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const requisitante = await requireAdmin(db, req);

    await excluirUsuario(db, id, requisitante.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
