import { SESSION_COOKIE, criarSessaoToken } from "@/lib/auth";
import type { Papel } from "@/lib/usuarios/types";
import type { FakeFirestore } from "./fake-firestore";

/**
 * Helper de teste: seeda um usuário em /usuarios e devolve o header
 * `cookie` com a sessão assinada dele (mesmo formato do login real).
 * O secret precisa bater com o APP_PASSWORD stubado no teste.
 */
export async function cookieDeSessao(
  db: FakeFirestore,
  {
    id,
    nome = id,
    papel = "membro",
    ativo = true,
    sessao = 0,
    secret = "segredo123",
  }: {
    id: string;
    nome?: string;
    papel?: Papel;
    ativo?: boolean;
    sessao?: number;
    secret?: string;
  },
): Promise<string> {
  const em = "2026-07-01T00:00:00.000Z";
  db.seed(`usuarios/${id}`, {
    id,
    nome,
    papel,
    ativo,
    sessao,
    criadoEm: em,
    atualizadoEm: em,
  });
  const token = await criarSessaoToken({ userId: id, papel, versao: sessao }, secret);
  return `${SESSION_COOKIE}=${token}`;
}
