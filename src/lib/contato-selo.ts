/** Mapa id → nome (GET /api/usuarios/nomes) usado pra resolver os selos. */
export type NomesUsuarios = Record<string, string>;

/** Usuário excluído (doc apagado) não aparece no mapa — cai neste fallback. */
export function nomeUsuario(nomes: NomesUsuarios, userId: string): string {
  return nomes[userId] ?? "usuário removido";
}
