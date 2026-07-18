export const USUARIOS_COLLECTION = "usuarios";

export const PAPEIS = ["admin", "membro"] as const;

export type Papel = (typeof PAPEIS)[number];

/**
 * Um usuário do app (coleção /usuarios). O seed inicial (primeiro login
 * após a migração) cria o admin — com a APP_PASSWORD atual como senha — e
 * dois membros SEM senha (o admin define via /config). Usuário sem
 * senhaHash ou com ativo=false não consegue logar.
 */
export interface Usuario {
  /** Também é o ID do doc: "admin"/"membro-1"/"membro-2" no seed, UUID nos criados depois. */
  id: string;
  /** Nome de login (único, comparado sem caixa). */
  nome: string;
  papel: Papel;
  ativo: boolean;
  /** "pbkdf2:{iterações}:{saltHex}:{hashHex}" — ausente = senha não definida. */
  senhaHash?: string;
  /**
   * Versão de sessão: entra no token assinado do cookie; redefinir senha,
   * desativar ou trocar o papel incrementa e derruba as sessões antigas
   * DESTE usuário (sem estado de sessão no banco).
   */
  sessao: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** Usuário sem o hash — o único formato que as rotas devolvem ao cliente. */
export type UsuarioPublico = Omit<Usuario, "senhaHash"> & { temSenha: boolean };

export function publico(usuario: Usuario): UsuarioPublico {
  const { senhaHash, ...resto } = usuario;
  return { ...resto, temSenha: Boolean(senhaHash) };
}
