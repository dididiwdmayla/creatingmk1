import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  CAMPOS_LIMITE_USUARIO,
  CAMPOS_META_USUARIO,
  PAPEIS,
  atualizarUsuario,
  excluirUsuario,
  publico,
  requireAdmin,
  type LimitesPatch,
  type MetasPatch,
  type Papel,
} from "@/lib/usuarios";

/** Valida um patch numérico genérico (number ≥ 0 seta, null limpa) contra a lista de campos conhecidos. */
function validarPatchNumerico<T extends string>(
  valor: unknown,
  campos: readonly T[],
  chaveBody: string,
  rotuloCampo: string,
  problemas: string[],
): Partial<Record<T, number | null>> | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${chaveBody} deve ser um objeto`);
    return undefined;
  }
  const obj = valor as Record<string, unknown>;
  for (const chave of Object.keys(obj)) {
    if (!(campos as readonly string[]).includes(chave)) {
      problemas.push(`${chaveBody}.${chave} não é um campo de ${rotuloCampo} conhecido`);
    }
  }
  const resultado: Partial<Record<T, number | null>> = {};
  for (const campo of campos) {
    const v = obj[campo];
    if (v === undefined) continue;
    if (v === null) {
      resultado[campo] = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
      resultado[campo] = v;
    } else {
      problemas.push(`${chaveBody}.${campo} deve ser inteiro ≥ 0 ou null (sem limite)`);
    }
  }
  return resultado;
}

function validarLimites(valor: unknown, problemas: string[]): LimitesPatch | undefined {
  return validarPatchNumerico(valor, CAMPOS_LIMITE_USUARIO, "limites", "limite", problemas);
}

function validarMetas(valor: unknown, problemas: string[]): MetasPatch | undefined {
  return validarPatchNumerico(valor, CAMPOS_META_USUARIO, "metas", "meta", problemas);
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
    const { nome, papel, ativo, senha, limites, metas } = body;
    if (
      nome === undefined &&
      papel === undefined &&
      ativo === undefined &&
      senha === undefined &&
      limites === undefined &&
      metas === undefined
    ) {
      problemas.push("informe ao menos um de: nome, papel, ativo, senha, limites, metas");
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
      if (!["nome", "papel", "ativo", "senha", "limites", "metas"].includes(chave)) {
        problemas.push(`chave desconhecida: ${chave}`);
      }
    }
    const limitesPatch = validarLimites(limites, problemas);
    const metasPatch = validarMetas(metas, problemas);
    if (problemas.length > 0) throw new ValidationError(problemas);

    const usuario = await atualizarUsuario(db, id, {
      nome: nome as string | undefined,
      papel: papel as Papel | undefined,
      ativo: ativo as boolean | undefined,
      senha: senha as string | undefined,
      limites: limitesPatch,
      metas: metasPatch,
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
