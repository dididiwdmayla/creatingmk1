/**
 * A AUTORIA da automação do estoque. Toda ação dela — demo criada
 * (`criadoPor`), busca executada (`userId`), reserva de cota (quebra
 * `porUsuario` e a cota individual em `usage_users`) e aprovação
 * automática (`aprovacaoPor`) — leva este id, e nenhum outro.
 *
 * Um PSEUDO-USUÁRIO, sem doc em `/usuarios`: não faz login, não aparece na
 * gestão de usuários e não recebe sessão. Criar o doc teria um efeito
 * colateral feio — o seed do primeiro login só roda com a coleção VAZIA
 * (`seedUsuariosSeVazio`), e um doc da automação criado antes dele deixaria
 * o admin sem conseguir entrar num banco novo.
 *
 * **As cotas são contadas AQUI, e por quê.** Nunca como admin: admin pula o
 * teto global (`reserveQuota` com `isAdmin`), e a automação tem de
 * obedecer os tetos globais como qualquer um — além dos dois tetos por
 * noite dela. Nunca num humano: comeria a cota pessoal de quem não pediu
 * nada (o mesmo argumento que deixou a precificação regional fora da cota
 * individual). Sem `limites` próprios: quem limita a automação são os
 * tetos da noite em `/config/automacao`.
 */
export const AUTOMACAO_USER_ID = "automacao";

/** Como a automação aparece onde a tela resolve id → nome. */
export const AUTOMACAO_NOME = "Automação";

/**
 * O mapa id → nome das telas, com a automação incluída — sem isto, as
 * demos e buscas dela apareceriam como "usuário removido".
 */
export function nomesComAutomacao(usuarios: Array<{ id: string; nome: string }>): Map<string, string> {
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  if (!nomes.has(AUTOMACAO_USER_ID)) nomes.set(AUTOMACAO_USER_ID, AUTOMACAO_NOME);
  return nomes;
}
