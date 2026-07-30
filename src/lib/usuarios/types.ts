import type { NivelIA } from "@/lib/ai/nivel";

export const USUARIOS_COLLECTION = "usuarios";

export const PAPEIS = ["admin", "membro"] as const;

export type Papel = (typeof PAPEIS)[number];

/**
 * Limites individuais de cota (buscas/enriquecimentos), três janelas
 * independentes por tipo. Campo ausente = sem limite naquela janela.
 * Nunca editável pelo próprio usuário — só via rota admin
 * (atualizarUsuario/PATCH /api/usuarios/[id]).
 */
export interface LimitesUsuario {
  buscasDia?: number;
  buscasSemana?: number;
  buscasMes?: number;
  enriquecimentosDia?: number;
  enriquecimentosSemana?: number;
  enriquecimentosMes?: number;
}

export const CAMPOS_LIMITE_USUARIO = [
  "buscasDia",
  "buscasSemana",
  "buscasMes",
  "enriquecimentosDia",
  "enriquecimentosSemana",
  "enriquecimentosMes",
] as const satisfies readonly (keyof LimitesUsuario)[];

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
  /**
   * Última vez que ESTE usuário carregou a fila do dia (/hoje). O delta de
   * "leads novos" é por usuário: novos = criados depois deste carimbo.
   * Atualizado pelo próprio GET /api/hoje.
   */
  ultimaVisitaEm?: string;
  /** Cotas individuais de buscas/enriquecimentos. Ausente = sem limite algum. */
  limites?: LimitesUsuario;
  /**
   * Última posição do slider da calculadora de precificação (700–10.000,
   * BRL) — self-service, atualizado pelo próprio PUT /api/precificacao/slider
   * a cada mudança. Ausente = ainda não mexeu no slider.
   */
  ultimoPrecoBaseSlider?: number;
  /**
   * Último nível de intervenção da IA escolhido na Forja ("toque-leve" |
   * "equilibrado" | "completo") — self-service, atualizado a cada geração
   * (checkbox do passo de escolha ou botão "Gerar com IA" do editor).
   * Ausente = ainda não escolheu (a UI cai no padrão de ./ai/nivel.ts).
   */
  ultimoNivelIA?: NivelIA;
  criadoEm: string;
  atualizadoEm: string;
}

/** Usuário sem o hash — o único formato que as rotas devolvem ao cliente. */
export type UsuarioPublico = Omit<Usuario, "senhaHash"> & { temSenha: boolean };

export function publico(usuario: Usuario): UsuarioPublico {
  const { senhaHash, ...resto } = usuario;
  return { ...resto, temSenha: Boolean(senhaHash) };
}
