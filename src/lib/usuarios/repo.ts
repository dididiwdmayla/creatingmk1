import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { usageUsuariosCollection } from "@/lib/costs/userQuota";
import { hashSenha } from "./senha";
import {
  CAMPOS_LIMITE_USUARIO,
  PAPEIS,
  USUARIOS_COLLECTION,
  type LimitesUsuario,
  type Papel,
  type Usuario,
} from "./types";

/**
 * Repositório de /usuarios. Escala de time pequeno (unidades de docs):
 * leitura de coleção inteira + filtros em memória, mesmo padrão dos leads.
 * Docs são sempre reescritos por inteiro (nunca merge do Firestore).
 */

export const NOME_MAX = 40;
export const SENHA_MIN = 4;

function docRef(db: AppDb, id: string) {
  return db.collection(USUARIOS_COLLECTION).doc(id);
}

// O Firestore real rejeita undefined (senhaHash ausente); o round-trip
// JSON descarta essas chaves.
function toDoc(usuario: Usuario): Record<string, unknown> {
  return JSON.parse(JSON.stringify(usuario)) as Record<string, unknown>;
}

/** Docs antigos/sujos são tolerados: sessao malformada lê como 0. */
function asUsuario(data: Record<string, unknown>, id: string): Usuario {
  const u = { ...(data as unknown as Usuario), id };
  if (typeof u.sessao !== "number" || !Number.isInteger(u.sessao) || u.sessao < 0) {
    u.sessao = 0;
  }
  return u;
}

export async function getUsuario(db: AppDb, id: string): Promise<Usuario | undefined> {
  const snap = await docRef(db, id).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? asUsuario(data, id) : undefined;
}

export async function listUsuarios(db: AppDb): Promise<Usuario[]> {
  const snapshot = await db.collection(USUARIOS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => asUsuario(doc.data(), doc.id))
    .sort(
      (a, b) =>
        Number(b.papel === "admin") - Number(a.papel === "admin") ||
        a.nome.localeCompare(b.nome),
    );
}

function normalizaNome(nome: string): string {
  return nome.trim().toLowerCase();
}

export async function getUsuarioPorNome(db: AppDb, nome: string): Promise<Usuario | undefined> {
  const alvo = normalizaNome(nome);
  if (!alvo) return undefined;
  const todos = await listUsuarios(db);
  return todos.find((usuario) => normalizaNome(usuario.nome) === alvo);
}

/**
 * Seed inicial (migração da senha única): na primeira tentativa de login
 * com /usuarios vazia, cria o admin — senha = APP_PASSWORD atual, quem já
 * usava o app continua entrando com a mesma senha — e dois membros SEM
 * senha (o admin define em /config antes de eles conseguirem logar).
 */
export async function seedUsuariosSeVazio(
  db: AppDb,
  senhaAdmin: string,
  now: Date = new Date(),
): Promise<boolean> {
  const snapshot = await db.collection(USUARIOS_COLLECTION).get();
  if (snapshot.docs.length > 0) return false;

  const em = now.toISOString();
  const base = { ativo: true, sessao: 0, criadoEm: em, atualizadoEm: em };
  const usuarios: Usuario[] = [
    { id: "admin", nome: "admin", papel: "admin", senhaHash: await hashSenha(senhaAdmin), ...base },
    { id: "membro-1", nome: "membro-1", papel: "membro", ...base },
    { id: "membro-2", nome: "membro-2", papel: "membro", ...base },
  ];
  for (const usuario of usuarios) {
    await docRef(db, usuario.id).set(toDoc(usuario));
  }
  return true;
}

async function validaNomeLivre(
  db: AppDb,
  nome: string,
  ignorarId: string | undefined,
  problemas: string[],
): Promise<void> {
  if (nome.length < 2 || nome.length > NOME_MAX) {
    problemas.push(`nome deve ter entre 2 e ${NOME_MAX} caracteres`);
    return;
  }
  const existente = await getUsuarioPorNome(db, nome);
  if (existente && existente.id !== ignorarId) {
    problemas.push(`já existe um usuário com o nome "${nome}"`);
  }
}

export async function criarUsuario(
  db: AppDb,
  dados: { nome: string; papel?: Papel; senha?: string },
  now: Date = new Date(),
): Promise<Usuario> {
  const problemas: string[] = [];
  const nome = dados.nome.trim();
  await validaNomeLivre(db, nome, undefined, problemas);
  if (dados.papel !== undefined && !PAPEIS.includes(dados.papel)) {
    problemas.push(`papel deve ser um de: ${PAPEIS.join(", ")}`);
  }
  if (dados.senha !== undefined && dados.senha.length < SENHA_MIN) {
    problemas.push(`senha deve ter ao menos ${SENHA_MIN} caracteres`);
  }
  if (problemas.length > 0) throw new ValidationError(problemas);

  const em = now.toISOString();
  const usuario: Usuario = {
    id: crypto.randomUUID(),
    nome,
    papel: dados.papel ?? "membro",
    ativo: true,
    ...(dados.senha !== undefined && { senhaHash: await hashSenha(dados.senha) }),
    sessao: 0,
    criadoEm: em,
    atualizadoEm: em,
  };
  await docRef(db, usuario.id).set(toDoc(usuario));
  return usuario;
}

/**
 * Carimba a última visita à fila do dia (/hoje). Não mexe em atualizadoEm
 * (que marca edições administrativas) nem em sessao — visitar não é editar.
 * Usuário sumido (corrida com exclusão de doc) é no-op.
 */
export async function carimbarVisita(
  db: AppDb,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const usuario = await getUsuario(db, id);
  if (!usuario) return;
  await docRef(db, id).set(toDoc({ ...usuario, ultimaVisitaEm: now.toISOString() }));
}

