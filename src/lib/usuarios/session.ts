import {
  SESSION_COOKIE,
  appPassword,
  lerSessaoToken,
  type Sessao,
} from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { getUsuario } from "./repo";
import type { Usuario } from "./types";

/**
 * Resolução do usuário logado dentro das rotas API. O proxy já barrou
 * requests sem cookie assinado válido; aqui a rota confere o DOC do
 * usuário (existe, ativo, versão de sessão bate) antes de atribuir ações
 * — é o que faz "desativar usuário" e "redefinir senha" derrubarem
 * sessões antigas na prática.
 */

function tokenDaRequest(req: Request): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const par of header.split(";")) {
    const [nome, ...resto] = par.trim().split("=");
    if (nome === SESSION_COOKIE) return resto.join("=");
  }
  return undefined;
}

/** Sessão assinada do cookie (sem tocar no banco); inválida/ausente → null. */
export async function sessaoDaRequest(req: Request): Promise<Sessao | null> {
  const secret = appPassword();
  if (!secret) return null;
  return lerSessaoToken(tokenDaRequest(req), secret);
}

/**
 * Usuário do doc, validado contra a sessão do cookie. Sem sessão válida →
 * undefined (o proxy é quem bloqueia; rotas usam isto para ATRIBUIR a
 * ação ao usuário e para escopar respostas por papel).
 */
export async function usuarioDaRequest(db: AppDb, req: Request): Promise<Usuario | undefined> {
  const sessao = await sessaoDaRequest(req);
  if (!sessao) return undefined;
  const usuario = await getUsuario(db, sessao.userId);
  if (!usuario || !usuario.ativo || usuario.sessao !== sessao.versao) return undefined;
  return usuario;
}

/** Rotas restritas ao admin (config PUT, gestão de usuários): 401 sem sessão, 403 para membro. */
export async function requireAdmin(db: AppDb, req: Request): Promise<Usuario> {
  const usuario = await usuarioDaRequest(db, req);
  if (!usuario) throw new UnauthorizedError();
  if (usuario.papel !== "admin") throw new ForbiddenError();
  return usuario;
}