/**
 * Salva a última posição do slider da calculadora de precificação
 * (self-service, sem admin — não é credencial nem edição administrativa,
 * mesmo espírito de carimbarVisita: não mexe em atualizadoEm/sessao).
 */
export async function salvarPrecoBaseSlider(
  db: AppDb,
  id: string,
  precoBase: number,
): Promise<void> {
  const usuario = await getUsuario(db, id);
  if (!usuario) return;
  await docRef(db, id).set(toDoc({ ...usuario, ultimoPrecoBaseSlider: precoBase }));
}

/** Patch de limites: number seta, null LIMPA (sem limite naquela janela), ausente não mexe. */
export type LimitesPatch = Partial<Record<keyof LimitesUsuario, number | null>>;

export interface UsuarioPatch {
  nome?: string;
  papel?: Papel;
  ativo?: boolean;
  /** Redefine a senha (e derruba as sessões antigas do usuário). */
  senha?: string;
  /** Nunca vem de sessão do próprio usuário — só de requireAdmin. */
  limites?: LimitesPatch;
}

/** Aplica o patch de limites sobre o atual; campo totalmente limpo → undefined (não {}). */
function mergeLimites(
  atual: LimitesUsuario | undefined,
  patch: LimitesPatch | undefined,
): LimitesUsuario | undefined {
  if (!patch) return atual;
  const resultado: LimitesUsuario = { ...atual };
  for (const campo of CAMPOS_LIMITE_USUARIO) {
    if (!(campo in patch)) continue;
    const valor = patch[campo];
    if (valor === null) {
      delete resultado[campo];
    } else if (valor !== undefined) {
      resultado[campo] = valor;
    }
  }
  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

/**
 * Atualização pelo admin. Redefinir senha, desativar ou trocar papel
 * incrementa `sessao` — cookies antigos do usuário param de valer nas
 * rotas API. Guarda-corpo: o último admin ativo não pode ser desativado
 * nem rebaixado (o app ficaria sem quem gerencie usuários). Limites nunca
 * revogam sessão — não são credencial, são configuração operacional.
 */
export async function atualizarUsuario(
  db: AppDb,
  id: string,
  patch: UsuarioPatch,
  now: Date = new Date(),
): Promise<Usuario> {
  const usuario = await getUsuario(db, id);
  if (!usuario) throw new NotFoundError(`Usuário "${id}" não encontrado.`);

  const problemas: string[] = [];
  const nome = patch.nome?.trim();
  if (nome !== undefined) await validaNomeLivre(db, nome, id, problemas);
  if (patch.papel !== undefined && !PAPEIS.includes(patch.papel)) {
    problemas.push(`papel deve ser um de: ${PAPEIS.join(", ")}`);
  }
  if (patch.senha !== undefined && patch.senha.length < SENHA_MIN) {
    problemas.push(`senha deve ter ao menos ${SENHA_MIN} caracteres`);
  }

  const perdeAdmin =
    usuario.papel === "admin" &&
    usuario.ativo &&
    (patch.ativo === false || (patch.papel !== undefined && patch.papel !== "admin"));
  if (perdeAdmin) {
    const admins = (await listUsuarios(db)).filter((u) => u.papel === "admin" && u.ativo);
    if (admins.length <= 1) {
      problemas.push("não dá para desativar ou rebaixar o último admin ativo");
    }
  }
  if (problemas.length > 0) throw new ValidationError(problemas);

  const revoga =
    patch.senha !== undefined ||
    patch.ativo === false ||
    (patch.papel !== undefined && patch.papel !== usuario.papel);

  const limites = mergeLimites(usuario.limites, patch.limites);
  const atualizado: Usuario = {
    ...usuario,
    ...(nome !== undefined && { nome }),
    ...(patch.papel !== undefined && { papel: patch.papel }),
    ...(patch.ativo !== undefined && { ativo: patch.ativo }),
    ...(patch.senha !== undefined && { senhaHash: await hashSenha(patch.senha) }),
    limites,
    sessao: revoga ? usuario.sessao + 1 : usuario.sessao,
    atualizadoEm: now.toISOString(),
  };
  await docRef(db, id).set(toDoc(atualizado));
  return atualizado;
}

/**
 * Exclusão real de usuário (admin), além de desativar: leads/contatos/
 * mensagens registrados por ele permanecem intocados (apontam pro id, que
 * simplesmente deixa de resolver — a UI mostra "usuário removido" quando o
 * id não bate com ninguém em /usuarios). Só os CONTADORES de cota dele
 * (usage_users/{id}/dias/*) são apagados — não fazem sentido pra um id que
 * não vai mais bater limite algum. Guarda-corpo: nunca a si mesmo, nunca o
 * último admin (mesmo limite de atualizarUsuario, mas incondicional aqui —
 * não existe "desativar de volta" depois de excluído).
 */
export async function excluirUsuario(
  db: AppDb,
  id: string,
  requisitanteId: string,
): Promise<void> {
  const usuario = await getUsuario(db, id);
  if (!usuario) throw new NotFoundError(`Usuário "${id}" não encontrado.`);

  if (id === requisitanteId) {
    throw new ForbiddenError("Não dá pra excluir o próprio usuário.");
  }
  if (usuario.papel === "admin") {
    const admins = (await listUsuarios(db)).filter((u) => u.papel === "admin");
    if (admins.length <= 1) {
      throw new ValidationError(["não dá para excluir o último admin"]);
    }
  }

  const dias = await db.collection(usageUsuariosCollection(id)).get();
  for (const doc of dias.docs) {
    await db.collection(usageUsuariosCollection(id)).doc(doc.id).delete();
  }
  await docRef(db, id).delete();
}
